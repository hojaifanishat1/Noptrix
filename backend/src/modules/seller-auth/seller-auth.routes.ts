import { Router } from "express";

import { validate } from "../../middlewares/validation.middleware";
import { sellerAuth } from "../../middlewares/sellerAuth.middleware";

import {
    loginSellerController,
    refreshSellerTokenController,
    logoutSellerController,
    changeSellerPasswordController,
    getSellerMeController,
    verifySellerLoginController,
    resendSellerLoginCodeController,
} from "./seller-auth.controller";

import {
    sellerLoginSchema,
    sellerRefreshTokenSchema,
    sellerLogoutSchema,
    sellerChangePasswordSchema,
    sellerVerifyLoginSchema,
    sellerResendLoginCodeSchema,
} from "./seller-auth.validator";

const router = Router();

router.post(
    "/login",
    validate(sellerLoginSchema, "body"),
    loginSellerController,
);

router.post(
    "/verify-login",
    validate(sellerVerifyLoginSchema, "body"),
    verifySellerLoginController,
);

router.post(
    "/resend-login-code",
    validate(sellerResendLoginCodeSchema, "body"),
    resendSellerLoginCodeController,
);

router.post(
    "/refresh",
    validate(sellerRefreshTokenSchema, "body"),
    refreshSellerTokenController,
);

router.get(
    "/me",
    sellerAuth,
    getSellerMeController,
);

router.post(
    "/logout",
    sellerAuth,
    validate(sellerLogoutSchema, "body"),
    logoutSellerController,
);

router.post(
    "/change-password",
    sellerAuth,
    validate(sellerChangePasswordSchema, "body"),
    changeSellerPasswordController,
);

export default router;