import type { Request, Response } from "express";

import { ApiError } from "../../utils/ApiError";
import { asyncHandler } from "../../utils/asyncHandler";

import {
  getAdminCancellationAnalytics,
  getAdminCancellationById,
  listAdminCancellations,
} from "./cancellation.admin.service";

import {
  adminCancellationParamsSchema,
  adminCancellationQuerySchema,
} from "./cancellation.admin.validator";

const getCancellationId = (req: Request): string => {
  const parsed = adminCancellationParamsSchema.safeParse(req.params);

  if (!parsed.success) {
    throw ApiError.badRequest("Invalid cancellation ID.", {
      code: "INVALID_CANCELLATION_ID",
      details: parsed.error.issues,
    });
  }

  return parsed.data.cancellationId;
};

export const getAdminCancellationsController = asyncHandler(
  async (req: Request, res: Response) => {
    const parsed = adminCancellationQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      throw ApiError.badRequest("Invalid cancellation filters.", {
        code: "INVALID_CANCELLATION_QUERY",
        details: parsed.error.issues,
      });
    }

    const result = await listAdminCancellations(parsed.data);

    res.status(200).json({
      success: true,
      message: "Cancellation requests retrieved successfully.",
      data: result.items,
      pagination: result.pagination,
    });
  },
);

export const getAdminCancellationDetailsController = asyncHandler(
  async (req: Request, res: Response) => {
    const cancellation = await getAdminCancellationById(
      getCancellationId(req),
    );

    res.status(200).json({
      success: true,
      message: "Cancellation details retrieved successfully.",
      data: cancellation,
    });
  },
);

export const getAdminCancellationAnalyticsController = asyncHandler(
  async (_req: Request, res: Response) => {
    const analytics = await getAdminCancellationAnalytics();

    res.status(200).json({
      success: true,
      message: "Cancellation analytics retrieved successfully.",
      data: analytics,
    });
  },
);
