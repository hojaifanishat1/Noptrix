import { Router } from "express";
import { ownerOrAdminAuth } from "../../middlewares/ownerOrAdminAuth.middleware";
import {
  loadAuthenticatedPermissions,
  requirePermission,
} from "../../middlewares/permission.middleware";
import { validate } from "../../middlewares/validation.middleware";
import {
  generateRiderPayoutsController,
  listRiderPayoutsController,
  updateRiderPayoutStatusController,
} from "./riderPayout.controller";
import {
  generateRiderPayoutSchema,
  riderPayoutIdParamsSchema,
  riderPayoutQuerySchema,
  updateRiderPayoutStatusSchema,
} from "./riderPayout.validator";

const router = Router();

router.use(ownerOrAdminAuth);
router.use(loadAuthenticatedPermissions);

router.get(
  "/",
  requirePermission("rider_payouts.read"),
  validate(riderPayoutQuerySchema, "query"),
  listRiderPayoutsController,
);

router.post(
  "/generate",
  requirePermission("rider_payouts.update"),
  validate(generateRiderPayoutSchema),
  generateRiderPayoutsController,
);

router.patch(
  "/:payoutId/status",
  requirePermission("rider_payouts.update"),
  validate(riderPayoutIdParamsSchema, "params"),
  validate(updateRiderPayoutStatusSchema),
  updateRiderPayoutStatusController,
);

export default router;
