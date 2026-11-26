import type { Request, Response } from "express";

import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { env } from "../../config/env";

import { Rider } from "../riders/rider.model";

import {
  getAuthenticatedRiderId,
} from "../../middlewares/riderAuth.middleware";

import {
  loginRider,
  verifyRiderLoginChallenge,
  resendRiderLoginChallenge,
  refreshRiderToken,
  logoutRider,
  changeRiderPassword,
} from "./rider-auth.service";

import {
  getTokenExpiration,
} from "../../utils/token";

const RIDER_REFRESH_COOKIE = "noptrix_rider_rt";
const RIDER_REFRESH_COOKIE_PATH = "/api/rider-auth";

const getRiderCookieOptions = () => ({
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: "strict" as const,
  path: RIDER_REFRESH_COOKIE_PATH,
  ...(env.COOKIE_DOMAIN
    ? { domain: env.COOKIE_DOMAIN }
    : {}),
});

const setRiderRefreshCookie = (
  res: Response,
  refreshToken: string,
): void => {
  const expiration = getTokenExpiration(refreshToken);

  if (!expiration || expiration <= Date.now()) {
    throw ApiError.internal(
      "Could not determine Rider refresh-token expiry.",
    );
  }

  res.cookie(
    RIDER_REFRESH_COOKIE,
    refreshToken,
    {
      ...getRiderCookieOptions(),
      expires: new Date(expiration),
      maxAge: expiration - Date.now(),
    },
  );
};

const clearRiderRefreshCookie = (
  res: Response,
): void => {
  res.clearCookie(
    RIDER_REFRESH_COOKIE,
    getRiderCookieOptions(),
  );
};

const getRiderRefreshCookie = (
  req: Request,
): string | undefined => {
  const value = req.cookies?.[RIDER_REFRESH_COOKIE];

  return typeof value === "string" && value.trim()
    ? value
    : undefined;
};

const safeSessionResponse = (result: {
  accessToken: string;
  riderId: { toString(): string };
  sessionId: { toString(): string };
}) => ({
  accessToken: result.accessToken,
  riderId: result.riderId.toString(),
  sessionId: result.sessionId.toString(),
});

/*
|--------------------------------------------------------------------------
| Login
|--------------------------------------------------------------------------
*/

export const login = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      email,
      phone,
      password,
    } = req.body;

    if (typeof password !== "string") {
      throw ApiError.badRequest(
        "Password is required.",
      );
    }

    const result = await loginRider({
      email:
        typeof email === "string"
          ? email
          : undefined,

      phone:
        typeof phone === "string"
          ? phone
          : undefined,

      password,
    });

    res.status(200).json({
      success: true,
      message: "Rider login verification code sent.",
      data: result,
    });
  },
);

/*
|--------------------------------------------------------------------------
| Verify Login OTP
|--------------------------------------------------------------------------
*/

export const verifyLogin = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      challengeId,
      code,
    } = req.body;

    const result = await verifyRiderLoginChallenge(
      challengeId,
      code,
    );

    setRiderRefreshCookie(
      res,
      result.refreshToken,
    );

    res.status(200).json({
      success: true,
      message: "Rider login successful.",
      data: safeSessionResponse(result),
    });
  },
);

/*
|--------------------------------------------------------------------------
| Resend Login OTP
|--------------------------------------------------------------------------
*/

export const resendLoginCode = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      challengeId,
    } = req.body;

    const result = await resendRiderLoginChallenge(
      challengeId,
    );

    res.status(200).json({
      success: true,
      message: "Rider login verification code resent.",
      data: result,
    });
  },
);

/*
|--------------------------------------------------------------------------
| Refresh
|--------------------------------------------------------------------------
*/

export const refreshToken = asyncHandler(
  async (req: Request, res: Response) => {
    const refreshToken = getRiderRefreshCookie(req);

    if (!refreshToken) {
      throw ApiError.unauthorized(
        "Rider refresh session is missing.",
        {
          code: "MISSING_REFRESH_TOKEN",
        },
      );
    }

    const result = await refreshRiderToken(
      refreshToken,
    );

    setRiderRefreshCookie(
      res,
      result.refreshToken,
    );

    res.status(200).json({
      success: true,
      message: "Rider access token refreshed successfully.",
      data: safeSessionResponse(result),
    });
  },
);

/*
|--------------------------------------------------------------------------
| Logout
|--------------------------------------------------------------------------
*/

export const logout = asyncHandler(
  async (req: Request, res: Response) => {
    const riderId = getAuthenticatedRiderId(req);
    const refreshToken = getRiderRefreshCookie(req);

    await logoutRider(
      riderId,
      refreshToken,
    );

    clearRiderRefreshCookie(res);

    res.status(200).json({
      success: true,
      message: "Rider logout successful.",
    });
  },
);

/*
|--------------------------------------------------------------------------
| Current Rider
|--------------------------------------------------------------------------
*/

export const getMe = asyncHandler(
  async (req: Request, res: Response) => {
    const riderId = getAuthenticatedRiderId(req);

    const rider = await Rider.findById(riderId);

    if (!rider) {
      throw ApiError.notFound(
        "Rider profile was not found.",
      );
    }

    if (rider.status !== "ACTIVE") {
      throw ApiError.forbidden(
        "Rider account is not active.",
      );
    }

    res.status(200).json({
      success: true,
      message: "Rider profile retrieved successfully.",
      data: {
        id: rider._id.toString(),
        riderId: rider._id.toString(),
        name: rider.name,
        email: rider.email,
        phone: rider.phone,
        accountType: "RIDER",
        role: "RIDER",
        riderCode: rider.riderCode,
        riderStatus: rider.status,
        onboardingStatus: rider.onboardingStatus,
        vehicleType: rider.vehicleType,
        vehicleNumber: rider.vehicleNumber,
        isAvailable: rider.isAvailable,
        currentLatitude: rider.currentLatitude,
        currentLongitude: rider.currentLongitude,
        lastLocationAt: rider.lastLocationAt,
      },
    });
  },
);

/*
|--------------------------------------------------------------------------
| Change Password
|--------------------------------------------------------------------------
*/

export const changePassword = asyncHandler(
  async (req: Request, res: Response) => {
    const riderId = getAuthenticatedRiderId(req);

    const {
      currentPassword,
      newPassword,
    } = req.body;

    await changeRiderPassword(
      riderId,
      currentPassword,
      newPassword,
    );

    clearRiderRefreshCookie(res);

    res.status(200).json({
      success: true,
      message:
        "Rider password changed successfully. Please log in again.",
    });
  },
);
