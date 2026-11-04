import type { Request, Response } from "express";

import { ApiError } from "../../utils/ApiError";
import { asyncHandler } from "../../utils/asyncHandler";
import { getAuthenticatedUserId } from "../../middlewares/userAuth.middleware";

import {
  cancelCustomerReturn,
  completeReturn,
  createReturn,
  getCustomerReturn,
  inspectReturn,
  listCustomerReturns,
  reviewReturn,
} from "./return.service";

import type {
  CreateReturnInput,
  InspectReturnInput,
  ReturnListFilters,
  ReviewReturnInput,
} from "./return.types";

function getParam(value: string | string[] | undefined): string {
  if (typeof value !== "string" || !value.trim()) {
    throw ApiError.badRequest("A valid route parameter is required.");
  }

  return value;
}

export const createReturnController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getAuthenticatedUserId(req);

    const result = await createReturn(userId, req.body as CreateReturnInput);

    res.status(201).json({
      success: true,
      message: "Return request created successfully.",
      data: result,
    });
  },
);

export const getCustomerReturnController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getAuthenticatedUserId(req);
    const returnId = getParam(req.params.returnId);

    const result = await getCustomerReturn(userId, returnId);

    res.status(200).json({
      success: true,
      message: "Return request retrieved successfully.",
      data: result,
    });
  },
);

export const listCustomerReturnsController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getAuthenticatedUserId(req);

    const result = await listCustomerReturns(
      userId,
      req.query as unknown as ReturnListFilters,
    );

    res.status(200).json({
      success: true,
      message: "Return requests retrieved successfully.",
      data: result.items,
      pagination: result.pagination,
    });
  },
);

export const cancelCustomerReturnController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getAuthenticatedUserId(req);
    const returnId = getParam(req.params.returnId);

    const result = await cancelCustomerReturn(userId, returnId);

    res.status(200).json({
      success: true,
      message: "Return request cancelled successfully.",
      data: result,
    });
  },
);

/**
 * The following controllers must only be mounted on routes protected
 * by the project's admin authentication and authorization middleware.
 */
export const reviewReturnController = asyncHandler(
  async (req: Request, res: Response) => {
    const reviewerId = req.adminAuth?.adminId;
    const returnId = getParam(req.params.returnId);

    const result = await reviewReturn(
      returnId,
      reviewerId,
      req.body as ReviewReturnInput,
    );

    res.status(200).json({
      success: true,
      message: "Return request reviewed successfully.",
      data: result,
    });
  },
);

export const inspectReturnController = asyncHandler(
  async (req: Request, res: Response) => {
    const returnId = getParam(req.params.returnId);

    const result = await inspectReturn(
      returnId,
      req.body as InspectReturnInput,
    );

    res.status(200).json({
      success: true,
      message: "Return inspection saved successfully.",
      data: result,
    });
  },
);

export const completeReturnController = asyncHandler(
  async (req: Request, res: Response) => {
    const returnId = getParam(req.params.returnId);

    const result = await completeReturn(returnId);

    res.status(200).json({
      success: true,
      message: "Return request completed successfully.",
      data: result,
    });
  },
);

import {
  getAdminReturn,
  getAdminReturnAnalytics,
  listAdminReturns,
} from "./return.admin.service";

import type { ReturnStatus } from "./return.types";

export const listAdminReturnsController = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await listAdminReturns(
      req.query as {
        status?: ReturnStatus;
        orderId?: string;
        search?: string;
        page?: number;
        limit?: number;
        sort?: "newest" | "oldest";
      },
    );

    res.status(200).json({
      success: true,
      message: "Return requests retrieved successfully.",
      data: result.items,
      pagination: result.pagination,
    });
  },
);

export const getAdminReturnController = asyncHandler(
  async (req: Request, res: Response) => {
    const returnId = getParam(req.params.returnId);
    const result = await getAdminReturn(returnId);

    res.status(200).json({
      success: true,
      message: "Return request retrieved successfully.",
      data: result,
    });
  },
);

export const getAdminReturnAnalyticsController = asyncHandler(
  async (_req: Request, res: Response) => {
    const result = await getAdminReturnAnalytics();

    res.status(200).json({
      success: true,
      message: "Return analytics retrieved successfully.",
      data: result,
    });
  },
);
