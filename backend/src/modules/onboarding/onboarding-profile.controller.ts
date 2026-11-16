import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponse } from "../../utils/ApiResponse";

import {
  getAuthenticatedSellerId,
} from "../../middlewares/sellerAuth.middleware";

import {
  getAuthenticatedRiderId,
} from "../../middlewares/riderAuth.middleware";

import {
  refreshOnboardingCompletion,
  updateRiderOnboardingProfile,
  updateSellerOnboardingProfile,
} from "./onboarding-progress.service";

export const updateSellerOnboardingProfileController = asyncHandler(
  async (req, res): Promise<void> => {
    const sellerId = getAuthenticatedSellerId(req);

    const result = await updateSellerOnboardingProfile(
      sellerId,
      req.body,
    );

    res.json(
      ApiResponse.ok(
        result,
        "Seller onboarding profile updated.",
      ),
    );
  },
);

export const updateRiderOnboardingProfileController = asyncHandler(
  async (req, res): Promise<void> => {
    const riderId = getAuthenticatedRiderId(req);

    const result = await updateRiderOnboardingProfile(
      riderId,
      req.body,
    );

    res.json(
      ApiResponse.ok(
        result,
        "Rider onboarding profile updated.",
      ),
    );
  },
);

export const getSellerOnboardingProgressController = asyncHandler(
  async (req, res): Promise<void> => {
    const sellerId = getAuthenticatedSellerId(req);

    const progress = await refreshOnboardingCompletion(
      "SELLER",
      sellerId,
    );

    res.json(
      ApiResponse.ok(progress, "Seller onboarding progress retrieved."),
    );
  },
);

export const getRiderOnboardingProgressController = asyncHandler(
  async (req, res): Promise<void> => {
    const riderId = getAuthenticatedRiderId(req);

    const progress = await refreshOnboardingCompletion(
      "RIDER",
      riderId,
    );

    res.json(
      ApiResponse.ok(progress, "Rider onboarding progress retrieved."),
    );
  },
);
