import { Router } from "express";

import {
  ownerAuth,
  ownerSecretVerified,
} from "../../middlewares/ownerAuth.middleware";

import { riderAuth } from "../../middlewares/riderAuth.middleware";

import { validate } from "../../middlewares/validation.middleware";

import {
  createRiderController,
  getAllRidersController,
  getRiderController,
  updateRiderController,
  updateRiderStatusController,
  deleteRiderController,
  getMyRiderController,
  updateMyRiderLocationController,
  updateMyRiderAvailabilityController,
  convertSelectedApplicationToRiderController,
} from "./rider.controller";

import {
  createRiderSchema,
  updateRiderSchema,
  updateRiderStatusSchema,
  riderIdParamSchema,
  riderQuerySchema,
  updateRiderLocationSchema,
  updateRiderAvailabilitySchema,
  riderApplicationIdParamSchema,
  convertSelectedApplicationToRiderSchema,
} from "./rider.validator";

const router = Router();

/*
|--------------------------------------------------------------------------
| RIDER
|--------------------------------------------------------------------------
*/

router.get("/me", riderAuth, getMyRiderController);

router.patch(
  "/me/location",
  riderAuth,
  validate(updateRiderLocationSchema, "body"),
  updateMyRiderLocationController,
);

router.patch(
  "/me/availability",
  riderAuth,
  validate(updateRiderAvailabilitySchema, "body"),
  updateMyRiderAvailabilityController,
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
  validate(createRiderSchema, "body"),
  createRiderController,
);

router.get(
  "/",
  ...ownerOnly,
  validate(riderQuerySchema, "query"),
  getAllRidersController,
);

router.post(
  "/applications/:applicationId/convert",
  ...ownerOnly,
  validate(riderApplicationIdParamSchema, "params"),
  validate(convertSelectedApplicationToRiderSchema, "body"),
  convertSelectedApplicationToRiderController,
);

router.get(
  "/:riderId",
  ...ownerOnly,
  validate(riderIdParamSchema, "params"),
  getRiderController,
);

router.patch(
  "/:riderId",
  ...ownerOnly,
  validate(riderIdParamSchema, "params"),
  validate(updateRiderSchema, "body"),
  updateRiderController,
);

router.patch(
  "/:riderId/status",
  ...ownerOnly,
  validate(riderIdParamSchema, "params"),
  validate(updateRiderStatusSchema, "body"),
  updateRiderStatusController,
);

router.delete(
  "/:riderId",
  ...ownerOnly,
  validate(riderIdParamSchema, "params"),
  deleteRiderController,
);

export default router;
