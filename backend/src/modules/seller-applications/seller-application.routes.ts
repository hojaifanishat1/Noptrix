
import { Router, RequestHandler } from "express";

import { userAuth } from "../../middlewares/userAuth.middleware";

import {
  ownerOrAdminAuth,
  ownerOrAdminSecretVerified,
} from "../../middlewares/ownerOrAdminAuth.middleware";

import {
  loadAuthenticatedPermissions,
  requirePermission,
} from "../../middlewares/permission.middleware";

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
| CUSTOMER ROUTES
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
| OWNER / ADMIN ROUTES
|--------------------------------------------------------------------------
*/

const administrativeAccess = [
  ownerOrAdminAuth,
  ownerOrAdminSecretVerified,
  loadAuthenticatedPermissions,
];

/*
 * Status changes require different permissions:
 * APPROVED      -> seller_applications.approve
 * REJECTED      -> seller_applications.reject
 * Other changes -> seller_applications.update
 */
const requireSellerApplicationStatusPermission: RequestHandler = (
  req,
  res,
  next,
) => {
  const status = req.body?.status;

  const permission =
    status === "APPROVED"
      ? "seller_applications.approve"
      : status === "REJECTED"
        ? "seller_applications.reject"
        : "seller_applications.update";

  requirePermission(permission)(req, res, next);
};

/*
|--------------------------------------------------------------------------
| READ
|--------------------------------------------------------------------------
*/

router.get(
  "/",
  ...administrativeAccess,
  requirePermission("seller_applications.read"),
  validate(sellerApplicationQuerySchema, "query"),
  getAllSellerApplicationsController,
);

router.get(
  "/:applicationId",
  ...administrativeAccess,
  requirePermission("seller_applications.read"),
  validate(sellerApplicationIdParamSchema, "params"),
  getSellerApplicationController,
);

/*
|--------------------------------------------------------------------------
| UPDATE / APPROVE / REJECT
|--------------------------------------------------------------------------
*/

router.patch(
  "/:applicationId/status",
  ...administrativeAccess,
  validate(sellerApplicationIdParamSchema, "params"),
  validate(updateSellerApplicationStatusSchema, "body"),
  requireSellerApplicationStatusPermission,
  updateSellerApplicationStatusController,
);

/*
|--------------------------------------------------------------------------
| DELETE
|--------------------------------------------------------------------------
*/

router.delete(
  "/:applicationId",
  ...administrativeAccess,
  requirePermission("seller_applications.delete"),
  validate(sellerApplicationIdParamSchema, "params"),
  deleteSellerApplicationController,
);

/*
|--------------------------------------------------------------------------
| RESEND INVITATION
|--------------------------------------------------------------------------
*/

router.post(
  "/:applicationId/resend-invitation",
  ...administrativeAccess,
  requirePermission("seller_applications.invite"),
  validate(sellerApplicationIdParamSchema, "params"),
  resendSellerApplicationInvitationController,
);

export default router;
