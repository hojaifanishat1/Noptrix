import bcrypt from "bcryptjs";
import { Types } from "mongoose";
import { createHash, randomBytes } from "crypto";

import { ApiError } from "../../utils/ApiError";
import { logger } from "../../utils/logger";
import {
  createOtp,
  assertOtpCanBeResent,
  assertOtpAttemptsAvailable,
  verifyOtp,
  deliverOtp,
} from "../../services/otp.service";
import { SellerLoginChallenge } from "./seller-login-challenge.model";
import {
  generateTokenPair,
  verifyRefreshToken,
} from "../../utils/token";

import { Seller } from "../sellers/seller.model";
import {
  createSellerSession,
  findSellerSessionByRefreshToken,
  findActiveSellerSession,
  revokeSellerSession,
  revokeAllSellerSessions,
  touchSellerSession,
} from "./seller-session.service";

import type { SellerLoginInput } from "./seller-auth.validator";
import type {
  SellerLoginResult,
  SellerRefreshResult,
  SellerLoginChallengeResult,
  SellerLoginResponse,
} from "./seller-auth.types";

const SALT_ROUNDS = 12;

const getRefreshTokenExpirationDate = (token: string): Date => {
  const payload = verifyRefreshToken(token);

  if (typeof payload.exp !== "number") {
    throw ApiError.internal("Refresh token expiration is invalid.");
  }

  return new Date(payload.exp * 1000);
};

const normalizeEmail = (email: string): string =>
  email.trim().toLowerCase();

const findSellerForLogin = async (input: SellerLoginInput) => {
  const filter = input.email
    ? { email: normalizeEmail(input.email) }
    : input.phone
      ? { phone: input.phone.trim() }
      : null;

  if (!filter) {
    throw ApiError.badRequest("Email or phone is required.");
  }

  return Seller.findOne(filter).select("+password");
};

const ensureSellerCanLogin = (seller: {
  status: string;
  lockUntil?: Date;
}) => {
  if (seller.lockUntil && seller.lockUntil > new Date()) {
    throw ApiError.unauthorized("Account is temporarily locked.", {
      code: "ACCOUNT_LOCKED",
    });
  }

  if (seller.status !== "ACTIVE") {
    throw ApiError.forbidden(
      `Seller account is ${seller.status.toLowerCase()}.`,
      {
        code: "SELLER_ACCOUNT_INACTIVE",
        details: { status: seller.status },
      },
    );
  }
};

const createSellerTokensAndSession = async (
  sellerId: Types.ObjectId,
  metadata?: {
    userAgent?: string;
    ipAddress?: string;
    deviceId?: string;
  },
) => {
  const tokenPair = generateTokenPair(sellerId.toString(), {
    role: "SELLER",
  });

  const sessionId = new Types.ObjectId();

  const session = await createSellerSession({
    sessionId: sessionId.toString(),
    sellerId: sellerId.toString(),
    refreshToken: tokenPair.refreshToken,
    expiresAt: getRefreshTokenExpirationDate(tokenPair.refreshToken),
    userAgent: metadata?.userAgent,
    ipAddress: metadata?.ipAddress,
    deviceId: metadata?.deviceId,
  });

  return {
    accessToken: tokenPair.accessToken,
    refreshToken: tokenPair.refreshToken,
    sellerId,
    sessionId: session._id,
  };
};


const hashSellerChallengeId = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

const createSellerChallengeId = (): string =>
  randomBytes(32).toString("hex");

const sendSellerLoginOtp = async (
  seller: {
    email?: string;
    phone?: string;
    name?: string;
  },
  code: string,
): Promise<void> => {
  const tasks: Promise<{ delivered: boolean }>[] = [];

  if (seller.email) {
    tasks.push(
      deliverOtp({
        channel: "EMAIL",
        destination: seller.email,
        code,
        purpose: "LOGIN_VERIFICATION",
        subject: "Your NOPTRIX seller login code",
        recipientName: "Seller",
      }),
    );
  }

  if (seller.phone) {
    tasks.push(
      deliverOtp({
        channel: "SMS",
        destination: seller.phone,
        code,
        purpose: "LOGIN_VERIFICATION",
        subject: "NOPTRIX Seller Login",
        recipientName: "Seller",
      }),
    );
  }

  if (!tasks.length) {
    throw ApiError.badRequest(
      "Seller must have a registered email or phone for login verification.",
    );
  }

  const results = await Promise.allSettled(tasks);

  results.forEach((result) => {
    if (result.status !== "rejected") return;

    logger.error(
      { error: result.reason },
      "Seller login OTP delivery failed.",
    );
  });

  const delivered = results.some(
    (result) =>
      result.status === "fulfilled" && result.value.delivered,
  );

  if (!delivered) {
    throw ApiError.internal(
      "Seller login verification code could not be delivered.",
    );
  }
};

