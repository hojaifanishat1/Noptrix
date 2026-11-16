import { Router } from "express";

import {
  validate,
} from "../../middlewares/validation.middleware";

import {
  riderAuth,
} from "../../middlewares/riderAuth.middleware";

import {
  login,
  verifyLogin,
  resendLoginCode,
  refreshToken,
  logout,
  getMe,
  changePassword,
} from "./rider-auth.controller";

import {
  riderLoginSchema,
  riderVerifyLoginSchema,
  riderResendLoginCodeSchema,
  riderRefreshTokenSchema,
  riderLogoutSchema,
  riderChangePasswordSchema,
} from "./rider-auth.validator";

const router = Router();

router.post(
  "/login",
  validate(riderLoginSchema),
  login,
);

router.post(
  "/verify-login",
  validate(riderVerifyLoginSchema),
  verifyLogin,
);

router.post(
  "/resend-login-code",
  validate(riderResendLoginCodeSchema),
  resendLoginCode,
);

router.post(
  "/refresh",
  validate(riderRefreshTokenSchema),
  refreshToken,
);

router.get(
  "/me",
  riderAuth,
  getMe,
);

router.post(
  "/logout",
  riderAuth,
  validate(riderLogoutSchema),
  logout,
);

router.post(
  "/change-password",
  riderAuth,
  validate(riderChangePasswordSchema),
  changePassword,
);

export default router;
