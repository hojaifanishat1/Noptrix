import { Request, Response } from "express";

import { asyncHandler } from "../../utils/asyncHandler";

import { ApiResponse } from "../../utils/ApiResponse";

import { ApiError } from "../../utils/ApiError";

import { getAuthenticatedOwnerId } from "../../middlewares/ownerAuth.middleware";

import { getAuthenticatedRiderId } from "../../middlewares/riderAuth.middleware";

import {
  CreateTrackingInput,
  UpdateTrackingInput,
  UpdateTrackingStatusInput,
  UpdateTrackingLocationInput,
  TrackingQueryInput,
  trackingQuerySchema,
} from "./tracking.validator";

import {
  createTracking,
  getTrackingById,
  getTrackingByOrderId,
  getAllTracking,
  updateTracking,
  updateTrackingStatus,
  updateTrackingLocation,
  assignRider,
} from "./tracking.service";

/*
|--------------------------------------------------------------------------
| OWNER
|--------------------------------------------------------------------------
*/

/**
 * Create tracking
 */
export const createTrackingController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const ownerId = getAuthenticatedOwnerId(req);

    const input = req.body as CreateTrackingInput;

    const tracking = await createTracking(input, ownerId);

    res
      .status(201)
      .json(
        ApiResponse.created(
          tracking,
          "Tracking created successfully.",
        ).serialize(),
      );
  },
);

/**
 * Get all tracking records
 */
export const getAllTrackingController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    getAuthenticatedOwnerId(req);

    const query = req.query as never as TrackingQueryInput;

    const result = await getAllTracking(query);

    res
      .status(200)
      .json(
        ApiResponse.ok(
          result,
          "Tracking records retrieved successfully.",
        ).serialize(),
      );
  },
);

/**
 * Get tracking by ID
 */
export const getTrackingController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    getAuthenticatedOwnerId(req);

    const trackingId = req.params.trackingId;

    if (typeof trackingId !== "string") {
      throw ApiError.badRequest("Invalid tracking ID.");
    }

    const tracking = await getTrackingById(trackingId);

    res
      .status(200)
      .json(
        ApiResponse.ok(
          tracking,
          "Tracking retrieved successfully.",
        ).serialize(),
      );
  },
);

/**
 * Get tracking by order
 */
export const getTrackingByOrderController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    getAuthenticatedOwnerId(req);

    const orderId = req.params.orderId;

    if (typeof orderId !== "string") {
      throw ApiError.badRequest("Invalid order ID.");
    }

    const tracking = await getTrackingByOrderId(orderId);

    res
      .status(200)
      .json(
        ApiResponse.ok(
          tracking,
          "Order tracking retrieved successfully.",
        ).serialize(),
      );
  },
);

/**
 * Update tracking
 */
export const updateTrackingController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const ownerId = getAuthenticatedOwnerId(req);

    const trackingId = req.params.trackingId;

    if (typeof trackingId !== "string") {
      throw ApiError.badRequest("Invalid tracking ID.");
    }

    const input = req.body as UpdateTrackingInput;

    const tracking = await updateTracking(trackingId, input, ownerId);

    res
      .status(200)
      .json(
        ApiResponse.ok(tracking, "Tracking updated successfully.").serialize(),
      );
  },
);

/**
 * Update tracking status
 */
export const updateTrackingStatusController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const ownerId = getAuthenticatedOwnerId(req);

    const trackingId = req.params.trackingId;

    if (typeof trackingId !== "string") {
      throw ApiError.badRequest("Invalid tracking ID.");
    }

    const input = req.body as UpdateTrackingStatusInput;

    const tracking = await updateTrackingStatus(trackingId, input, ownerId);

    res
      .status(200)
      .json(
        ApiResponse.ok(
          tracking,
          "Tracking status updated successfully.",
        ).serialize(),
      );
  },
);

/**
 * Assign rider
 */
export const assignRiderController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const ownerId = getAuthenticatedOwnerId(req);

    const trackingId = req.params.trackingId;

    if (typeof trackingId !== "string") {
      throw ApiError.badRequest("Invalid tracking ID.");
    }

    const riderId = req.body.riderId;

    if (typeof riderId !== "string") {
      throw ApiError.badRequest("Rider ID is required.");
    }

    const tracking = await assignRider(trackingId, riderId, ownerId);

    res
      .status(200)
      .json(
        ApiResponse.ok(tracking, "Rider assigned successfully.").serialize(),
      );
  },
);

/* 
|-------------------------------------------------------------------------- 
| RIDER — Own Assigned Tracking
|-------------------------------------------------------------------------- 
*/

export const getMyTrackingController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const riderId = getAuthenticatedRiderId(req);
    const query = trackingQuerySchema.parse(req.query);

    const result = await getAllTracking(
      {
        ...query,
        riderId,
      },
      true,
    );

    res.status(200).json(
      ApiResponse.ok(
        result,
        "Your assigned deliveries retrieved successfully.",
      ).serialize(),
    );
  },
);

/*
|--------------------------------------------------------------------------
| RIDER
|--------------------------------------------------------------------------
*/

/**
 * Rider updates current location
 */
export const updateMyTrackingLocationController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const riderUserId = getAuthenticatedRiderId(req);

    const trackingId = req.params.trackingId;

    if (typeof trackingId !== "string") {
      throw ApiError.badRequest("Invalid tracking ID.");
    }

    const input = req.body as UpdateTrackingLocationInput;

    const tracking = await updateTrackingLocation(
      trackingId,
      input,
      riderUserId,
    );

    res
      .status(200)
      .json(
        ApiResponse.ok(
          tracking,
          "Tracking location updated successfully.",
        ).serialize(),
      );
  },
);
