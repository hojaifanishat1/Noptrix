import { Request, Response } from "express";

import { asyncHandler } from "../../utils/asyncHandler";

import { ApiResponse } from "../../utils/ApiResponse";

import { ApiError } from "../../utils/ApiError";

import { getAuthenticatedOwnerId } from "../../middlewares/ownerAuth.middleware";

import { getAuthenticatedRiderId } from "../../middlewares/riderAuth.middleware";

import {
  CreateRiderInput,
  UpdateRiderInput,
  UpdateRiderStatusInput,
  RiderQueryInput,
} from "./rider.validator";

import {
  createRider,
  getRiderById,
  getRiderByUserId,
  getAllRiders,
  updateRider,
  updateRiderStatus,
  deleteRider,
} from "./rider.service";

/*
|--------------------------------------------------------------------------
| OWNER
|--------------------------------------------------------------------------
*/

/**
 * Create rider
 */
export const createRiderController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const ownerId = getAuthenticatedOwnerId(req);

    const input = req.body as CreateRiderInput;

    const rider = await createRider(input, ownerId);

    res
      .status(201)
      .json(
        ApiResponse.created(rider, "Rider created successfully.").serialize(),
      );
  },
);

/**
 * Get all riders
 */
export const getAllRidersController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    getAuthenticatedOwnerId(req);

    const query = req.query as never as RiderQueryInput;

    const result = await getAllRiders(query);

    res
      .status(200)
      .json(
        ApiResponse.ok(result, "Riders retrieved successfully.").serialize(),
      );
  },
);

/**
 * Get rider by ID
 */
export const getRiderController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    getAuthenticatedOwnerId(req);

    const riderId = req.params.riderId;

    if (typeof riderId !== "string") {
      throw ApiError.badRequest("Invalid rider ID.");
    }

    const rider = await getRiderById(riderId);

    res
      .status(200)
      .json(ApiResponse.ok(rider, "Rider retrieved successfully.").serialize());
  },
);

/**
 * Update rider
 */
export const updateRiderController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const ownerId = getAuthenticatedOwnerId(req);

    const riderId = req.params.riderId;

    if (typeof riderId !== "string") {
      throw ApiError.badRequest("Invalid rider ID.");
    }

    const input = req.body as UpdateRiderInput;

    const rider = await updateRider(riderId, input, ownerId);

    res
      .status(200)
      .json(ApiResponse.ok(rider, "Rider updated successfully.").serialize());
  },
);

/**
 * Update rider status
 */
export const updateRiderStatusController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const ownerId = getAuthenticatedOwnerId(req);

    const riderId = req.params.riderId;

    if (typeof riderId !== "string") {
      throw ApiError.badRequest("Invalid rider ID.");
    }

    const input = req.body as UpdateRiderStatusInput;

    const rider = await updateRiderStatus(riderId, ownerId, input);

    res
      .status(200)
      .json(
        ApiResponse.ok(rider, "Rider status updated successfully.").serialize(),
      );
  },
);

/**
 * Delete rider
 */
export const deleteRiderController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    getAuthenticatedOwnerId(req);

    const riderId = req.params.riderId;

    if (typeof riderId !== "string") {
      throw ApiError.badRequest("Invalid rider ID.");
    }

    await deleteRider(riderId);

    res
      .status(200)
      .json(ApiResponse.ok(null, "Rider deleted successfully.").serialize());
  },
);

/*
|--------------------------------------------------------------------------
| RIDER
|--------------------------------------------------------------------------
*/

/**
 * Get my rider profile
 */
export const getMyRiderController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const riderUserId = getAuthenticatedRiderId(req);

    const rider = await getRiderByUserId(riderUserId);

    res
      .status(200)
      .json(
        ApiResponse.ok(
          rider,
          "Rider profile retrieved successfully.",
        ).serialize(),
      );
  },
);
