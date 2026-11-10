import { Types } from "mongoose";

import { ApiError } from "../../utils/ApiError";

import { generateTokenPair, verifyRefreshToken } from "../../utils/token";

import {
  createSession,
  findSessionByRefreshToken,
  revokeUserSession,
  touchSession,
} from "../sessions/session.service";

import {
  findUserForAuthentication,
  verifyUserPassword,
  updateLastLogin,
  recordFailedLogin,
  resetFailedLoginAttempts,
  isUserLocked,
} from "../users/user.service";

import { getRiderByUserId } from "../riders/rider.service";

import type { RiderLoginInput } from "./rider-auth.validator";

import type { RiderLoginResult, RiderRefreshResult } from "./rider-auth.types";

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

const toObjectIdString = (value: Types.ObjectId): string => {
  return value.toString();
};

/*
|--------------------------------------------------------------------------
| Refresh Token Expiration
|--------------------------------------------------------------------------
*/

const getRefreshTokenExpirationDate = (refreshToken: string): Date => {
  const payload = verifyRefreshToken(refreshToken);

  if (typeof payload.exp !== "number") {
    throw ApiError.internal("Refresh token expiration is invalid.", {
      code: "INVALID_REFRESH_EXPIRATION",
    });
  }

  return new Date(payload.exp * 1000);
};

/*
|--------------------------------------------------------------------------
| Find User For Rider Login
|--------------------------------------------------------------------------
*/

const findUserForLogin = async (input: RiderLoginInput) => {
  if (input.email) {
    return findUserForAuthentication(input.email);
  }

  if (input.phone) {
    return findUserForAuthentication(input.phone);
  }

  throw ApiError.badRequest("Email or phone is required.", {
    code: "LOGIN_IDENTIFIER_REQUIRED",
  });
};

/*
|--------------------------------------------------------------------------
| Rider Login
|--------------------------------------------------------------------------
*/

