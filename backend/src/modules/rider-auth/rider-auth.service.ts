import bcrypt from "bcryptjs";
import { Types } from "mongoose";
import { createHash, randomBytes } from "crypto";

import { ApiError } from "../../utils/ApiError";
import { logger } from "../../utils/logger";
import {
  generateTokenPair,
  verifyRefreshToken,
  getTokenExpiration,
} from "../../utils/token";

import { Rider } from "../riders/rider.model";
import { RiderLoginChallenge } from "./rider-login-challenge.model";

import {
  createRiderSession,
  findRiderSessionByRefreshToken,
  revokeRiderSession,
  revokeAllRiderSessions,
} from "./rider-session.service";

import {
  createOtp,
  assertOtpCanBeResent,
  assertOtpAttemptsAvailable,
  verifyOtp,
  deliverOtp,
} from "../../services/otp.service";

import type {
  RiderLoginInput,
  RiderLoginChallengeResult,
  RiderLoginResult,
  RiderRefreshResult,
  RiderLoginResponse,
} from "./rider-auth.types";

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;
const PASSWORD_SALT_ROUNDS = 12;

const hashChallengeId = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

const createChallengeId = (): string =>
  randomBytes(32).toString("hex");

const getRefreshExpiry = (refreshToken: string): Date => {
  const expiration = getTokenExpiration(refreshToken);

  if (!expiration || expiration <= Date.now()) {
    throw ApiError.internal("Could not determine refresh token expiry.");
  }

  return new Date(expiration);
};

const findRiderForLogin = async (input: RiderLoginInput) => {
  const conditions: Record<string, unknown>[] = [];

  if (input.email) {
    conditions.push({
      email: input.email.trim().toLowerCase(),
    });
  }

  if (input.phone) {
    conditions.push({
      phone: input.phone.trim(),
    });
  }

  if (!conditions.length) {
    throw ApiError.badRequest("Email or phone is required.");
  }

  return Rider.findOne({
    $or: conditions,
  }).select("+password");
};

const isRiderLocked = (rider: {
  lockUntil?: Date | null;
}): boolean =>
  Boolean(
    rider.lockUntil &&
    rider.lockUntil.getTime() > Date.now(),
  );

const recordFailedRiderLogin = async (
  riderId: Types.ObjectId,
): Promise<void> => {
  const rider = await Rider.findByIdAndUpdate(
    riderId,
    {
      $inc: {
        failedLoginAttempts: 1,
      },
    },
    {
      new: true,
    },
  ).select("failedLoginAttempts");

  if (
    rider &&
    rider.failedLoginAttempts >= MAX_LOGIN_ATTEMPTS
  ) {
    await Rider.updateOne(
      {
        _id: riderId,
      },
      {
        $set: {
          lockUntil: new Date(Date.now() + LOCK_DURATION_MS),
        },
      },
    );
  }
};

const resetRiderLoginAttempts = async (
  riderId: Types.ObjectId,
): Promise<void> => {
  await Rider.updateOne(
    {
      _id: riderId,
    },
    {
      $set: {
        failedLoginAttempts: 0,
        lockUntil: null,
      },
    },
  );
};

/*
|--------------------------------------------------------------------------
| Rider Login OTP Delivery
|--------------------------------------------------------------------------
*/

