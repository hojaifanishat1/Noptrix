import { Router } from "express";

import { ownerOrAdminAuth } from "../../middlewares/ownerOrAdminAuth.middleware";
import {
  loadAuthenticatedPermissions,
  requirePermission,
} from "../../middlewares/permission.middleware";

import {
  getAdminCancellationAnalyticsController,
  getAdminCancellationDetailsController,
  getAdminCancellationsController,
} from "./cancellation.admin.controller";

import { reviewCancellationController } from "./cancellation.controller";

import { validate } from "../../middlewares/validation.middleware";

import {
  cancellationIdParamsSchema,
  reviewCancellationSchema,
} from "./cancellation.validator";

const router = Router();

const adminRead = [
  ownerOrAdminAuth,
  loadAuthenticatedPermissions,
  requirePermission("cancellations.read"),
];

const adminUpdate = [
  ownerOrAdminAuth,
  loadAuthenticatedPermissions,
  requirePermission("cancellations.update"),
];

router.get(
  "/admin/analytics",
  ...adminRead,
  getAdminCancellationAnalyticsController,
);

router.get(
  "/admin",
  ...adminRead,
  getAdminCancellationsController,
);

router.get(
  "/admin/:cancellationId",
  ...adminRead,
  validate(cancellationIdParamsSchema, "params"),
  getAdminCancellationDetailsController,
);

router.patch(
  "/admin/:cancellationId/review",
  ...adminUpdate,
  validate(cancellationIdParamsSchema, "params"),
  validate(reviewCancellationSchema),
  reviewCancellationController,
);

export default router;
