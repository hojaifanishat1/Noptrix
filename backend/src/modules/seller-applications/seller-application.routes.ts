import { Router } from "express";

import { userAuth } from "../../middlewares/userAuth.middleware";

import {
  ownerAuth,
  ownerSecretVerified,
} from "../../middlewares/ownerAuth.middleware";

import { validate } from "../../middlewares/validation.middleware";

import {
  createSellerApplicationController,
  getMySellerApplicationsController,
  getMySellerApplicationController,
  updateMySellerApplicationController,
  withdrawSellerApplicationController,
  getAllSellerApplicationsController,
  getSellerApplicationController,
  updateSellerApplicationStatusController,
  deleteSellerApplicationController,
  resendSellerApplicationInvitationController,
} from "./seller-application.controller";

import {
  createSellerApplicationSchema,
  updateSellerApplicationSchema,
  updateSellerApplicationStatusSchema,
  sellerApplicationIdParamSchema,
  sellerApplicationQuerySchema,
} from "./seller-application.validator";

const router = Router();

/*
|--------------------------------------------------------------------------
| USER
|--------------------------------------------------------------------------
*/

router.post(
  "/",
  userAuth,
  validate(createSellerApplicationSchema, "body"),
  createSellerApplicationController,
);

router.get(
  "/me",
  userAuth,
  validate(sellerApplicationQuerySchema, "query"),
  getMySellerApplicationsController,
);

router.get(
  "/me/:applicationId",
  userAuth,
  validate(sellerApplicationIdParamSchema, "params"),
  getMySellerApplicationController,
);

router.patch(
  "/me/:applicationId",
  userAuth,
  validate(sellerApplicationIdParamSchema, "params"),
  validate(updateSellerApplicationSchema, "body"),
  updateMySellerApplicationController,
);

router.post(
  "/me/:applicationId/withdraw",
  userAuth,
  validate(sellerApplicationIdParamSchema, "params"),
  withdrawSellerApplicationController,
);

/*
|--------------------------------------------------------------------------
| OWNER
|--------------------------------------------------------------------------
*/

const ownerOnly = [ownerAuth, ownerSecretVerified];

router.get(
  "/",
  ...ownerOnly,
  validate(sellerApplicationQuerySchema, "query"),
  getAllSellerApplicationsController,
);

router.get(
  "/:applicationId",
  ...ownerOnly,
  validate(sellerApplicationIdParamSchema, "params"),
  getSellerApplicationController,
);

router.patch(
  "/:applicationId/status",
  ...ownerOnly,
  validate(sellerApplicationIdParamSchema, "params"),
  validate(updateSellerApplicationStatusSchema, "body"),
  updateSellerApplicationStatusController,
);

router.delete(
  "/:applicationId",
  ...ownerOnly,
  validate(sellerApplicationIdParamSchema, "params"),
  deleteSellerApplicationController,
);

router.post(
  "/:applicationId/resend-invitation",
  ...ownerOnly,
  validate(sellerApplicationIdParamSchema, "params"),
  resendSellerApplicationInvitationController,
);

export default router;
