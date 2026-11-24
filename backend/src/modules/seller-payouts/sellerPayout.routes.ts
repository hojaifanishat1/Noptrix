import { Router } from "express";

import { ownerOrAdminAuth } from "../../middlewares/ownerOrAdminAuth.middleware";
import {
  loadAuthenticatedPermissions,
  requirePermission,
} from "../../middlewares/permission.middleware";
import { validate } from "../../middlewares/validation.middleware";

import {
  generateSellerPayoutsController,
  listSellerPayoutsController,
  updateSellerPayoutStatusController,
} from "./sellerPayout.controller";

import {
  generateSellerPayoutSchema,
  sellerPayoutIdParamsSchema,
  sellerPayoutQuerySchema,
  updateSellerPayoutStatusSchema,
} from "./sellerPayout.validator";

const router = Router();

router.use(ownerOrAdminAuth);
router.use(loadAuthenticatedPermissions);

router.get(
  "/",
  requirePermission("seller_payouts.read"),
  validate(sellerPayoutQuerySchema, "query"),
  listSellerPayoutsController,
);

router.post(
  "/generate",
  requirePermission("seller_payouts.update"),
  validate(generateSellerPayoutSchema),
  generateSellerPayoutsController,
);

router.patch(
  "/:payoutId/status",
  requirePermission("seller_payouts.update"),
  validate(sellerPayoutIdParamsSchema, "params"),
  validate(updateSellerPayoutStatusSchema),
  updateSellerPayoutStatusController,
);

export default router;
