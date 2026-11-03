import { Router } from "express";

import { ownerOrAdminAuth } from "../../middlewares/ownerOrAdminAuth.middleware";

import {
  loadAuthenticatedPermissions,
  requirePermission,
} from "../../middlewares/permission.middleware";

import {
  getPaymentMethods,
  getAdminPaymentMethods,
  updateAdminPaymentMethod,
} from "./payment-method.controller";

const router = Router();

/**
 * GET /payment-methods
 * Public payment-method discovery.
 * Provider credentials and secrets are never returned.
 */
router.get("/", getPaymentMethods);

/**
 * GET /payment-methods/admin
 * Requires an authenticated owner/admin with the manage permission.
 */
router.get(
  "/admin",
  ownerOrAdminAuth,
  loadAuthenticatedPermissions,
  requirePermission("payment_methods.manage"),
  getAdminPaymentMethods,
);

/**
 * PATCH /payment-methods/admin/:methodId
 * Requires an authenticated owner/admin with the manage permission.
 */
router.patch(
  "/admin/:methodId",
  ownerOrAdminAuth,
  loadAuthenticatedPermissions,
  requirePermission("payment_methods.manage"),
  updateAdminPaymentMethod,
);

export default router;
