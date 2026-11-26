import { Router } from "express";

import {
  ownerAuth,
  ownerSecretVerified,
} from "../../middlewares/ownerAuth.middleware";

import { riderAuth } from "../../middlewares/riderAuth.middleware";

import {
  requireRiderOnboardingCompleted,
} from "../onboarding/require-rider-onboarding.middleware";

import { validate } from "../../middlewares/validation.middleware";

import {
  createTrackingController,
  getAllTrackingController,
  getTrackingController,
  getTrackingByOrderController,
  updateTrackingController,
  updateTrackingStatusController,
  assignRiderController,
  updateMyTrackingLocationController,
  getMyTrackingController,
} from "./tracking.controller";

import {
  createTrackingSchema,
  updateTrackingSchema,
  updateTrackingStatusSchema,
  updateTrackingLocationSchema,
  trackingIdParamSchema,
  trackingOrderIdParamSchema,
  trackingQuerySchema,
} from "./tracking.validator";

const router = Router();

/*
|--------------------------------------------------------------------------
| RIDER
|--------------------------------------------------------------------------
*/

router.get(
  "/me",
  riderAuth,
  requireRiderOnboardingCompleted,
  validate(trackingQuerySchema, "query"),
  getMyTrackingController,
);

router.patch(
  "/:trackingId/location",
  riderAuth,
  requireRiderOnboardingCompleted,
  validate(trackingIdParamSchema, "params"),
  validate(updateTrackingLocationSchema, "body"),
  updateMyTrackingLocationController,
  getMyTrackingController,
);

/*
|--------------------------------------------------------------------------
| OWNER
|--------------------------------------------------------------------------
*/

const ownerOnly = [ownerAuth, ownerSecretVerified];

router.post(
  "/",
  ...ownerOnly,
  validate(createTrackingSchema, "body"),
  createTrackingController,
);

router.get(
  "/",
  ...ownerOnly,
  validate(trackingQuerySchema, "query"),
  getAllTrackingController,
);

router.get(
  "/order/:orderId",
  ...ownerOnly,
  validate(trackingOrderIdParamSchema, "params"),
  getTrackingByOrderController,
);

router.get(
  "/:trackingId",
  ...ownerOnly,
  validate(trackingIdParamSchema, "params"),
  getTrackingController,
);

router.patch(
  "/:trackingId",
  ...ownerOnly,
  validate(trackingIdParamSchema, "params"),
  validate(updateTrackingSchema, "body"),
  updateTrackingController,
);

router.patch(
  "/:trackingId/status",
  ...ownerOnly,
  validate(trackingIdParamSchema, "params"),
  validate(updateTrackingStatusSchema, "body"),
  updateTrackingStatusController,
);

router.patch(
  "/:trackingId/assign-rider",
  ...ownerOnly,
  validate(trackingIdParamSchema, "params"),
  assignRiderController,
);

export default router;
