import { Router } from "express";
import { ownerOrAdminAuth } from "../../middlewares/ownerOrAdminAuth.middleware";
import { AreaFeeOverrideController } from "./area-fee-override.controller";

const router = Router();
router.use(ownerOrAdminAuth);
router.post("/", AreaFeeOverrideController.create);
router.get("/", AreaFeeOverrideController.list);
router.get("/:id", AreaFeeOverrideController.getById);
router.patch("/:id", AreaFeeOverrideController.update);
router.patch("/:id/status", AreaFeeOverrideController.setStatus);
router.delete("/:id", AreaFeeOverrideController.remove);

export default router;
