import { createHash } from "crypto";
import { Types } from "mongoose";

import { RiderSession } from "./rider-session.model";

const hashRefreshToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

export interface CreateRiderSessionInput {
  riderId: string;
  refreshToken: string;
  expiresAt: Date;
  userAgent?: string;
  ipAddress?: string;
  deviceId?: string;
}

export const createRiderSession = async (
  input: CreateRiderSessionInput,
) => {
  if (!Types.ObjectId.isValid(input.riderId)) {
    throw new Error("Invalid Rider ID.");
  }

  if (!input.refreshToken?.trim()) {
    throw new Error("Refresh token is required.");
  }

  if (!(input.expiresAt instanceof Date) ||
      Number.isNaN(input.expiresAt.getTime()) ||
      input.expiresAt <= new Date()) {
    throw new Error("A valid future session expiry is required.");
  }

  const [session] = await RiderSession.create([
    {
      riderId: new Types.ObjectId(input.riderId),
      refreshTokenHash: hashRefreshToken(input.refreshToken),
      status: "ACTIVE",
      expiresAt: input.expiresAt,
      userAgent: input.userAgent,
      ipAddress: input.ipAddress,
      deviceId: input.deviceId,
      lastUsedAt: new Date(),
    },
  ]);

  return session;
};

export const findRiderSessionByRefreshToken = async (
  refreshToken: string,
) => {
  if (!refreshToken?.trim()) {
    return null;
  }

  return RiderSession.findOne({
    refreshTokenHash: hashRefreshToken(refreshToken),
    status: "ACTIVE",
    expiresAt: { $gt: new Date() },
  }).select("+refreshTokenHash");
};

export const touchRiderSession = async (
  riderId: string,
  sessionId: string,
) => {
  if (
    !Types.ObjectId.isValid(riderId) ||
    !Types.ObjectId.isValid(sessionId)
  ) {
    return null;
  }

  return RiderSession.findOneAndUpdate(
    {
      _id: sessionId,
      riderId,
      status: "ACTIVE",
      expiresAt: { $gt: new Date() },
    },
    {
      $set: { lastUsedAt: new Date() },
    },
    { new: true },
  );
};

export const revokeRiderSession = async (
  riderId: string,
  sessionId: string,
) => {
  if (
    !Types.ObjectId.isValid(riderId) ||
    !Types.ObjectId.isValid(sessionId)
  ) {
    return false;
  }

  const result = await RiderSession.updateOne(
    {
      _id: sessionId,
      riderId,
      status: "ACTIVE",
    },
    {
      $set: {
        status: "REVOKED",
        revokedAt: new Date(),
      },
    },
  );

  return result.modifiedCount > 0;
};

export const revokeAllRiderSessions = async (
  riderId: string,
  exceptSessionId?: string,
) => {
  if (!Types.ObjectId.isValid(riderId)) {
    throw new Error("Invalid Rider ID.");
  }

  const filter: Record<string, unknown> = {
    riderId,
    status: "ACTIVE",
  };

  if (exceptSessionId && Types.ObjectId.isValid(exceptSessionId)) {
    filter._id = { $ne: new Types.ObjectId(exceptSessionId) };
  }

  const result = await RiderSession.updateMany(
    filter,
    {
      $set: {
        status: "REVOKED",
        revokedAt: new Date(),
      },
    },
  );

  return result.modifiedCount;
};
