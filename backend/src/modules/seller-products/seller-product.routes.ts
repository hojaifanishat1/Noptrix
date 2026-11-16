import { Router } from "express";
import { sellerAuth } from "../../middlewares/sellerAuth.middleware";
import { requireSellerOnboardingCompleted } from "../onboarding/require-seller-onboarding.middleware";
import { ownerOrAdminAuth } from "../../middlewares/ownerOrAdminAuth.middleware";
import {
  validate,
  validateRequest,
} from "../../middlewares/validation.middleware";
import {
  createSellerProductController,
  listSellerProductsController,
  getSellerProductController,
  updateSellerProductController,
  archiveSellerProductController,
  resubmitSellerProductController,
  listPendingSellerProductsController,
  reviewSellerProductController,
} from "./seller-product.controller";
import {
  sellerProductCreateSchema,
  sellerProductIdSchema,
  sellerProductListSchema,
  sellerProductUpdateParamsSchema,
  sellerProductUpdateBodySchema,
  sellerProductReviewParamsSchema,
  sellerProductReviewBodySchema,
} from "./seller-product.validator";

const router = Router();

/*
 * Administrative endpoints must be registered before sellerAuth.
 * OWNER and ADMIN are authenticated by the existing middleware.
 */
router.get(
  "/admin/pending",
  ownerOrAdminAuth,
  listPendingSellerProductsController,
);

router.patch(
  "/admin/:id/review",
  ownerOrAdminAuth,
  validate(sellerProductReviewParamsSchema, "params"),
  validate(sellerProductReviewBodySchema, "body"),
  reviewSellerProductController,
);

/* All remaining endpoints require seller authentication. */
router.use(sellerAuth);
router.use(requireSellerOnboardingCompleted);

router.get(
  "/",
  validateRequest({ query: sellerProductListSchema.shape.query }),
  listSellerProductsController,
);

router.post(
  "/",
  validateRequest({ body: sellerProductCreateSchema.shape.body }),
  createSellerProductController,
);

router.get(
  "/:id",
  validate(sellerProductIdSchema, "params"),
  getSellerProductController,
);

router.patch(
  "/:id",
  validate(sellerProductUpdateParamsSchema, "params"),
  validate(sellerProductUpdateBodySchema, "body"),
  updateSellerProductController,
);

router.post(
  "/:id/resubmit",
  validate(sellerProductIdSchema, "params"),
  resubmitSellerProductController,
);

router.delete(
  "/:id",
  validate(sellerProductIdSchema, "params"),
  archiveSellerProductController,
);

export default router;
