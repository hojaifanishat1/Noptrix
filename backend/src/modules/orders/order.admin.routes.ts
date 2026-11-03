import { Router } from "express";

import { ownerOrAdminAuth } from "../../middlewares/ownerOrAdminAuth.middleware";
import {
  loadAuthenticatedPermissions,
  requirePermission,
} from "../../middlewares/permission.middleware";

import {
  getAdminOrderDetailsController,
  getAdminOrdersController,
  updateAdminOrderStatusController,
} from "./order.admin.controller";

const router = Router();

const adminRead = [
  ownerOrAdminAuth,
  loadAuthenticatedPermissions,
  requirePermission("orders.read"),
];

const adminUpdate = [
  ownerOrAdminAuth,
  loadAuthenticatedPermissions,
  requirePermission("orders.update"),
];

router.get("/admin", ...adminRead, getAdminOrdersController);

router.get("/admin/:orderId", ...adminRead, getAdminOrderDetailsController);

router.patch(
  "/admin/:orderId/status",
  ...adminUpdate,
  updateAdminOrderStatusController,
);

export default router;
