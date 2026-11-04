import { Types } from "mongoose";

import { ApiError } from "../../utils/ApiError";
import { ReturnModel } from "./return.model";
import { RETURN_STATUSES } from "./return.types";

import type { ReturnStatus } from "./return.types";

interface AdminReturnFilters {
  status?: ReturnStatus;
  orderId?: string;
  search?: string;
  page?: number;
  limit?: number;
  sort?: "newest" | "oldest";
}

export const listAdminReturns = async (filters: AdminReturnFilters) => {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 20));

  const query: Record<string, unknown> = {};

  if (filters.status) query.status = filters.status;

  if (filters.orderId) {
    if (!Types.ObjectId.isValid(filters.orderId)) {
      throw ApiError.badRequest("Invalid order ID.");
    }

    query.orderId = new Types.ObjectId(filters.orderId);
  }

  const search = filters.search?.trim();

  if (search) {
    const conditions: Record<string, unknown>[] = [
      { returnNumber: { $regex: search, $options: "i" } },
      { customerNote: { $regex: search, $options: "i" } },
    ];

    if (Types.ObjectId.isValid(search)) {
      conditions.push(
        { _id: new Types.ObjectId(search) },
        { orderId: new Types.ObjectId(search) },
        { userId: new Types.ObjectId(search) },
      );
    }

    query.$or = conditions;
  }

  const sort =
    filters.sort === "oldest"
      ? { createdAt: 1 as const }
      : { createdAt: -1 as const };

  const [items, total] = await Promise.all([
    ReturnModel.find(query)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),

    ReturnModel.countDocuments(query),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getAdminReturn = async (returnId: string) => {
  if (!Types.ObjectId.isValid(returnId)) {
    throw ApiError.badRequest("Invalid return ID.");
  }

  const result = await ReturnModel.findById(returnId)
    .populate("orderId")
    .populate("userId", "name email phone")
    .populate("reviewedBy", "name email")
    .lean();

  if (!result) {
    throw ApiError.notFound("Return request not found.");
  }

  return result;
};

export const getAdminReturnAnalytics = async () => {
  const [statusCounts, totals] = await Promise.all([
    ReturnModel.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]),

    ReturnModel.aggregate([
      {
        $group: {
          _id: "$currency",
          requests: { $sum: 1 },
          requestedRefundAmount: { $sum: "$requestedRefundAmount" },
          approvedRefundAmount: { $sum: { $ifNull: ["$approvedRefundAmount", 0] } },
        },
      },
    ]),
  ]);

  const counts: Record<string, number> = {};

  for (const status of RETURN_STATUSES) {
    counts[status] = 0;
  }

  for (const item of statusCounts) {
    counts[item._id] = item.count;
  }

  return {
    total: Object.values(counts).reduce((sum, value) => sum + value, 0),
    statusCounts: counts,
    financials: totals,
  };
};