const sendRiderLoginOtp = async (
  rider: {
    email?: string;
    phone?: string;
    name: string;
  },
  code: string,
): Promise<void> => {
  const deliveryTasks: Promise<{
    delivered: boolean;
  }>[] = [];

  if (rider.email) {
    deliveryTasks.push(
      deliverOtp({
        channel: "EMAIL",
        destination: rider.email,
        code,
        purpose: "LOGIN_VERIFICATION",
        subject: "Your NOPTRIX rider login code",
        recipientName: rider.name,
      }),
    );
  }

  if (rider.phone) {
    deliveryTasks.push(
      deliverOtp({
        channel: "SMS",
        destination: rider.phone,
        code,
        purpose: "LOGIN_VERIFICATION",
        subject: "NOPTRIX Rider Login",
        recipientName: rider.name,
      }),
    );
  }

  if (!deliveryTasks.length) {
    throw ApiError.badRequest(
      "Rider must have at least one registered email or phone number.",
    );
  }

  // One successful delivery is enough. The same OTP works for both channels.
  const deliveries = await Promise.allSettled(deliveryTasks);

  deliveries.forEach((result, index) => {
    if (result.status !== "rejected") return;

    const error = result.reason as {
      name?: unknown;
      code?: unknown;
      command?: unknown;
      responseCode?: unknown;
    };

    logger.error(
      {
        errorName: typeof error?.name === "string" ? error.name : undefined,
        errorCode: typeof error?.code === "string" ? error.code : undefined,
        command: typeof error?.command === "string" ? error.command : undefined,
        responseCode:
          typeof error?.responseCode === "number"
            ? error.responseCode
            : undefined,
      },
      "Rider login OTP channel delivery failed.",
    );
  });

  const delivered = deliveries.some(
    (result) =>
      result.status === "fulfilled" &&
      result.value.delivered,
  );

  if (!delivered) {
    throw ApiError.internal(
      "Rider login verification code could not be delivered.",
    );
  }
};

/*
|--------------------------------------------------------------------------
| Issue Rider Login Challenge
|--------------------------------------------------------------------------
*/

export const issueRiderLoginChallenge = async (
  rider: {
    _id: Types.ObjectId;
    email?: string;
    phone?: string;
    name: string;
  },
): Promise<RiderLoginChallengeResult> => {
  if (!rider.email && !rider.phone) {
    throw ApiError.badRequest(
      "Rider must have at least one registered email or phone number.",
    );
  }

  // Invalidate any previous pending challenge.
  await RiderLoginChallenge.updateMany(
    {
      riderId: rider._id,
      status: "PENDING",
    },
    {
      $set: {
        status: "LOCKED",
      },
    },
  );

  const otp = createOtp();
  const challengeId = createChallengeId();

  const challenge = await RiderLoginChallenge.create({
    riderId: rider._id,
    codeHash: otp.hash,
    challengeIdHash: hashChallengeId(challengeId),
    status: "PENDING",
    attempts: 0,
    maxAttempts: otp.maxAttempts,
    expiresAt: otp.expiresAt,
    resendAvailableAt: otp.resendAvailableAt,
  });

  try {
    await sendRiderLoginOtp(rider, otp.code);
  } catch (error) {
    await RiderLoginChallenge.deleteOne({
      _id: challenge._id,
    });

    throw error;
  }

  return {
    verificationRequired: true,
    challengeId,
    email: rider.email,
    phone: rider.phone,
    expiresAt: otp.expiresAt,
    resendAvailableAt: otp.resendAvailableAt,
  };
};

/*
|--------------------------------------------------------------------------
| Password Login
|--------------------------------------------------------------------------
|
| Password verification does not create a session.
| A session is created only after OTP verification.
| OTP can be delivered to email, phone, or both.
|
|--------------------------------------------------------------------------
*/

export const loginRider = async (
  input: RiderLoginInput,
): Promise<RiderLoginResponse> => {
  const rider = await findRiderForLogin(input);

  if (!rider || !rider.password) {
    throw ApiError.unauthorized(
      "Invalid email/phone or password.",
      {
        code: "INVALID_CREDENTIALS",
      },
    );
  }

  if (isRiderLocked(rider)) {
    throw ApiError.unauthorized(
      "Rider account is temporarily locked.",
      {
        code: "ACCOUNT_LOCKED",
      },
    );
  }

  const passwordValid = await bcrypt.compare(
    input.password,
    rider.password,
  );

  if (!passwordValid) {
    await recordFailedRiderLogin(rider._id);

    throw ApiError.unauthorized(
      "Invalid email/phone or password.",
      {
        code: "INVALID_CREDENTIALS",
      },
    );
  }

  if (rider.status !== "ACTIVE") {
    throw ApiError.forbidden(
      `Rider account is ${String(rider.status).toLowerCase()}.`,
      {
        code: "RIDER_ACCOUNT_INACTIVE",
        details: {
          status: rider.status,
        },
      },
    );
  }

  const email = rider.email || undefined;
  const phone = rider.phone || undefined;

  if (!email && !phone) {
    throw ApiError.badRequest(
      "Rider must have at least one registered email or phone number for login verification.",
    );
  }

  await resetRiderLoginAttempts(rider._id);

  return issueRiderLoginChallenge({
    _id: rider._id,
    email,
    phone,
    name: rider.name,
  });
};

