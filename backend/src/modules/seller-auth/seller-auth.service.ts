import bcrypt from "bcryptjs";
import { Types } from "mongoose";

import { ApiError } from "../../utils/ApiError";
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

export const loginSeller = async (
  input: SellerLoginInput,
  metadata?: {
    userAgent?: string;
    ipAddress?: string;
    deviceId?: string;
  },
): Promise<SellerLoginResult> => {
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
  seller.lastLoginAt = new Date();
  await seller.save();

  return createSellerTokensAndSession(
    seller._id as Types.ObjectId,
    metadata,
  );
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
