import { Router } from "express";

import { riderAuth } from "../../../middlewares/riderAuth.middleware";
import { validateRequest } from "../../../middlewares/validation.middleware";

import {
  messageIdParamSchema,
  messageListQuerySchema,
  messageReplySchema,
} from "./message.validator";

import {
  createRiderMessageReplyController,
  getRiderMessageInboxController,
  getRiderMessageThreadController,
  getRiderUnreadMessageCountController,
} from "./rider-message.controller";

const router = Router();

router.use(riderAuth);

router.get(
  "/inbox",
  validateRequest({ query: messageListQuerySchema }),
  getRiderMessageInboxController,
);

router.get(
  "/unread-count",
  getRiderUnreadMessageCountController,
);

router.get(
  "/:messageId/thread",
  validateRequest({ params: messageIdParamSchema }),
  getRiderMessageThreadController,
);

router.post(
  "/:messageId/replies",
  validateRequest({
    params: messageIdParamSchema,
    body: messageReplySchema,
  }),
  createRiderMessageReplyController,
);

export default router;
