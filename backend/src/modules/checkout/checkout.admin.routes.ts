import { Router } from "express";

import { ownerOrAdminAuth } from "../../middlewares/ownerOrAdminAuth.middleware";
import {
  loadAuthenticatedPermissions,
  requirePermission,
} from "../../middlewares/permission.middleware";

import {
  getAdminCheckoutAnalyticsController,
  getAdminCheckoutDetailsController,
  getAdminCheckoutsController,
} from "./checkout.admin.controller";

const router = Router();

const adminRead = [
  ownerOrAdminAuth,
  loadAuthenticatedPermissions,
  requirePermission("checkout.read"),
];

router.get("/admin/analytics", ...adminRead, getAdminCheckoutAnalyticsController);
router.get("/admin", ...adminRead, getAdminCheckoutsController);
router.get("/admin/:checkoutId", ...adminRead, getAdminCheckoutDetailsController);

export default router;
