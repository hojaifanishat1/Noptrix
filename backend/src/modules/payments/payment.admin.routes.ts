import { Router } from "express";

import { ownerOrAdminAuth } from "../../middlewares/ownerOrAdminAuth.middleware";

import {
  loadAuthenticatedPermissions,
  requirePermission,
} from "../../middlewares/permission.middleware";

import {
  getAdminPaymentDetails,
  getAdminPayments,
} from "./payment.admin.controller";

const router = Router();

router.use(ownerOrAdminAuth);
router.use(loadAuthenticatedPermissions);
router.use(requirePermission("payments.read"));

router.get("/admin", getAdminPayments);

router.get("/admin/:transactionId", getAdminPaymentDetails);

export default router;