/*
|--------------------------------------------------------------------------
| Verify Rider Login Challenge
|--------------------------------------------------------------------------
*/

export const verifyRiderLoginChallenge = async (
  challengeId: string,
  code: string,
): Promise<RiderLoginResult> => {
  const challenge = await RiderLoginChallenge.findOne({
    challengeIdHash: hashChallengeId(challengeId),
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

    throw ApiError.badRequest(
      "The login verification code has expired.",
    );
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

    throw ApiError.badRequest(
      "Invalid login verification code.",
    );
  }

  // Only one concurrent verification can consume this challenge.
  const consumedChallenge =
    await RiderLoginChallenge.findOneAndUpdate(
      {
        _id: challenge._id,
        status: "PENDING",
        attempts: challenge.attempts,
        expiresAt: {
          $gt: new Date(),
        },
      },
      {
        $set: {
          status: "VERIFIED",
          verifiedAt: new Date(),
        },
      },
      {
        new: true,
      },
    );

  if (!consumedChallenge) {
    throw ApiError.badRequest(
      "This login verification challenge has already been used or expired.",
    );
  }

  const rider = await Rider.findById(challenge.riderId).exec();

  if (!rider || rider.status !== "ACTIVE") {
    throw ApiError.forbidden(
      "Rider account is not active.",
      {
        code: "RIDER_ACCOUNT_INACTIVE",
      },
    );
  }

  const tokenPair = generateTokenPair(
    rider._id.toString(),
    {
      role: "RIDER",
    },
  );

  const session = await createRiderSession({
    riderId: rider._id.toString(),
    refreshToken: tokenPair.refreshToken,
    expiresAt: getRefreshExpiry(tokenPair.refreshToken),
  });

  await Rider.updateOne(
    {
      _id: rider._id,
    },
    {
      $set: {
        lastLoginAt: new Date(),
      },
    },
  );

  return {
    accessToken: tokenPair.accessToken,
    refreshToken: tokenPair.refreshToken,
    riderId: rider._id,
    sessionId: session._id,
  };
};

/*
|--------------------------------------------------------------------------
| Resend Rider Login Challenge
|--------------------------------------------------------------------------
*/

export const resendRiderLoginChallenge = async (
  challengeId: string,
): Promise<RiderLoginChallengeResult> => {
  const challenge = await RiderLoginChallenge.findOne({
    challengeIdHash: hashChallengeId(challengeId),
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

    throw ApiError.badRequest(
      "The login verification challenge has expired.",
    );
  }

  assertOtpCanBeResent(challenge.resendAvailableAt);

  const rider = await Rider.findById(
    challenge.riderId,
  ).exec();

  if (!rider || rider.status !== "ACTIVE") {
    throw ApiError.unauthorized(
      "Rider account is not active.",
    );
  }

  const email = rider.email || undefined;
  const phone = rider.phone || undefined;

  if (!email && !phone) {
    throw ApiError.badRequest(
      "Rider must have at least one registered email or phone number.",
    );
  }

  const otp = createOtp();

  // Deliver before replacing the old code.
  await sendRiderLoginOtp(
    {
      email,
      phone,
      name: rider.name,
    },
    otp.code,
  );

  const updatedChallenge =
    await RiderLoginChallenge.findOneAndUpdate(
      {
        _id: challenge._id,
        status: "PENDING",
        resendAvailableAt: {
          $lte: new Date(),
        },
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
      {
        new: true,
      },
    );

  if (!updatedChallenge) {
    throw ApiError.tooManyRequests(
      "A new login code was already requested. Please try again later.",
      {
        code: "OTP_RESEND_COOLDOWN",
      },
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

/*
|--------------------------------------------------------------------------
| Refresh Rider Token
|--------------------------------------------------------------------------
*/

export const refreshRiderToken = async (
  refreshToken: string,
): Promise<RiderRefreshResult> => {
  let payload;

  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw ApiError.unauthorized(
      "Invalid or expired refresh token.",
      {
        code: "INVALID_REFRESH_TOKEN",
      },
    );
  }

  const session = await findRiderSessionByRefreshToken(
    refreshToken,
  );

  if (!session) {
    throw ApiError.unauthorized(
      "Rider session is invalid or expired.",
      {
        code: "INVALID_SESSION",
      },
    );
  }

  const riderId = session.riderId.toString();

  if (payload.sub !== riderId) {
    await revokeRiderSession(
      riderId,
      session._id.toString(),
    );

    throw ApiError.unauthorized(
      "Refresh token identity mismatch.",
      {
        code: "TOKEN_IDENTITY_MISMATCH",
      },
    );
  }

  const rider = await Rider.findById(riderId);

  if (!rider || rider.status !== "ACTIVE") {
    await revokeRiderSession(
      riderId,
      session._id.toString(),
    );

    throw ApiError.forbidden(
      "Rider account is not active.",
      {
        code: "RIDER_ACCOUNT_INACTIVE",
      },
    );
  }

  const revoked = await revokeRiderSession(
    riderId,
    session._id.toString(),
  );

  if (!revoked) {
    throw ApiError.unauthorized(
      "Rider session is no longer active.",
      {
        code: "INVALID_SESSION",
      },
    );
  }

  const tokenPair = generateTokenPair(
    riderId,
    {
      role: "RIDER",
    },
  );

  const newSession = await createRiderSession({
    riderId,
    refreshToken: tokenPair.refreshToken,
    expiresAt: getRefreshExpiry(tokenPair.refreshToken),
  });

  return {
    accessToken: tokenPair.accessToken,
    refreshToken: tokenPair.refreshToken,
    riderId: rider._id,
    sessionId: newSession._id,
  };
};

/*
|--------------------------------------------------------------------------
| Logout Rider
|--------------------------------------------------------------------------
|
| The refresh token is obtained from the httpOnly cookie.
|
|--------------------------------------------------------------------------
*/

export const logoutRider = async (
  riderId: string,
  refreshToken?: string,
): Promise<void> => {
  if (!refreshToken) {
    return;
  }

  const session = await findRiderSessionByRefreshToken(
    refreshToken,
  );

  if (!session) {
    return;
  }

  if (session.riderId.toString() !== riderId) {
    throw ApiError.unauthorized(
      "Refresh token does not belong to this Rider.",
    );
  }

  await revokeRiderSession(
    riderId,
    session._id.toString(),
  );
};

/*
|--------------------------------------------------------------------------
| Change Rider Password
|--------------------------------------------------------------------------
*/

export const changeRiderPassword = async (
  riderId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> => {
  if (!Types.ObjectId.isValid(riderId)) {
    throw ApiError.badRequest("Invalid Rider ID.");
  }

  const rider = await Rider.findById(riderId).select(
    "+password",
  );

  if (!rider || !rider.password) {
    throw ApiError.notFound(
      "Rider account was not found.",
    );
  }

  const valid = await bcrypt.compare(
    currentPassword,
    rider.password,
  );

  if (!valid) {
    throw ApiError.unauthorized(
      "Current password is incorrect.",
      {
        code: "INVALID_CURRENT_PASSWORD",
      },
    );
  }

  const samePassword = await bcrypt.compare(
    newPassword,
    rider.password,
  );

  if (samePassword) {
    throw ApiError.badRequest(
      "New password must be different from the current password.",
    );
  }

  rider.password = await bcrypt.hash(
    newPassword,
    PASSWORD_SALT_ROUNDS,
  );

  rider.passwordChangedAt = new Date();

  await rider.save();

  await revokeAllRiderSessions(riderId);
};
