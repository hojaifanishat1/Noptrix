import { Request, Response, NextFunction, RequestHandler } from "express";
import { Types } from "mongoose";
import { verifyAccessToken, type AccessTokenPayload } from "../utils/token";
import { Rider } from "../modules/riders/rider.model";
import { User } from "../modules/users/user.model";

/*
|--------------------------------------------------------------------------
| Rider Auth Context
|--------------------------------------------------------------------------
*/

export interface RiderAuthContext {
  readonly riderId: string;
  readonly role?: string;
  readonly tokenIssuedAt?: number;
  readonly tokenExpiresAt?: number;
  readonly claims: Readonly<Record<string, unknown>>;
}

declare global {
  namespace Express {
    interface Request {
      riderAuth?: RiderAuthContext;
    }
  }
}

const extractBearerToken = (authorizationHeader?: string): string | null => {
  if (typeof authorizationHeader !== "string") return null;

  const parts = authorizationHeader.trim().split(/\s+/);

  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
    return null;
  }

  return parts[1]?.trim() || null;
};

const buildRiderAuthContext = (
  payload: AccessTokenPayload,
): RiderAuthContext => {
  const { sub, iat, exp, ...additionalClaims } = payload;
  const claims = additionalClaims as Record<string, unknown>;
  const role = typeof claims.role === "string" ? claims.role : undefined;

  return Object.freeze({
    riderId: sub,
    ...(role ? { role } : {}),
    ...(typeof iat === "number" ? { tokenIssuedAt: iat } : {}),
    ...(typeof exp === "number" ? { tokenExpiresAt: exp } : {}),
    claims: Object.freeze({ ...claims }),
  });
};

/*
|--------------------------------------------------------------------------
| Rider Authentication
|--------------------------------------------------------------------------
| Token sub is the Rider document ID, not the User ID.
| Database status is checked on every protected rider request.
|--------------------------------------------------------------------------
*/

export const riderAuth: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const token = extractBearerToken(req.headers.authorization);

  if (!token) {
    res.status(401).json({
      success: false,
      message: "Rider authentication required.",
    });
    return;
  }

  let payload: AccessTokenPayload;

  try {
    payload = verifyAccessToken(token);
  } catch {
    res.status(401).json({
      success: false,
      message: "Invalid or expired rider authentication token.",
    });
    return;
  }

  if (payload.tokenType !== "access") {
    res.status(401).json({
      success: false,
      message: "Invalid rider authentication token.",
    });
    return;
  }

  if (payload.role !== "RIDER") {
    res.status(403).json({
      success: false,
      message: "Rider access required.",
    });
    return;
  }

  if (
    typeof payload.sub !== "string" ||
    !Types.ObjectId.isValid(payload.sub)
  ) {
    res.status(401).json({
      success: false,
      message: "Invalid rider authentication token.",
    });
    return;
  }

  try {
    const rider = await Rider.findById(payload.sub)
      .select("userId status")
      .lean()
      .exec();

    if (!rider) {
      res.status(403).json({
        success: false,
        message: "Rider profile not found.",
      });
      return;
    }

    if (rider.status !== "ACTIVE") {
      res.status(403).json({
        success: false,
        message: "Rider account is not active.",
        code: "RIDER_ACCOUNT_INACTIVE",
      });
      return;
    }

    const user = await User.findById(rider.userId)
      .select("status")
      .lean()
      .exec();

    if (!user || user.status !== "ACTIVE") {
      res.status(403).json({
        success: false,
        message: "Rider user account is unavailable.",
        code: "RIDER_USER_ACCOUNT_INACTIVE",
      });
      return;
    }

    req.riderAuth = buildRiderAuthContext(payload);
    next();
  } catch (error) {
    next(error);
  }
};

export const requireRider: RequestHandler = (req, res, next) => {
  if (!req.riderAuth?.riderId) {
    res.status(401).json({
      success: false,
      message: "Rider authentication required.",
    });
    return;
  }
  next();
};

export const requireRiderRole: RequestHandler = (req, res, next) => {
  if (!req.riderAuth?.riderId) {
    res.status(401).json({
      success: false,
      message: "Rider authentication required.",
    });
    return;
  }

  if (req.riderAuth.role !== "RIDER") {
    res.status(403).json({
      success: false,
      message: "Rider access required.",
    });
    return;
  }

  next();
};

export const getAuthenticatedRiderId = (req: Request): string => {
  const riderId = req.riderAuth?.riderId;

  if (!riderId) {
    throw new Error("Authenticated rider context is missing.");
  }

  return riderId;
};

export const getAuthenticatedRiderRole = (
  req: Request,
): string | undefined => req.riderAuth?.role;

export const isRiderAuthenticated = (req: Request): boolean =>
  Boolean(req.riderAuth?.riderId);
