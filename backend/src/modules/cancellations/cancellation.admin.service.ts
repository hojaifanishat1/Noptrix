import { Types } from "mongoose";

import { ApiError } from "../../utils/ApiError";
import { User } from "../users/user.model";
import { CancellationModel } from "./cancellation.model";
import type { AdminCancellationQuery } from "./cancellation.admin.validator";
import type { Cancellation } from "./cancellation.types";

const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export async function listAdminCancellations(
  filters: AdminCancellationQuery,
) {
  const page = filters.page;
  const limit = filters.limit;

  const query: Record<string, unknown> = {};

  if (filters.status) {
    query.status = filters.status;
  }

  if (filters.from || filters.to) {
    const createdAt: Record<string, Date> = {};

    if (filters.from) createdAt.$gte = new Date(filters.from);
    if (filters.to) createdAt.$lte = new Date(filters.to);

    query.createdAt = createdAt;
  }

  if (filters.search) {
    const search = escapeRegex(filters.search);

    const conditions: Record<string, unknown>[] = [
      { cancellationNumber: { $regex: search, $options: "i" } },
      { reason: { $regex: search, $options: "i" } },
      { customerNote: { $regex: search, $options: "i" } },
      { reviewNote: { $regex: search, $options: "i" } },
    ];

    if (Types.ObjectId.isValid(filters.search)) {
      const id = new Types.ObjectId(filters.search);

      conditions.push({ _id: id });
      conditions.push({ orderId: id });
      conditions.push({ userId: id });
    }

    const matchingUsers = await User.find({
      $or: [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ],
    })
      .select("_id")
      .limit(100)
      .lean()
      .exec();

    if (matchingUsers.length) {
      conditions.push({
        userId: { $in: matchingUsers.map((user) => user._id) },
      });
    }

    query.$or = conditions;
  }

  const sortDirection = filters.sort === "oldest" ? 1 : -1;

  const [items, total] = await Promise.all([
    CancellationModel.find(query)
      .select("-__v")
      .populate({
        path: "userId",
        select: "name email phone",
      })
      .populate({
        path: "orderId",
        select: "orderNumber status totals paymentStatus paymentMethod createdAt",
      })
      .sort({
        createdAt: sortDirection,
        _id: sortDirection,
      })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()
      .exec(),

    CancellationModel.countDocuments(query),
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
}

export async function getAdminCancellationById(
  cancellationId: string,
) {
  if (!Types.ObjectId.isValid(cancellationId)) {
    throw ApiError.badRequest("Invalid cancellation ID.");
  }

  const cancellation = await CancellationModel.findById(cancellationId)
    .select("-__v")
    .populate({
      path: "userId",
      select: "name email phone status",
    })
    .populate({
      path: "orderId",
      select: "orderNumber status items totals paymentStatus paymentMethod shippingAddress createdAt",
    })
    .lean<Cancellation | null>()
    .exec();

  if (!cancellation) {
    throw ApiError.notFound("Cancellation request not found.");
  }

  return cancellation;
}

export async function getAdminCancellationAnalytics() {
  const [statusRows, refundRows, recentTrend] = await Promise.all([
    CancellationModel.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]),

    CancellationModel.aggregate([
      {
        $group: {
          _id: "$currency",
          requestedAmount: { $sum: "$requestedRefundAmount" },
          approvedAmount: { $sum: "$approvedRefundAmount" },
          requestCount: { $sum: 1 },
        },
      },
    ]),

    CancellationModel.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" },
          },
          count: { $sum: 1 },
          requestedAmount: { $sum: "$requestedRefundAmount" },
        },
      },
      {
        $sort: {
          "_id.year": 1,
          "_id.month": 1,
          "_id.day": 1,
        },
      },
    ]),
  ]);

  const count = (status: string) =>
    statusRows.find((row) => row._id === status)?.count ?? 0;

  const total = statusRows.reduce(
    (sum, row) => sum + row.count,
    0,
  );

  const pending = count("PENDING");
  const approved = count("APPROVED");
  const rejected = count("REJECTED");
  const completed = count("COMPLETED");
  const cancelled = count("CANCELLED");

  return {
    total,
    pending,
    approved,
    rejected,
    completed,
    cancelled,
    reviewed: approved + rejected + completed,
    approvalRate:
      approved + rejected
        ? Number(((approved / (approved + rejected)) * 100).toFixed(2))
        : 0,
    currencyTotals: refundRows,
    recentTrend,
  };
}
