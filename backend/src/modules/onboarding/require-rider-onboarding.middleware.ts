import { Request, Response, NextFunction } from "express";

import { Rider } from "../riders/rider.model";

import {
  getAuthenticatedRiderId,
} from "../../middlewares/riderAuth.middleware";

import { ApiError } from "../../utils/ApiError";
import { asyncHandler } from "../../utils/asyncHandler";

export const requireRiderOnboardingCompleted = asyncHandler(
  async (
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const riderId = getAuthenticatedRiderId(req);

    const rider = await Rider.findById(riderId)
      .select("status onboardingStatus")
      .lean()
      .exec();

    if (!rider) {
      throw ApiError.notFound("Rider account not found.");
    }

    if (rider.status !== "ACTIVE") {
      throw ApiError.forbidden(
        "Rider account is not active.",
      );
    }

    if (rider.onboardingStatus !== "COMPLETED") {
      throw ApiError.forbidden(
        "Complete rider onboarding and get all required documents approved before performing delivery operations.",
      );
    }

    next();
  },
);
