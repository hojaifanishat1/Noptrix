import type { Request, Response } from "express";

import { ApiError } from "../../utils/ApiError";
import { asyncHandler } from "../../utils/asyncHandler";

import {
  adminCheckoutParamsSchema,
  adminCheckoutQuerySchema,
} from "./checkout.admin.validator";

import {
  getAdminCheckoutAnalytics,
  getAdminCheckoutById,
  listAdminCheckouts,
} from "./checkout.admin.service";

const getCheckoutId = (req: Request) => {
  const parsed = adminCheckoutParamsSchema.safeParse(req.params);

  if (!parsed.success) {
    throw ApiError.badRequest("Invalid checkout ID.", {
      code: "INVALID_CHECKOUT_ID",
      details: parsed.error.issues,
    });
  }

  return parsed.data.checkoutId;
};

export const getAdminCheckoutsController = asyncHandler(
  async (req: Request, res: Response) => {
    const parsed = adminCheckoutQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      throw ApiError.badRequest("Invalid checkout filters.", {
        code: "INVALID_CHECKOUT_QUERY",
        details: parsed.error.issues,
      });
    }

    const result = await listAdminCheckouts(parsed.data);

    res.status(200).json({
      success: true,
      message: "Checkouts retrieved successfully.",
      data: result.items,
      pagination: result.pagination,
    });
  },
);

export const getAdminCheckoutDetailsController = asyncHandler(
  async (req: Request, res: Response) => {
    const checkout = await getAdminCheckoutById(getCheckoutId(req));

    res.status(200).json({
      success: true,
      message: "Checkout details retrieved successfully.",
      data: checkout,
    });
  },
);

export const getAdminCheckoutAnalyticsController = asyncHandler(
  async (_req: Request, res: Response) => {
    const analytics = await getAdminCheckoutAnalytics();

    res.status(200).json({
      success: true,
      message: "Checkout analytics retrieved successfully.",
      data: analytics,
    });
  },
);
