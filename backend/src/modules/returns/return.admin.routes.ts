import { Router } from "express";

import { ownerOrAdminAuth } from "../../middlewares/ownerOrAdminAuth.middleware";
import { loadAuthenticatedPermissions } from "../../middlewares/permission.middleware";
import { requirePermission } from "../../middlewares/permission.middleware";
import { validate } from "../../middlewares/validation.middleware";

import {
  completeReturnController,
  getAdminReturnAnalyticsController,
  getAdminReturnController,
  inspectReturnController,
  listAdminReturnsController,
  reviewReturnController,
} from "./return.controller";

import {
  inspectReturnSchema,
  returnIdParamsSchema,
  reviewReturnSchema,
} from "./return.validator";

import { adminReturnQuerySchema } from "./return.admin.validator";

const router = Router();

const readAccess = [
  ownerOrAdminAuth,
  loadAuthenticatedPermissions,
  requirePermission("returns.read"),
];

const updateAccess = [
  ownerOrAdminAuth,
  loadAuthenticatedPermissions,
  requirePermission("returns.update"),
];

router.get("/analytics", ...readAccess, getAdminReturnAnalyticsController);

router.get(
  "/",
  ...readAccess,
  validate(adminReturnQuerySchema, "query"),
  listAdminReturnsController,
);

router.get(
  "/:returnId",
  ...readAccess,
  validate(returnIdParamsSchema, "params"),
  getAdminReturnController,
);

router.patch(
  "/:returnId/review",
  ...updateAccess,
  validate(returnIdParamsSchema, "params"),
  validate(reviewReturnSchema),
  reviewReturnController,
);

router.patch(
  "/:returnId/inspection",
  ...updateAccess,
  validate(returnIdParamsSchema, "params"),
  validate(inspectReturnSchema),
  inspectReturnController,
);

router.patch(
  "/:returnId/complete",
  ...updateAccess,
  validate(returnIdParamsSchema, "params"),
  completeReturnController,
);

export default router;