export const loginRider = async (
  input: RiderLoginInput,
  metadata?: {
    readonly userAgent?: string;
    readonly ipAddress?: string;
    readonly deviceId?: string;
  },
): Promise<RiderLoginResult> => {
  /*
    |--------------------------------------------------------------------------
    | Find User
    |--------------------------------------------------------------------------
    */

  const user = await findUserForLogin(input);

  if (!user) {
    throw ApiError.unauthorized("Invalid email/phone or password.", {
      code: "INVALID_CREDENTIALS",
    });
  }

  const userId = toObjectIdString(user._id);

  /*
    |--------------------------------------------------------------------------
    | Account Lock Check
    |--------------------------------------------------------------------------
    */

  if (isUserLocked(user)) {
    throw ApiError.unauthorized("Account is temporarily locked.", {
      code: "ACCOUNT_LOCKED",
    });
  }

  /*
    |--------------------------------------------------------------------------
    | Password Verification
    |--------------------------------------------------------------------------
    */

  const passwordValid = await verifyUserPassword(user, input.password);

  if (!passwordValid) {
    await recordFailedLogin(userId);

    throw ApiError.unauthorized("Invalid email/phone or password.", {
      code: "INVALID_CREDENTIALS",
    });
  }

  /*
    |--------------------------------------------------------------------------
    | Find Rider Profile
    |--------------------------------------------------------------------------
    */

  const rider = await getRiderByUserId(userId);

  console.info("[RIDER LOGIN] Rider status:", rider.status);

  if (!rider) {
    throw ApiError.forbidden("This account is not registered as a rider.", {
      code: "RIDER_PROFILE_NOT_FOUND",
    });
  }

  /*
    |--------------------------------------------------------------------------
    | Rider Status
    |--------------------------------------------------------------------------
    */

  if (rider.status !== "ACTIVE") {
    throw ApiError.forbidden(
      `Rider account is ${rider.status.toLowerCase()}.`,
      {
        code: "RIDER_ACCOUNT_INACTIVE",

        details: {
          status: rider.status,
        },
      },
    );
  }

  /*
    |--------------------------------------------------------------------------
    | Reset Login Attempts
    |--------------------------------------------------------------------------
    */

  await resetFailedLoginAttempts(userId);

  /*
    |--------------------------------------------------------------------------
    | Update Last Login
    |--------------------------------------------------------------------------
    */

  await updateLastLogin(userId);

  /*
    |--------------------------------------------------------------------------
    | Generate Tokens
    |--------------------------------------------------------------------------
    */

  const tokenPair = generateTokenPair(rider._id.toString(), {
    role: "RIDER",
  });

  /*
    |--------------------------------------------------------------------------
    | Refresh Token Expiration
    |--------------------------------------------------------------------------
    */

  const expiresAt = getRefreshTokenExpirationDate(tokenPair.refreshToken);

  /*
    |--------------------------------------------------------------------------
    | Create Session
    |--------------------------------------------------------------------------
    */

  const session = await createSession({
    userId,

    refreshToken: tokenPair.refreshToken,

    userAgent: metadata?.userAgent,

    ipAddress: metadata?.ipAddress,

    deviceId: metadata?.deviceId,

    expiresAt,
  });

  /*
    |--------------------------------------------------------------------------
    | Result
    |--------------------------------------------------------------------------
    */

  return {
    accessToken: tokenPair.accessToken,

    refreshToken: tokenPair.refreshToken,

    riderId: rider._id,

    userId: user._id,

    sessionId: session._id,
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
  /*
        |--------------------------------------------------------------------------
        | Verify Refresh Token
        |--------------------------------------------------------------------------
        */

  let payload;

  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw ApiError.unauthorized("Invalid or expired refresh token.", {
      code: "INVALID_REFRESH_TOKEN",
    });
  }

  /*
        |--------------------------------------------------------------------------
        | Find Session
        |--------------------------------------------------------------------------
        */

  const session = await findSessionByRefreshToken(refreshToken);

  if (!session) {
    throw ApiError.unauthorized("Session is invalid, expired, or revoked.", {
      code: "INVALID_SESSION",
    });
  }

  /*
        |--------------------------------------------------------------------------
        | Canonical User
        |--------------------------------------------------------------------------
        */

  const userId = session.userId.toString();

  /*
        |--------------------------------------------------------------------------
        | Find Rider
        |--------------------------------------------------------------------------
        */

  const rider = await getRiderByUserId(userId);

  if (!rider) {
    await revokeUserSession(userId, session._id.toString());

    throw ApiError.forbidden("Rider profile was not found.", {
      code: "RIDER_PROFILE_NOT_FOUND",
    });
  }

  /*
        |--------------------------------------------------------------------------
        | Rider Status
        |--------------------------------------------------------------------------
        */

  if (rider.status !== "ACTIVE") {
    await revokeUserSession(userId, session._id.toString());

    throw ApiError.forbidden("Rider account is not active.", {
      code: "RIDER_ACCOUNT_INACTIVE",
    });
  }

  /*
        |--------------------------------------------------------------------------
        | Token Identity Protection
        |--------------------------------------------------------------------------
        */

  if (payload.sub !== rider._id.toString()) {
    await revokeUserSession(userId, session._id.toString());

    throw ApiError.unauthorized("Invalid refresh token.", {
      code: "TOKEN_IDENTITY_MISMATCH",
    });
  }

  /*
        |--------------------------------------------------------------------------
        | Generate New Token Pair
        |--------------------------------------------------------------------------
        */

  const newTokenPair = generateTokenPair(rider._id.toString(), {
    role: "RIDER",
  });

  /*
        |--------------------------------------------------------------------------
        | New Expiration
        |--------------------------------------------------------------------------
        */

  const newExpiresAt = getRefreshTokenExpirationDate(newTokenPair.refreshToken);

  /*
        |--------------------------------------------------------------------------
        | Revoke Old Session
        |--------------------------------------------------------------------------
        */

  await revokeUserSession(userId, session._id.toString());

  /*
        |--------------------------------------------------------------------------
        | Create New Session
        |--------------------------------------------------------------------------
        */

  const newSession = await createSession({
    userId,

    refreshToken: newTokenPair.refreshToken,

    expiresAt: newExpiresAt,
  });

  /*
        |--------------------------------------------------------------------------
        | Result
        |--------------------------------------------------------------------------
        */

  return {
    accessToken: newTokenPair.accessToken,

    refreshToken: newTokenPair.refreshToken,

    riderId: rider._id,

    userId: session.userId,

    sessionId: newSession._id,
  };
};

/*
|--------------------------------------------------------------------------
| Logout Rider
|--------------------------------------------------------------------------
*/

export const logoutRider = async (
  userId: string,
  sessionId: string,
): Promise<void> => {
  const revoked = await revokeUserSession(userId, sessionId);

  if (!revoked) {
    throw ApiError.unauthorized("Session is invalid or already revoked.", {
      code: "INVALID_SESSION",
    });
  }
};

/*
|--------------------------------------------------------------------------
| Touch Rider Session
|--------------------------------------------------------------------------
*/

export const touchRiderSession = async (sessionId: string) => {
  return touchSession(sessionId);
};