export const issueSellerLoginChallenge = async (
  seller: {
    _id: Types.ObjectId;
    email?: string;
    phone?: string;
    name?: string;
  },
): Promise<SellerLoginChallengeResult> => {
  if (!seller.email && !seller.phone) {
    throw ApiError.badRequest(
      "Seller must have a registered email or phone for login verification.",
    );
  }

  await SellerLoginChallenge.updateMany(
    {
      sellerId: seller._id,
      status: "PENDING",
    },
    {
      $set: { status: "LOCKED" },
    },
  );

  const otp = createOtp();
  const challengeId = createSellerChallengeId();

  const challenge = await SellerLoginChallenge.create({
    sellerId: seller._id,
    codeHash: otp.hash,
    challengeIdHash: hashSellerChallengeId(challengeId),
    status: "PENDING",
    attempts: 0,
    maxAttempts: otp.maxAttempts,
    expiresAt: otp.expiresAt,
    resendAvailableAt: otp.resendAvailableAt,
  });

  try {
    await sendSellerLoginOtp(seller, otp.code);
  } catch (error) {
    await SellerLoginChallenge.deleteOne({ _id: challenge._id });
    throw error;
  }

  return {
    verificationRequired: true,
    challengeId,
    email: seller.email,
    phone: seller.phone,
    expiresAt: otp.expiresAt,
    resendAvailableAt: otp.resendAvailableAt,
  };
};

export const loginSeller = async (
  input: SellerLoginInput,
  _metadata?: {
    userAgent?: string;
    ipAddress?: string;
    deviceId?: string;
  },
): Promise<SellerLoginResponse> => {
  const seller = await findSellerForLogin(input);

  if (!seller) {
    throw ApiError.unauthorized("Invalid email/phone or password.", {
      code: "INVALID_CREDENTIALS",
    });
  }

  if (seller.lockUntil && seller.lockUntil > new Date()) {
    throw ApiError.unauthorized("Account is temporarily locked.", {
      code: "ACCOUNT_LOCKED",
    });
  }

  const passwordValid = await bcrypt.compare(
    input.password,
    seller.password,
  );

  if (!passwordValid) {
    seller.failedLoginAttempts = (seller.failedLoginAttempts ?? 0) + 1;

    if (seller.failedLoginAttempts >= 5) {
      seller.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
    }

    await seller.save();

    throw ApiError.unauthorized("Invalid email/phone or password.", {
      code: "INVALID_CREDENTIALS",
    });
  }

  ensureSellerCanLogin(seller);

  seller.failedLoginAttempts = 0;
  seller.lockUntil = undefined;
  await seller.save();

  return issueSellerLoginChallenge({
    _id: seller._id as Types.ObjectId,
    email: seller.email || undefined,
    phone: seller.phone || undefined,
  });
};

export const verifySellerLoginChallenge = async (
  challengeId: string,
  code: string,
  metadata?: {
    userAgent?: string;
    ipAddress?: string;
    deviceId?: string;
  },
): Promise<SellerLoginResult> => {
  const challenge = await SellerLoginChallenge.findOne({
    challengeIdHash: hashSellerChallengeId(challengeId),
    status: "PENDING",
  })
    .select("+codeHash +challengeIdHash")
    .exec();

  if (!challenge) {
    throw ApiError.badRequest(
      "Invalid or expired login verification challenge.",
    );
  }

  if (challenge.expiresAt.getTime() <= Date.now()) {
    challenge.status = "LOCKED";
    await challenge.save();
    throw ApiError.badRequest("The login verification code has expired.");
  }

  assertOtpAttemptsAvailable(challenge.attempts);

  const result = verifyOtp({
    code,
    expectedHash: challenge.codeHash,
    expiresAt: challenge.expiresAt,
    attemptsUsed: challenge.attempts,
  });

  if (!result.valid) {
    challenge.attempts += 1;

    if (
      result.attemptsExceeded ||
      challenge.attempts >= challenge.maxAttempts
    ) {
      challenge.status = "LOCKED";
    }

    await challenge.save();
    throw ApiError.badRequest("Invalid login verification code.");
  }

  const consumed = await SellerLoginChallenge.findOneAndUpdate(
    {
      _id: challenge._id,
      status: "PENDING",
      attempts: challenge.attempts,
      expiresAt: { $gt: new Date() },
    },
    {
      $set: {
        status: "VERIFIED",
        verifiedAt: new Date(),
      },
    },
    { new: true },
  );

  if (!consumed) {
    throw ApiError.badRequest(
      "This login verification challenge has already been used or expired.",
    );
  }

  const seller = await Seller.findById(challenge.sellerId).exec();

  if (!seller || seller.status !== "ACTIVE") {
    throw ApiError.forbidden("Seller account is not active.", {
      code: "SELLER_ACCOUNT_INACTIVE",
    });
  }

  seller.lastLoginAt = new Date();
  await seller.save();

  return createSellerTokensAndSession(
    seller._id as Types.ObjectId,
    metadata,
  );
};

