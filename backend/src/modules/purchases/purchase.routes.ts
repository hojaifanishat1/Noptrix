import { Router } from "express";

import {
  adminAuth,
  adminSecretVerified,
} from "../../middlewares/adminAuth.middleware";
import { validate } from "../../middlewares/validation.middleware";

import {
  approvePurchaseController,
  cancelPurchaseController,
  createPurchaseController,
  getPurchaseByNumberController,
  getPurchaseController,
  getPurchaseSummaryController,
  listPurchasesController,
  linkPurchaseItemProductController,
  orderPurchaseController,
  receivePurchaseController,
  recordPurchasePaymentController,
  updatePurchaseController,
} from "./purchase.controller";

import {
  approvePurchaseSchema,
  cancelPurchaseSchema,
  createPurchaseSchema,
  purchaseIdSchema,
  purchaseQuerySchema,
  purchaseNumberSchema,
  orderPurchaseSchema,
  receivePurchaseSchema,
  recordPurchasePaymentSchema,
  updatePurchaseSchema,
  linkPurchaseItemProductSchema,
  purchaseItemProductParamsSchema,
} from "./purchase.validator";

const router = Router();

router.use(adminAuth, adminSecretVerified);

// Summary
router.get("/summary", getPurchaseSummaryController);

// List and create
router.get(
  "/",
  validate(purchaseQuerySchema, "query"),
  listPurchasesController,
);

router.post("/", validate(createPurchaseSchema), createPurchaseController);

// Look up by purchase number
router.get(
  "/number/:purchaseNumber",
  validate(purchaseNumberSchema, "params"),
  getPurchaseByNumberController,
);

// Get one purchase
router.get("/:id", validate(purchaseIdSchema, "params"), getPurchaseController);

// Update draft purchase
router.patch(
  "/:id",
  validate(purchaseIdSchema, "params"),
  validate(updatePurchaseSchema),
  updatePurchaseController,
);

router.patch(
  "/:id/items/:itemId/product",
  validate(purchaseItemProductParamsSchema, "params"),
  validate(linkPurchaseItemProductSchema),
  linkPurchaseItemProductController,
);

// Workflow actions
router.post(
  "/:id/approve",
  validate(purchaseIdSchema, "params"),
  validate(approvePurchaseSchema),
  approvePurchaseController,
);

router.post(
  "/:id/order",
  validate(purchaseIdSchema, "params"),
  validate(orderPurchaseSchema),
  orderPurchaseController,
);

router.post(
  "/:id/receive",
  validate(purchaseIdSchema, "params"),
  validate(receivePurchaseSchema),
  receivePurchaseController,
);

router.post(
  "/:id/payments",
  validate(purchaseIdSchema, "params"),
  validate(recordPurchasePaymentSchema),
  recordPurchasePaymentController,
);

router.post(
  "/:id/cancel",
  validate(purchaseIdSchema, "params"),
  validate(cancelPurchaseSchema),
  cancelPurchaseController,
);

export default router;
