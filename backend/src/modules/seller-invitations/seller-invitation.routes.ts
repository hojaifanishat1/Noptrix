import { Router } from "express";

import { validate } from "../../middlewares/validation.middleware";

import {
  ownerOrAdminAuth,
  ownerOrAdminSecretVerified,
} from "../../middlewares/ownerOrAdminAuth.middleware";

import {
  loadAuthenticatedPermissions,
  requirePermission,
} from "../../middlewares/permission.middleware";

import {
  acceptSellerInvitationController,
  getSellerInvitationPreviewController,
  getAllSellerInvitationsController,
  revokeSellerInvitationController,
} from "./seller-invitation.controller";

import {
  acceptSellerInvitationSchema,
  sellerInvitationTokenParamsSchema,
  sellerInvitationIdParamSchema,
  sellerInvitationAdminQuerySchema,
} from "./seller-invitation.validator";

const router = Router();

const administrativeAccess = [
  ownerOrAdminAuth,
  ownerOrAdminSecretVerified,
  loadAuthenticatedPermissions,
];

/*
|--------------------------------------------------------------------------
| ADMIN ROUTES
|--------------------------------------------------------------------------
| Keep these routes before /:token.
|--------------------------------------------------------------------------
*/

router.get(
  "/admin",
  ...administrativeAccess,
  requirePermission("seller_applications.read"),
  validate(sellerInvitationAdminQuerySchema, "query"),
  getAllSellerInvitationsController,
);

router.post(
  "/admin/:invitationId/revoke",
  ...administrativeAccess,
  requirePermission("seller_applications.invite"),
  validate(sellerInvitationIdParamSchema, "params"),
  revokeSellerInvitationController,
);

/*
|--------------------------------------------------------------------------
| PUBLIC ROUTES
|--------------------------------------------------------------------------
*/

router.get(
  "/:token",
  validate(sellerInvitationTokenParamsSchema, "params"),
  getSellerInvitationPreviewController,
);

router.post(
  "/accept",
  validate(acceptSellerInvitationSchema, "body"),
  acceptSellerInvitationController,
);

export default router;
