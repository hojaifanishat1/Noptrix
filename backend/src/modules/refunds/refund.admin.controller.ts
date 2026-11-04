import type { Request, Response } from "express";

import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { getAuthenticatedAdminId } from "../../middlewares/adminAuth.middleware";
import { getAuthenticatedOwnerId } from "../../middlewares/ownerAuth.middleware";

import {
  cancelPendingRefund,
  processRefund,
} from "./refund.service";

import {
  confirmManualRefund,
  getAdminRefundDetails,
  getRefundAnalytics,
  listAdminRefunds,
} from "./refund.admin.service";

const getActorId = (req: Request): string => {
  if (req.ownerAuth?.ownerId) {
    return getAuthenticatedOwnerId(req);
  }

  if (req.adminAuth?.adminId) {
    return getAuthenticatedAdminId(req);
  }

  throw new ApiError(401, "Owner or administrator authentication required.");
};

export const listAdminRefundsController = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await listAdminRefunds(req.query as never);

    res.status(200).json({
      success: true,
      message: "Refunds retrieved successfully.",
      data: result.items,
      pagination: result.pagination,
    });
  },
);

export const getRefundAnalyticsController = asyncHandler(
  async (_req: Request, res: Response) => {
    const result = await getRefundAnalytics();

    res.status(200).json({
      success: true,
      message: "Refund analytics retrieved successfully.",
      data: result,
    });
  },
);

export const getAdminRefundDetailsController = asyncHandler(
  async (req: Request, res: Response) => {
    const refund = await getAdminRefundDetails(req.params.refundId);

    res.status(200).json({
      success: true,
      message: "Refund details retrieved successfully.",
      data: refund,
    });
  },
);

export const processAdminRefundController = asyncHandler(
  async (req: Request, res: Response) => {
    const refund = await processRefund(
      req.params.refundId,
      getActorId(req),
      req.body,
    );

    res.status(200).json({
      success: true,
      message: "Refund moved to processing.",
      data: refund,
    });
  },
);

export const cancelAdminRefundController = asyncHandler(
  async (req: Request, res: Response) => {
    const refund = await cancelPendingRefund(
      req.params.refundId,
      getActorId(req),
      req.body?.internalNote,
    );

    res.status(200).json({
      success: true,
      message: "Pending refund cancelled successfully.",
      data: refund,
    });
  },
);

export const confirmManualRefundController = asyncHandler(
  async (req: Request, res: Response) => {
    const refund = await confirmManualRefund(
      req.params.refundId,
      getActorId(req),
      req.body,
    );

    res.status(200).json({
      success: true,
      message: "Manual refund confirmation saved successfully.",
      data: refund,
    });
  },
);
