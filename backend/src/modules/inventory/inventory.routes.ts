import { Router, type RequestHandler } from "express";
import { adminAuth } from "../../middlewares/adminAuth.middleware";
import { hasPermissionMatch } from "../../middlewares/permission.middleware";
import { validate } from "../../middlewares/validation.middleware";
import {
  listInventoryController,
  getInventoryController,
  getProductStockCapacityController,
  setLowStockThresholdController,
  adjustInventoryController,
} from "./inventory.controller";
import {
  inventoryIdParamsSchema,
  inventoryProductParamsSchema,
  inventoryListQuerySchema,
  setLowStockThresholdSchema,
  inventoryAdjustmentSchema,
} from "./inventory.validator";

const router = Router();

const requireInventoryPermission =
  (permission: string): RequestHandler =>
  (req, res, next) => {
    const admin = req.adminAuth;

    if (!admin) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required." });
      return;
    }

    if (admin.role === "OWNER") {
      next();
      return;
    }

    req.permissions = Object.freeze([...(admin.permissions ?? [])]);

    if (!hasPermissionMatch(req, permission)) {
      res.status(403).json({ success: false, message: "Permission denied." });
      return;
    }

    next();
  };

router.use(adminAuth);

router.get(
  "/",
  requireInventoryPermission("inventory.read"),
  validate(inventoryListQuerySchema, "query"),
  listInventoryController,
);

router.get(
  "/products/:productId/stock-capacity",
  requireInventoryPermission("inventory.read"),
  validate(inventoryProductParamsSchema, "params"),
  getProductStockCapacityController,
);

router.get(
  "/:id",
  requireInventoryPermission("inventory.read"),
  validate(inventoryIdParamsSchema, "params"),
  getInventoryController,
);

router.patch(
  "/:id/low-stock-threshold",
  requireInventoryPermission("inventory.update"),
  validate(inventoryIdParamsSchema, "params"),
  validate(setLowStockThresholdSchema, "body"),
  setLowStockThresholdController,
);

router.post(
  "/:id/adjustments",
  requireInventoryPermission("inventory.update"),
  validate(inventoryIdParamsSchema, "params"),
  validate(inventoryAdjustmentSchema, "body"),
  adjustInventoryController,
);

export default router;
