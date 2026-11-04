import type { Request, Response } from "express";

import { getAuthenticatedUserId } from "../../middlewares/userAuth.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";

import {
  createCancellation,
  getCustomerCancellation,
  listCustomerCancellations,
  reviewCancellation,
} from "./cancellation.service";

const getUserId = (req: Request): string => getAuthenticatedUserId(req);

const getParam = (req: Request, key: string): string => {
  const value = req.params[key];

  if (typeof value !== "string" || !value.trim()) {
    throw ApiError.badRequest(`Invalid ${key}.`);
  }

  return value;
};

/**
 * POST /cancellations
 * Customer requests cancellation of an order.
 */
export const createCancellationController = asyncHandler(
  async (req: Request, res: Response) => {
    const cancellation = await createCancellation(getUserId(req), req.body);

    res.status(201).json({
      success: true,
      message: "Cancellation request created successfully.",
      data: cancellation,
    });
  },
);

/**
 * GET /cancellations
 * List the authenticated customer's cancellation requests.
 */
export const listCustomerCancellationsController = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await listCustomerCancellations(
      getUserId(req),
      req.query as never,
    );

    res.status(200).json({
      success: true,
      message: "Cancellation requests retrieved successfully.",
      data: result.items,
      pagination: result.pagination,
    });
  },
);

/**
 * GET /cancellations/:cancellationId
 * Retrieve one cancellation request owned by the customer.
 */
export const getCustomerCancellationController = asyncHandler(
  async (req: Request, res: Response) => {
    const cancellation = await getCustomerCancellation(
      getUserId(req),
      getParam(req, "cancellationId"),
    );

    res.status(200).json({
      success: true,
      message: "Cancellation request retrieved successfully.",
      data: cancellation,
    });
  },
);

/**
 * PATCH /cancellations/:cancellationId/review
 * Admin-only handler. Protect its route with admin authentication
 * and the appropriate permission middleware.
 */
export const reviewCancellationController = asyncHandler(
  async (req: Request, res: Response) => {
    const ownerId = req.ownerAuth?.ownerId;
    const adminId = req.adminAuth?.adminId;

    const reviewerId = ownerId || adminId;
    const reviewerRole = ownerId ? "OWNER" : adminId ? "ADMIN" : null;

    if (!reviewerId || !reviewerRole) {
      throw ApiError.unauthorized("Administrative authentication required.");
    }

    const cancellation = await reviewCancellation(
      getParam(req, "cancellationId"),
      reviewerId,
      reviewerRole,
      req.body,
    );

    res.status(200).json({
      success: true,
      message: "Cancellation request reviewed successfully.",
      data: cancellation,
    });
  },
);
