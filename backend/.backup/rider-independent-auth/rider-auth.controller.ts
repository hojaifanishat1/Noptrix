import { Request, Response } from "express";

import { asyncHandler } from "../../utils/asyncHandler";

import { ApiError } from "../../utils/ApiError";

import { getAuthenticatedRiderId } from "../../middlewares/riderAuth.middleware";

import { getRiderById } from "../riders/rider.service";

import { User } from "../users/user.model";

import {
  loginRider,
  refreshRiderToken,
  logoutRider,
} from "./rider-auth.service";

/*
|--------------------------------------------------------------------------
| Rider Login
|--------------------------------------------------------------------------
*/

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, phone, password } = req.body;

  /*
            |--------------------------------------------------------------------------
            | Validate Login Fields
            |--------------------------------------------------------------------------
            */

  if (typeof password !== "string") {
    throw ApiError.badRequest("Password is required.", {
      code: "PASSWORD_REQUIRED",
    });
  }

  if (typeof email !== "string" && typeof phone !== "string") {
    throw ApiError.badRequest("Email or phone is required.", {
      code: "LOGIN_IDENTIFIER_REQUIRED",
    });
  }

  /*
            |--------------------------------------------------------------------------
            | Login
            |--------------------------------------------------------------------------
            */

  const result = await loginRider(
    {
      email: typeof email === "string" ? email : undefined,

      phone: typeof phone === "string" ? phone : undefined,

      password,
    },
    {
      userAgent: req.get("user-agent"),

      ipAddress: req.ip,
    },
  );

  /*
            |--------------------------------------------------------------------------
            | Response
            |--------------------------------------------------------------------------
            */

  res.status(200).json({
    success: true,

    message: "Rider login successful.",

    data: {
      riderId: result.riderId,

      userId: result.userId,

      accessToken: result.accessToken,

      refreshToken: result.refreshToken,

      sessionId: result.sessionId,
    },
  });
});

/*
|--------------------------------------------------------------------------
| Refresh Rider Access Token
|--------------------------------------------------------------------------
*/

export const refreshToken = asyncHandler(
  async (req: Request, res: Response) => {
    const { refreshToken } = req.body;

    /*
            |--------------------------------------------------------------------------
            | Validate Refresh Token
            |--------------------------------------------------------------------------
            */

    if (typeof refreshToken !== "string") {
      throw ApiError.badRequest("Refresh token is required.", {
        code: "REFRESH_TOKEN_REQUIRED",
      });
    }

    /*
            |--------------------------------------------------------------------------
            | Refresh Token
            |--------------------------------------------------------------------------
            */

    const result = await refreshRiderToken(refreshToken);

    /*
            |--------------------------------------------------------------------------
            | Response
            |--------------------------------------------------------------------------
            */

    res.status(200).json({
      success: true,

      message: "Rider access token refreshed successfully.",

      data: {
        riderId: result.riderId,

        userId: result.userId,

        accessToken: result.accessToken,

        refreshToken: result.refreshToken,

        sessionId: result.sessionId,
      },
    });
  },
);

/*
|--------------------------------------------------------------------------
| Rider Logout
|--------------------------------------------------------------------------
*/

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const riderId = getAuthenticatedRiderId(req);

  if (!riderId) {
    throw ApiError.unauthorized("Authentication is required.", {
      code: "AUTHENTICATION_REQUIRED",
    });
  }

  /*
            |--------------------------------------------------------------------------
            | Session ID
            |--------------------------------------------------------------------------
            */

  const { sessionId } = req.body;

  if (typeof sessionId !== "string") {
    throw ApiError.badRequest("Session ID is required.", {
      code: "SESSION_ID_REQUIRED",
    });
  }

  /*
            |--------------------------------------------------------------------------
            | Find Rider
            |--------------------------------------------------------------------------
            */

  const rider = await getRiderById(riderId);

  if (!rider) {
    throw ApiError.unauthorized("Rider profile was not found.", {
      code: "RIDER_PROFILE_NOT_FOUND",
    });
  }

  /*
            |--------------------------------------------------------------------------
            | Logout
            |--------------------------------------------------------------------------
            */

  await logoutRider(rider.userId.toString(), sessionId);

  /*
            |--------------------------------------------------------------------------
            | Response
            |--------------------------------------------------------------------------
            */

  res.status(200).json({
    success: true,

    message: "Rider logout successful.",
  });
});

/*
|--------------------------------------------------------------------------
| Get Authenticated Rider
|--------------------------------------------------------------------------
*/

export const getMe = asyncHandler(async (req: Request, res: Response) => {
  const riderId = getAuthenticatedRiderId(req);

  const rider = await getRiderById(riderId);

  const user = await User.findById(rider.userId).select(
    "name email phone avatarUrl status",
  );

  if (!user || user.status !== "ACTIVE") {
    throw ApiError.unauthorized("Rider account is unavailable.", {
      code: "RIDER_ACCOUNT_UNAVAILABLE",
    });
  }

  if (rider.status !== "ACTIVE") {
    throw ApiError.forbidden("Rider account is not active.", {
      code: "RIDER_NOT_ACTIVE",
    });
  }

  res.status(200).json({
    success: true,
    message: "Rider profile retrieved successfully.",
    data: {
      id: rider.userId.toString(),
      riderId: rider._id.toString(),
      name: user.name,
      email: user.email ?? rider.email,
      phone: user.phone ?? rider.phone,
      avatarUrl: user.avatarUrl,
      accountType: "RIDER",
      role: "RIDER",
      riderCode: rider.riderCode,
      riderStatus: rider.status,
      vehicleType: rider.vehicleType,
      vehicleNumber: rider.vehicleNumber,
    },
  });
});
