import { Router, RequestHandler } from "express";

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
  createSellerOpportunityController,
  getSellerOpportunityController,
  getSellerOpportunityBySlugController,
  getSellerOpportunitiesController,
  getPublicSellerOpportunitiesController,
  updateSellerOpportunityController,
  updateSellerOpportunityStatusController,
  publishSellerOpportunityController,
  pauseSellerOpportunityController,
  closeSellerOpportunityController,
  deleteSellerOpportunityController,
} from "./seller-opportunity.controller";

import {
  createSellerOpportunitySchema,
  updateSellerOpportunitySchema,
  sellerOpportunityIdParamSchema,
  sellerOpportunitySlugParamSchema,
  updateSellerOpportunityStatusSchema,
  sellerOpportunityQuerySchema,
} from "./seller-opportunity.validator";

const router = Router();

/*
|--------------------------------------------------------------------------
| PUBLIC ROUTES
|--------------------------------------------------------------------------
*/

router.get(
  "/public",
  validate(sellerOpportunityQuerySchema, "query"),
  getPublicSellerOpportunitiesController,
);

router.get(
  "/public/:slug",
  validate(sellerOpportunitySlugParamSchema, "params"),
  getSellerOpportunityBySlugController,
);

/*
|--------------------------------------------------------------------------
| OWNER / ADMIN ACCESS
|--------------------------------------------------------------------------
*/

const administrativeAccess = [
  ownerOrAdminAuth,
  ownerOrAdminSecretVerified,
  loadAuthenticatedPermissions,
];

/*
|--------------------------------------------------------------------------
| CREATE
|--------------------------------------------------------------------------
*/

router.post(
  "/",
  ...administrativeAccess,
  requirePermission("seller_opportunities.create"),
  validate(createSellerOpportunitySchema, "body"),
  createSellerOpportunityController,
);

/*
|--------------------------------------------------------------------------
| READ
|--------------------------------------------------------------------------
*/

router.get(
  "/",
  ...administrativeAccess,
  requirePermission("seller_opportunities.read"),
  validate(sellerOpportunityQuerySchema, "query"),
  getSellerOpportunitiesController,
);

router.get(
  "/:opportunityId",
  ...administrativeAccess,
  requirePermission("seller_opportunities.read"),
  validate(sellerOpportunityIdParamSchema, "params"),
  getSellerOpportunityController,
);

/*
|--------------------------------------------------------------------------
| UPDATE
|--------------------------------------------------------------------------
*/

router.patch(
  "/:opportunityId",
  ...administrativeAccess,
  requirePermission("seller_opportunities.update"),
  validate(sellerOpportunityIdParamSchema, "params"),
  validate(updateSellerOpportunitySchema, "body"),
  updateSellerOpportunityController,
);

/*
|--------------------------------------------------------------------------
| STATUS
|--------------------------------------------------------------------------
*/

const requireOpportunityStatusPermission: RequestHandler = (
  req,
  res,
  next,
) => {
  const status = req.body?.status;

  const permission =
    status === "PUBLISHED"
      ? "seller_opportunities.publish"
      : status === "CLOSED"
        ? "seller_opportunities.close"
        : "seller_opportunities.update";

  requirePermission(permission)(req, res, next);
};

router.patch(
  "/:opportunityId/status",
  ...administrativeAccess,
  validate(sellerOpportunityIdParamSchema, "params"),
  validate(updateSellerOpportunityStatusSchema, "body"),
  requireOpportunityStatusPermission,
  updateSellerOpportunityStatusController,
);

/*
|--------------------------------------------------------------------------
| LIFECYCLE SHORTCUTS
|--------------------------------------------------------------------------
*/

router.post(
  "/:opportunityId/publish",
  ...administrativeAccess,
  requirePermission("seller_opportunities.publish"),
  validate(sellerOpportunityIdParamSchema, "params"),
  publishSellerOpportunityController,
);

router.post(
  "/:opportunityId/pause",
  ...administrativeAccess,
  requirePermission("seller_opportunities.update"),
  validate(sellerOpportunityIdParamSchema, "params"),
  pauseSellerOpportunityController,
);

router.post(
  "/:opportunityId/close",
  ...administrativeAccess,
  requirePermission("seller_opportunities.close"),
  validate(sellerOpportunityIdParamSchema, "params"),
  closeSellerOpportunityController,
);

/*
|--------------------------------------------------------------------------
| DELETE
|--------------------------------------------------------------------------
*/

router.delete(
  "/:opportunityId",
  ...administrativeAccess,
  requirePermission("seller_opportunities.delete"),
  validate(sellerOpportunityIdParamSchema, "params"),
  deleteSellerOpportunityController,
);

export default router;
