import type { RequestHandler } from "express";
import { Types } from "mongoose";

import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { Rider } from "../riders/rider.model";
import { RiderChangeRequestModel } from "./rider-change-request.model";

export const reviewRiderChangeRequest: RequestHandler = asyncHandler(
  async (req, res) => {
    const requestId = Array.isArray(req.params.requestId)
      ? req.params.requestId[0]
      : req.params.requestId;
    const { status, reviewNote } = req.body;

    if (!Types.ObjectId.isValid(requestId)) {
      throw ApiError.badRequest("Invalid request ID.");
    }

    if (!["APPROVED", "REJECTED"].includes(status)) {
      throw ApiError.badRequest("Invalid review status.");
    }

    if (
      reviewNote !== undefined &&
      (typeof reviewNote !== "string" || reviewNote.length > 1000)
    ) {
      throw ApiError.badRequest("Invalid review note.");
    }

    const request = await RiderChangeRequestModel.findOne({
      _id: requestId,
      status: "PENDING",
    });

    if (!request) {
      throw ApiError.notFound(
        "Pending Rider change request not found.",
      );
    }

    if (status === "APPROVED" && request.type === "VEHICLE") {
      const values = request.requestedValues;

      const rider = await Rider.findById(request.riderId);

      if (!rider) {
        throw ApiError.notFound("Rider not found.");
      }

      rider.vehicleType = values.vehicleType as "MOTORCYCLE" | "CAR" | "BICYCLE" | "VAN" | "OTHER";
      rider.vehicleNumber = String(values.vehicleNumber);
      rider.licenseNumber = String(values.licenseNumber);

      await rider.save();
    }

    request.status = status;
    request.reviewedAt = new Date();
    request.reviewNote = reviewNote?.trim() || null;

    await request.save();

    res.status(200).json({
      success: true,
      message: `Rider ${request.type.toLowerCase()} request ${status.toLowerCase()}.`,
      data: request,
    });
  },
);