export const resendSellerLoginChallenge = async (
  challengeId: string,
): Promise<SellerLoginChallengeResult> => {
  const challenge = await SellerLoginChallenge.findOne({
    challengeIdHash: hashSellerChallengeId(challengeId),
    status: "PENDING",
  })
    .select("+codeHash +challengeIdHash")
    .exec();

  if (!challenge) {
    throw ApiError.badRequest(
      "Invalid or expired login verification challenge.",
    );
  }

  if (challenge.expiresAt.getTime() <= Date.now()) {
    challenge.status = "LOCKED";
    await challenge.save();
    throw ApiError.badRequest("The login verification challenge has expired.");
  }

  assertOtpCanBeResent(challenge.resendAvailableAt);

  const seller = await Seller.findById(challenge.sellerId).exec();

  if (!seller || seller.status !== "ACTIVE") {
    throw ApiError.unauthorized("Seller account is not active.");
  }

  const email = seller.email || undefined;
  const phone = seller.phone || undefined;

  if (!email && !phone) {
    throw ApiError.badRequest(
      "Seller must have a registered email or phone.",
    );
  }

  const otp = createOtp();

  await sendSellerLoginOtp(
    {
      email,
      phone,
      },
    otp.code,
  );

  const updated = await SellerLoginChallenge.findOneAndUpdate(
    {
      _id: challenge._id,
      status: "PENDING",
      resendAvailableAt: { $lte: new Date() },
    },
    {
      $set: {
        codeHash: otp.hash,
        attempts: 0,
        maxAttempts: otp.maxAttempts,
        expiresAt: otp.expiresAt,
        resendAvailableAt: otp.resendAvailableAt,
      },
    },
    { new: true },
  );

  if (!updated) {
    throw ApiError.tooManyRequests(
      "A new login code was already requested. Please try again later.",
      { code: "OTP_RESEND_COOLDOWN" },
    );
  }

  return {
    verificationRequired: true,
    challengeId,
    email,
    phone,
    expiresAt: otp.expiresAt,
    resendAvailableAt: otp.resendAvailableAt,
  };
};

export const refreshSellerToken = async (
  refreshToken: string,
): Promise<SellerRefreshResult> => {
  let payload;

  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw ApiError.unauthorized("Invalid or expired refresh token.", {
      code: "INVALID_REFRESH_TOKEN",
    });
  }

  const session = await findSellerSessionByRefreshToken(refreshToken);

  if (!session) {
    throw ApiError.unauthorized("Session is invalid, expired, or revoked.", {
      code: "INVALID_SESSION",
    });
  }

  const sellerId = session.sellerId.toString();

  if (payload.sub !== sellerId || payload.role !== "SELLER") {
    await revokeSellerSession(sellerId, session._id.toString());

    throw ApiError.unauthorized("Invalid refresh token.", {
      code: "TOKEN_IDENTITY_MISMATCH",
    });
  }

  const seller = await Seller.findById(sellerId);

  if (!seller || seller.status !== "ACTIVE") {
    await revokeSellerSession(sellerId, session._id.toString());

    throw ApiError.forbidden("Seller account is not active.", {
      code: "SELLER_ACCOUNT_INACTIVE",
    });
  }

  await revokeSellerSession(sellerId, session._id.toString());

  return createSellerTokensAndSession(seller._id as Types.ObjectId);
};

export const logoutSeller = async (
  sellerId: string,
  sessionId: string,
): Promise<void> => {
  const session = await findActiveSellerSession(sellerId, sessionId);

  if (!session) {
    throw ApiError.unauthorized("Session is invalid or already revoked.", {
      code: "INVALID_SESSION",
    });
  }

  const revoked = await revokeSellerSession(sellerId, sessionId);

  if (!revoked) {
    throw ApiError.unauthorized("Session is invalid or already revoked.", {
      code: "INVALID_SESSION",
    });
  }
};

export const changeSellerPassword = async (
  sellerId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> => {
  const seller = await Seller.findById(sellerId).select("+password");

  if (!seller) {
    throw ApiError.notFound("Seller account not found.");
  }

  const valid = await bcrypt.compare(currentPassword, seller.password);

  if (!valid) {
    throw ApiError.badRequest("Current password is incorrect.");
  }

  if (currentPassword === newPassword) {
    throw ApiError.badRequest(
      "New password must be different from current password.",
    );
  }

  seller.password = await bcrypt.hash(newPassword, SALT_ROUNDS);
  seller.passwordChangedAt = new Date();
  seller.failedLoginAttempts = 0;
  seller.lockUntil = undefined;

  await seller.save();

  await revokeAllSellerSessions(sellerId);
};

export const touchSellerSessionById = async (
  sellerId: string,
  sessionId: string,
) => {
  return touchSellerSession(sellerId, sessionId);
};
