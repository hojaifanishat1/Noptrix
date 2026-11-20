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
  collectCODController,
  createCODController,
  getAllCODController,
  getCODByOrderController,
  getCODController,
  getMyCODController,
  remitCODController,
  reverseCODController,
} from "./cod.controller";

import {
  codIdParamSchema,
  codOrderIdParamSchema,
  codQuerySchema,
  collectCODSchema,
  createCODSchema,
  remitCODSchema,
  reverseCODSchema,
} from "./cod.validator";

const router = Router();

const ownerOnly = [ownerAuth, ownerSecretVerified];

router.post(
  "/",
  riderAuth,
  requireRiderOnboardingCompleted,
  validate(createCODSchema, "body"),
  createCODController,
);

router.get(
  "/mine",
  riderAuth,
  validate(codQuerySchema, "query"),
  getMyCODController,
);

router.patch(
  "/:codId/collect",
  riderAuth,
  requireRiderOnboardingCompleted,
  validate(codIdParamSchema, "params"),
  validate(collectCODSchema, "body"),
  collectCODController,
);

router.get(
  "/order/:orderId",
  ...ownerOnly,
  validate(codOrderIdParamSchema, "params"),
  getCODByOrderController,
);

router.patch(
  "/:codId/remit",
  ...ownerOnly,
  validate(codIdParamSchema, "params"),
  validate(remitCODSchema, "body"),
  remitCODController,
);

router.patch(
  "/:codId/reverse",
  ...ownerOnly,
  validate(codIdParamSchema, "params"),
  validate(reverseCODSchema, "body"),
  reverseCODController,
);

router.get(
  "/",
  ...ownerOnly,
  validate(codQuerySchema, "query"),
  getAllCODController,
);

router.get(
  "/:codId",
  ...ownerOnly,
  validate(codIdParamSchema, "params"),
  getCODController,
);

export default router;
