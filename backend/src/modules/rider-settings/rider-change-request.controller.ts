import type { RequestHandler } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { getAuthenticatedRiderId } from "../../middlewares/riderAuth.middleware";
import { ApiError } from "../../utils/ApiError";
import { RiderChangeRequestModel } from "./rider-change-request.model";
import { createRiderChangeRequestSchema } from "./rider-change-request.validator";

export const createMyRiderChangeRequest: RequestHandler = asyncHandler(
  async (req, res) => {
    const riderId = getAuthenticatedRiderId(req);
    const input = createRiderChangeRequestSchema.parse(req.body);

    const pending = await RiderChangeRequestModel.exists({
      riderId,
      type: input.type,
      status: "PENDING",
    });

    if (pending) {
      throw ApiError.conflict(
        "A request of this type is already pending review.",
      );
    }

    const request = await RiderChangeRequestModel.create({
      riderId,
      type: input.type,
      requestedValues: input.requestedValues,
      status: "PENDING",
    });

    res.status(201).json({
      success: true,
      message: "Change request submitted for review.",
      data: request,
    });
  },
);

export const listMyRiderChangeRequests: RequestHandler = asyncHandler(
  async (req, res) => {
    const riderId = getAuthenticatedRiderId(req);

    const requests = await RiderChangeRequestModel.find({ riderId })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    res.status(200).json({
      success: true,
      data: requests,
    });
  },
);
