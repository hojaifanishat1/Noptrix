import { Types } from "mongoose";

export interface SellerAuthContext {
  sellerId: string;
  role?: string;
  tokenIssuedAt?: number;
  tokenExpiresAt?: number;
  claims: Readonly<Record<string, unknown>>;
}

export interface SellerLoginResult {
  accessToken: string;
  refreshToken: string;
  sellerId: Types.ObjectId;
  sessionId: Types.ObjectId;
}

export interface SellerRefreshResult {
  accessToken: string;
  refreshToken: string;
  sellerId: Types.ObjectId;
  sessionId: Types.ObjectId;
}

export interface SellerAuthenticatedIdentity {
  sellerId: Types.ObjectId;
  sessionId: Types.ObjectId;
}
