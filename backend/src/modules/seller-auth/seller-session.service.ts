import { createHash } from "crypto";
import { Types } from "mongoose";

import { ApiError } from "../../utils/ApiError";
import { SellerSession } from "./seller-session.model";

const hashToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

const validateId = (id: string): Types.ObjectId => {
  if (!Types.ObjectId.isValid(id)) {
    throw ApiError.badRequest("Invalid session reference.");
  }

  return new Types.ObjectId(id);
};

export const createSellerSession = async (input: {
  sessionId: string;
  sellerId: string;
  refreshToken: string;
  expiresAt: Date;
  userAgent?: string;
  ipAddress?: string;
  deviceId?: string;
}) => {
  return SellerSession.create({
    _id: validateId(input.sessionId),
    sellerId: validateId(input.sellerId),
    refreshTokenHash: hashToken(input.refreshToken),
    status: "ACTIVE",
    expiresAt: input.expiresAt,
    userAgent: input.userAgent,
    ipAddress: input.ipAddress,
    deviceId: input.deviceId,
    lastUsedAt: new Date(),
  });
};

export const findSellerSessionByRefreshToken = async (
  refreshToken: string,
) => {
  return SellerSession.findOne({
    refreshTokenHash: hashToken(refreshToken),
    status: "ACTIVE",
    expiresAt: { $gt: new Date() },
  }).select("+refreshTokenHash");
};

export const findActiveSellerSession = async (
  sellerId: string,
  sessionId: string,
) => {
  return SellerSession.findOne({
    _id: validateId(sessionId),
    sellerId: validateId(sellerId),
    status: "ACTIVE",
    expiresAt: { $gt: new Date() },
  });
};

export const revokeSellerSession = async (
  sellerId: string,
  sessionId: string,
) => {
  return SellerSession.findOneAndUpdate(
    {
      _id: validateId(sessionId),
      sellerId: validateId(sellerId),
      status: "ACTIVE",
    },
    {
      $set: {
        status: "REVOKED",
        revokedAt: new Date(),
      },
    },
    { new: true },
  );
};

export const revokeAllSellerSessions = async (sellerId: string) => {
  return SellerSession.updateMany(
    {
      sellerId: validateId(sellerId),
      status: "ACTIVE",
    },
    {
      $set: {
        status: "REVOKED",
        revokedAt: new Date(),
      },
    },
  );
};

export const touchSellerSession = async (
  sellerId: string,
  sessionId: string,
) => {
  return SellerSession.findOneAndUpdate(
    {
      _id: validateId(sessionId),
      sellerId: validateId(sellerId),
      status: "ACTIVE",
      expiresAt: { $gt: new Date() },
    },
    {
      $set: { lastUsedAt: new Date() },
    },
    { new: true },
  );
};