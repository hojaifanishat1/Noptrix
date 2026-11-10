import { Router } from "express";
import { ownerOrAdminAuth } from "../../middlewares/ownerOrAdminAuth.middleware";
import { DeliveryMethodController } from "./delivery-method.controller";

const router = Router();
router.use(ownerOrAdminAuth);
router.post("/", DeliveryMethodController.create);
router.get("/", DeliveryMethodController.list);
router.get("/:id", DeliveryMethodController.getById);
router.patch("/:id", DeliveryMethodController.update);
router.patch("/:id/status", DeliveryMethodController.setStatus);
router.delete("/:id", DeliveryMethodController.remove);

export default router;
