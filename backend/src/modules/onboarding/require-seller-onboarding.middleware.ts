import { Request, Response, NextFunction } from "express";
import { Seller } from "../sellers/seller.model";
import { getAuthenticatedSellerId } from "../../middlewares/sellerAuth.middleware";
import { ApiError } from "../../utils/ApiError";
import { asyncHandler } from "../../utils/asyncHandler";

export const requireSellerOnboardingCompleted = asyncHandler(
  async (
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const sellerId = getAuthenticatedSellerId(req);
    const seller = await Seller.findById(sellerId).select(
      "status onboardingStatus",
    );

    if (!seller) {
      throw ApiError.notFound("Seller account not found.");
    }

    if (seller.status !== "ACTIVE") {
      throw ApiError.forbidden("Seller account is not active.");
    }

    if (seller.onboardingStatus !== "COMPLETED") {
      throw ApiError.forbidden(
        "Complete seller onboarding and get all required documents approved before managing products.",
      );
    }

    next();
  },
);
