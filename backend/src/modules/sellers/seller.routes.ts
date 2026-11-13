import { Router } from "express";

import {
  ownerAuth,
  ownerSecretVerified,
} from "../../middlewares/ownerAuth.middleware";

import { sellerAuth } from "../../middlewares/sellerAuth.middleware";

import { validate } from "../../middlewares/validation.middleware";

import {
  createSellerController,
  getAllSellersController,
  getSellerController,
  updateSellerController,
  updateSellerStatusController,
  deleteSellerController,
  getMySellerController,
} from "./seller.controller";

import {
  createSellerSchema,
  updateSellerSchema,
  updateSellerStatusSchema,
  sellerIdParamSchema,
  sellerQuerySchema,
} from "./seller.validator";

const router = Router();

/*
|--------------------------------------------------------------------------
| SELLER SELF-SERVICE
|--------------------------------------------------------------------------
*/

/**
 * Get my seller profile
 *
 * GET /sellers/me
 */
router.get("/me", sellerAuth, getMySellerController);

/*
|--------------------------------------------------------------------------
| OWNER MANAGEMENT
|--------------------------------------------------------------------------
*/

const ownerOnly = [ownerAuth, ownerSecretVerified];

/**
 * Create seller
 *
 * POST /sellers
 */
router.post(
  "/",
  ...ownerOnly,
  validate(createSellerSchema, "body"),
  createSellerController,
);

/**
 * Get all sellers
 *
 * GET /sellers
 */
router.get(
  "/",
  ...ownerOnly,
  validate(sellerQuerySchema, "query"),
  getAllSellersController,
);

/**
 * Get seller by ID
 *
 * GET /sellers/:sellerId
 */
router.get(
  "/:sellerId",
  ...ownerOnly,
  validate(sellerIdParamSchema, "params"),
  getSellerController,
);

/**
 * Update seller
 *
 * PATCH /sellers/:sellerId
 */
router.patch(
  "/:sellerId",
  ...ownerOnly,
  validate(sellerIdParamSchema, "params"),
  validate(updateSellerSchema, "body"),
  updateSellerController,
);

/**
 * Update seller status
 *
 * PATCH /sellers/:sellerId/status
 */
router.patch(
  "/:sellerId/status",
  ...ownerOnly,
  validate(sellerIdParamSchema, "params"),
  validate(updateSellerStatusSchema, "body"),
  updateSellerStatusController,
);

/**
 * Delete seller
 *
 * DELETE /sellers/:sellerId
 */
router.delete(
  "/:sellerId",
  ...ownerOnly,
  validate(sellerIdParamSchema, "params"),
  deleteSellerController,
);

export default router;
