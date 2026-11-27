import { Router } from "express";
import { riderAuth } from "../../middlewares/riderAuth.middleware";
import { ownerAuth, ownerSecretVerified } from "../../middlewares/ownerAuth.middleware";
import { validate } from "../../middlewares/validation.middleware";

import {
  getMyRiderSettingsController,
  updateMyRiderSettingsController,
} from "./rider-settings.controller";

import {
  createMyRiderChangeRequest,
  listMyRiderChangeRequests,
} from "./rider-change-request.controller";

import { reviewRiderChangeRequest } from "./rider-change-review.controller";

import { updateRiderSettingsSchema } from "./rider-settings.validator";
import { createRiderChangeRequestSchema } from "./rider-change-request.validator";
import { reviewRiderChangeRequestSchema } from "./rider-change-review.validator";


import {
  listMyRiderSupportTickets,
  createMyRiderSupportTicket,
  getMyRiderSupportTicket,
  replyToMyRiderSupportTicket,
  closeMyRiderSupportTicket,
} from "./rider-support.controller";

import {
  createRiderSupportTicketSchema,
  riderSupportReplySchema,
} from "./rider-support.validator";

const router = Router();

router.get(
  "/review/requests",
  ownerAuth,
  ownerSecretVerified,
  async (req, res, next) => {
    try {
      const { RiderChangeRequestModel } = await import(
        "./rider-change-request.model.js"
      );

      const requests = await RiderChangeRequestModel.find()
        .sort({ createdAt: -1 })
        .limit(200)
        .lean();

      res.status(200).json({ success: true, data: requests });
    } catch (error) {
      next(error);
    }
  },
);

router.patch(
  "/review/requests/:requestId",
  ownerAuth,
  ownerSecretVerified,
  validate(reviewRiderChangeRequestSchema, "body"),
  reviewRiderChangeRequest,
);

router.use(riderAuth);

router.get("/me", getMyRiderSettingsController);

router.patch(
  "/me",
  validate(updateRiderSettingsSchema, "body"),
  updateMyRiderSettingsController,
);

router.get("/me/change-requests", listMyRiderChangeRequests);

router.post(
  "/me/change-requests",
  validate(createRiderChangeRequestSchema, "body"),
  createMyRiderChangeRequest,
);


router.get("/me/support-tickets", listMyRiderSupportTickets);

router.post(
  "/me/support-tickets",
  validate(createRiderSupportTicketSchema, "body"),
  createMyRiderSupportTicket,
);

router.get("/me/support-tickets/:ticketId", getMyRiderSupportTicket);

router.post(
  "/me/support-tickets/:ticketId/replies",
  validate(riderSupportReplySchema, "body"),
  replyToMyRiderSupportTicket,
);

router.patch(
  "/me/support-tickets/:ticketId/close",
  closeMyRiderSupportTicket,
);

export default router;
