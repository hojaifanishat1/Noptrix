import { Router } from "express";

import { validate } from "../../middlewares/validation.middleware";
import {
  acceptSellerInvitationController,
  getSellerInvitationPreviewController,
} from "./seller-invitation.controller";
import {
  acceptSellerInvitationSchema,
  sellerInvitationTokenParamsSchema,
} from "./seller-invitation.validator";

const router = Router();


router.get(
  "/:token",
  validate(sellerInvitationTokenParamsSchema, "params"),
  getSellerInvitationPreviewController,
);

router.post(
  "/accept",
  validate(acceptSellerInvitationSchema, "body"),
  acceptSellerInvitationController,
);

export default router;
