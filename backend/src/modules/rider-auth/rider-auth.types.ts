import { Types } from "mongoose";

export interface RiderAuthContext {
  riderId: Types.ObjectId;
  sessionId: Types.ObjectId;
  tokenIssuedAt?: number;
  tokenExpiresAt?: number;
  claims: Record<string, unknown>;
}

export interface RiderLoginInput {
  email?: string;
  phone?: string;
  password: string;
}

export interface RiderLoginChallengeResult {
  verificationRequired: true;
  challengeId: string;
  email?: string;
  phone?: string;
  expiresAt: Date;
  resendAvailableAt: Date;
}

export interface RiderLoginResult {
  accessToken: string;
  refreshToken: string;
  riderId: Types.ObjectId;
  sessionId: Types.ObjectId;
}

export interface RiderRefreshResult {
  accessToken: string;
  refreshToken: string;
  riderId: Types.ObjectId;
  sessionId: Types.ObjectId;
}

export interface RiderAuthenticatedIdentity {
  riderId: Types.ObjectId;
  sessionId: Types.ObjectId;
}

export type RiderLoginResponse =
  | RiderLoginChallengeResult
  | RiderLoginResult;
