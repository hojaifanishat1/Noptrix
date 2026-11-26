import { Router } from "express";

import { DeliveryController } from "./delivery.controller";
import { ownerOrAdminAuth } from "../../middlewares/ownerOrAdminAuth.middleware";
import { riderAuth } from "../../middlewares/riderAuth.middleware";

const router = Router();

// Rider: own assigned deliveries only
router.get("/my-deliveries", riderAuth, DeliveryController.myDeliveries);

// Owner/admin endpoints
router.use(ownerOrAdminAuth);

router.post("/", DeliveryController.create);
router.get("/", DeliveryController.list);
router.get("/:id", DeliveryController.getById);

router.patch("/:id/assign-rider", DeliveryController.assignRider);
router.patch("/:id/status", DeliveryController.updateStatus);
router.patch("/:id/cancel", DeliveryController.cancel);

export default router;
