import { Request, Response, NextFunction, RequestHandler } from "express";

import { verifyAccessToken, type AccessTokenPayload } from "../utils/token";

import { buildOwnerAuthContext } from "./ownerAuth.middleware";

import { buildAdminAuthContext } from "./adminAuth.middleware";

/*
|--------------------------------------------------------------------------
| Owner OR Admin Authentication
|--------------------------------------------------------------------------
|
| Shared authentication middleware for protected administrative modules.
|
| OWNER:
|     req.ownerAuth
|
| ADMIN:
|     req.adminAuth
|
| The JWT is verified only once.
|
|--------------------------------------------------------------------------
*/

export const ownerOrAdminAuth: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const authorizationHeader = req.headers.authorization;

  if (typeof authorizationHeader !== "string") {
    res.status(401).json({
      success: false,
      message: "Owner or admin authentication required.",
    });

    return;
  }

  const normalized = authorizationHeader.trim();

  const parts = normalized.split(/\s+/);

  if (parts.length !== 2 || parts[0]?.toLowerCase() !== "bearer" || !parts[1]) {
    res.status(401).json({
      success: false,
      message: "Invalid authentication header.",
    });

    return;
  }

  const token = parts[1];

  try {
    const payload: AccessTokenPayload = verifyAccessToken(token);

    /*
        |--------------------------------------------------------------------------
        | Access Token Validation
        |--------------------------------------------------------------------------
        */

    if (payload.tokenType !== "access") {
      res.status(401).json({
        success: false,
        message: "Invalid authentication token.",
      });

      return;
    }

    /*
        |--------------------------------------------------------------------------
        | Role Resolution
        |--------------------------------------------------------------------------
        */

    const role =
      typeof payload.role === "string" ? payload.role.trim().toUpperCase() : "";

    if (!role) {
      res.status(403).json({
        success: false,
        message: "Administrative role is required.",
      });

      return;
    }

    /*
        |--------------------------------------------------------------------------
        | OWNER
        |--------------------------------------------------------------------------
        */

    if (role === "OWNER") {
      req.ownerAuth = buildOwnerAuthContext(payload);

      next();
      return;
    }

    /*
        |--------------------------------------------------------------------------
        | ADMIN
        |--------------------------------------------------------------------------
        */

    req.adminAuth = buildAdminAuthContext(payload);

    next();
  } catch {
    res.status(401).json({
      success: false,
      message: "Invalid or expired authentication token.",
    });

    return;
  }
};

export const ownerOrAdminSecretVerified: RequestHandler = (
  req,
  res,
  next,
): void => {
  const isVerified =
    req.ownerAuth?.secretVerified === true ||
    req.adminAuth?.secretVerified === true;

  if (!isVerified) {
    res.status(403).json({
      success: false,
      message: "Administrative secret verification is required.",
    });
    return;
  }

  next();
};