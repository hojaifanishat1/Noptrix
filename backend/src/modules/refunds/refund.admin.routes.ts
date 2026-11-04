import { Router } from "express";

import { ownerOrAdminAuth } from "../../middlewares/ownerOrAdminAuth.middleware";
import {
  loadAuthenticatedPermissions,
  requirePermission,
} from "../../middlewares/permission.middleware";
import { validate } from "../../middlewares/validation.middleware";

import {
  cancelAdminRefundController,
  confirmManualRefundController,
  getAdminRefundDetailsController,
  getRefundAnalyticsController,
  listAdminRefundsController,
  processAdminRefundController,
} from "./refund.admin.controller";

import {
  manualRefundSchema,
  processRefundSchema,
  refundIdParamsSchema,
  refundQuerySchema,
} from "./refund.validator";

const router = Router();

router.use(ownerOrAdminAuth);
router.use(loadAuthenticatedPermissions);

router.get(
  "/",
  requirePermission("refunds.read"),
  validate(refundQuerySchema, "query"),
  listAdminRefundsController,
);

router.get(
  "/analytics",
  requirePermission("refunds.read"),
  getRefundAnalyticsController,
);

router.get(
  "/:refundId",
  requirePermission("refunds.read"),
  validate(refundIdParamsSchema, "params"),
  getAdminRefundDetailsController,
);

router.post(
  "/:refundId/process",
  requirePermission("refunds.update"),
  validate(refundIdParamsSchema, "params"),
  validate(processRefundSchema),
  processAdminRefundController,
);

router.post(
  "/:refundId/cancel",
  requirePermission("refunds.update"),
  validate(refundIdParamsSchema, "params"),
  cancelAdminRefundController,
);

router.post(
  "/:refundId/confirm-manual",
  requirePermission("refunds.update"),
  validate(refundIdParamsSchema, "params"),
  validate(manualRefundSchema),
  confirmManualRefundController,
);

export default router;
