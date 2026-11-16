import type { Request, Response } from "express";

import { asyncHandler } from "../../utils/asyncHandler";

import { ApiError } from "../../utils/ApiError";

import { getAuthenticatedOwnerId } from "../../middlewares/ownerAuth.middleware";

import { getAuthenticatedRiderId } from "../../middlewares/riderAuth.middleware";


import {
  createRiderEarning,
  getRiderEarningById,
  listRiderEarnings,
  updateRiderEarning,
  updateRiderEarningStatus,
  deleteRiderEarning,
  getRiderEarningSummary,
  getRiderEarningsByRider,
  requireRiderEarningForRider,
} from "./riderEarning.service";

import {
  createRiderEarningSchema,
  updateRiderEarningSchema,
  updateRiderEarningStatusSchema,
  riderEarningIdParamSchema,
  riderEarningRiderIdParamSchema,
  riderEarningQuerySchema,
} from "./riderEarning.validator";

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

const getValidatedQuery = (req: Request) => {
  return riderEarningQuerySchema.parse(req.query);
};

/*
|--------------------------------------------------------------------------
| OWNER
|--------------------------------------------------------------------------
*/

export const createRiderEarningController = asyncHandler(
  async (req: Request, res: Response) => {
    const input = createRiderEarningSchema.parse(req.body);

    const ownerId = getAuthenticatedOwnerId(req);

    const earning = await createRiderEarning({
      ...input,
      createdBy: ownerId,
    });

    res.status(201).json({
      success: true,
      data: earning,
    });
  },
);

export const getRiderEarningController = asyncHandler(
  async (req: Request, res: Response) => {
    const { earningId } = riderEarningIdParamSchema.parse(req.params);

    const earning = await getRiderEarningById(earningId);

    res.status(200).json({
      success: true,
      data: earning,
    });
  },
);

export const getAllRiderEarningsController = asyncHandler(
  async (req: Request, res: Response) => {
    const query = getValidatedQuery(req);

    const result = await listRiderEarnings(query);

    res.status(200).json({
      success: true,
      data: result.earnings,
      pagination: result.pagination,
    });
  },
);

export const getRiderEarningsByRiderController = asyncHandler(
  async (req: Request, res: Response) => {
    const { riderId } = riderEarningRiderIdParamSchema.parse(req.params);

    const query = getValidatedQuery(req);

    const result = await getRiderEarningsByRider(riderId, query);

    res.status(200).json({
      success: true,
      data: result.earnings,
      pagination: result.pagination,
    });
  },
);

export const updateRiderEarningController = asyncHandler(
  async (req: Request, res: Response) => {
    const { earningId } = riderEarningIdParamSchema.parse(req.params);

    const input = updateRiderEarningSchema.parse(req.body);

    const ownerId = getAuthenticatedOwnerId(req);

    const earning = await updateRiderEarning(earningId, {
      ...input,
      updatedBy: ownerId,
    });

    res.status(200).json({
      success: true,
      data: earning,
    });
  },
);

export const updateRiderEarningStatusController = asyncHandler(
  async (req: Request, res: Response) => {
    const { earningId } = riderEarningIdParamSchema.parse(req.params);

    const input = updateRiderEarningStatusSchema.parse(req.body);

    const ownerId = getAuthenticatedOwnerId(req);

    const earning = await updateRiderEarningStatus(earningId, {
      ...input,
      updatedBy: ownerId,
    });

    res.status(200).json({
      success: true,
      data: earning,
    });
  },
);

export const deleteRiderEarningController = asyncHandler(
  async (req: Request, res: Response) => {
    const { earningId } = riderEarningIdParamSchema.parse(req.params);

    await deleteRiderEarning(earningId);

    res.status(200).json({
      success: true,
      message: "Rider earning deleted successfully.",
    });
  },
);

/*
|--------------------------------------------------------------------------
| RIDER
|--------------------------------------------------------------------------
*/

export const getMyRiderEarningsController = asyncHandler(
  async (req: Request, res: Response) => {
    const riderId = getAuthenticatedRiderId(req);
    const query = getValidatedQuery(req);
    const result = await getRiderEarningsByRider(riderId, query);

    res.status(200).json({
      success: true,
      data: result,
    });
  },
);

export const getMyRiderEarningController = asyncHandler(
  async (req: Request, res: Response) => {
    const { earningId } = riderEarningIdParamSchema.parse(req.params);
    const riderId = getAuthenticatedRiderId(req);
    const earning = await requireRiderEarningForRider(earningId, riderId);

    res.status(200).json({
      success: true,
      data: earning,
    });
  },
);

export const getMyRiderEarningSummaryController = asyncHandler(
  async (req: Request, res: Response) => {
    const riderId = getAuthenticatedRiderId(req);

    const query = getValidatedQuery(req);

    const summary = await getRiderEarningSummary(riderId, query.currency);

    res.status(200).json({
      success: true,
      data: summary,
    });
  },
);
