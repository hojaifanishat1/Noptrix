import { Router } from "express";

import { riderAuth } from "../../../middlewares/riderAuth.middleware";
import { validateRequest } from "../../../middlewares/validation.middleware";

import {
  announcementIdParamSchema,
  announcementRecipientListQuerySchema,
} from "./announcement.validator";

import {
  getRiderAnnouncementsController,
  getRiderAnnouncementController,
  markRiderAnnouncementReadController,
} from "./rider-announcement.controller";

const router = Router();

router.use(riderAuth);

router.get(
  "/mine",
  validateRequest({ query: announcementRecipientListQuerySchema }),
  getRiderAnnouncementsController,
);

router.get(
  "/mine/:announcementId",
  validateRequest({ params: announcementIdParamSchema }),
  getRiderAnnouncementController,
);

router.patch(
  "/:announcementId/read",
  validateRequest({ params: announcementIdParamSchema }),
  markRiderAnnouncementReadController,
);

export default router;
