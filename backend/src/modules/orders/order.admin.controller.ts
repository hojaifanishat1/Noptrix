import type { Request, Response } from "express";

import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";

import {
  adminOrderParamsSchema,
  adminOrderQuerySchema,
  adminUpdateOrderStatusSchema,
} from "./order.admin.validator";

import { getAdminOrderById, listAdminOrders } from "./order.admin.service";

import { updateOrderStatus } from "./order.service";

const getOrderId = (req: Request): string => {
  const parsed = adminOrderParamsSchema.safeParse(req.params);

  if (!parsed.success) {
    throw ApiError.badRequest("Invalid order ID.", {
      code: "INVALID_ORDER_ID",
    });
  }

  return parsed.data.orderId;
};

export const getAdminOrdersController = asyncHandler(
  async (req: Request, res: Response) => {
    const parsed = adminOrderQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      throw ApiError.badRequest("Invalid order filters.", {
        code: "INVALID_ORDER_QUERY",
        details: parsed.error.issues,
      });
    }

    const result = await listAdminOrders(parsed.data);

    res.status(200).json({
      success: true,
      message: "Orders retrieved successfully.",
      data: result.items,
      pagination: result.pagination,
    });
  },
);

export const getAdminOrderDetailsController = asyncHandler(
  async (req: Request, res: Response) => {
    const order = await getAdminOrderById(getOrderId(req));

    res.status(200).json({
      success: true,
      message: "Order details retrieved successfully.",
      data: order,
    });
  },
);

export const updateAdminOrderStatusController = asyncHandler(
  async (req: Request, res: Response) => {
    const orderId = getOrderId(req);
    const parsed = adminUpdateOrderStatusSchema.safeParse(req.body);

    if (!parsed.success) {
      throw ApiError.badRequest("Invalid order status update.", {
        code: "INVALID_ORDER_STATUS_UPDATE",
        details: parsed.error.issues,
      });
    }

    const order = await updateOrderStatus(orderId, {
      status: parsed.data.status,
      notes: parsed.data.internalNote,
    });

    res.status(200).json({
      success: true,
      message: "Order status updated successfully.",
      data: order,
    });
  },
);
