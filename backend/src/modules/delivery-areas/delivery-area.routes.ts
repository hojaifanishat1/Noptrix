import { Router } from "express";
import { ownerOrAdminAuth } from "../../middlewares/ownerOrAdminAuth.middleware";
import { DeliveryAreaController } from "./delivery-area.controller";
import { DeliveryEligibilityService } from "./delivery-eligibility.service";

const router = Router();

router.post("/check-eligibility", async (req, res, next) => {
  try {
    const result = await DeliveryEligibilityService.check(req.body);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
});


router.use(ownerOrAdminAuth);
router.post("/", DeliveryAreaController.create);
router.get("/", DeliveryAreaController.list);
router.get("/:id", DeliveryAreaController.getById);
router.patch("/:id", DeliveryAreaController.update);
router.patch("/:id/status", DeliveryAreaController.setStatus);
router.delete("/:id", DeliveryAreaController.remove);

export default router;
