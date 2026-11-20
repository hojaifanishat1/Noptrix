import { Router } from "express";

import { sellerAuth } from "../../middlewares/sellerAuth.middleware";

import {
  requireSellerOnboardingCompleted,
} from "../onboarding/require-seller-onboarding.middleware";

import {
  getSellerOrderController,
  listSellerOrdersController,
} from "./seller-order.controller";

const router = Router();

/**
 * GET /seller-orders
 * List orders containing the authenticated seller's items.
 */
router.get(
  "/",
  sellerAuth,
  requireSellerOnboardingCompleted,
  listSellerOrdersController,
);

/**
 * GET /seller-orders/:orderId
 * Get the authenticated seller's portion of an order.
 */
router.get(
  "/:orderId",
  sellerAuth,
  requireSellerOnboardingCompleted,
  getSellerOrderController,
);

export default router;
