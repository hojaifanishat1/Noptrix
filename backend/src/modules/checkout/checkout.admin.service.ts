import { Types } from "mongoose";

import { ApiError } from "../../utils/ApiError";
import { User } from "../users/user.model";
import CheckoutModel from "./checkout.model";
import type { AdminCheckoutQuery } from "./checkout.admin.validator";

const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Expiry is persisted explicitly instead of relying on MongoDB TTL deletion.
 * Only pending checkouts can become expired automatically.
 */
async function markExpiredCheckouts() {
  const now = new Date();

  await CheckoutModel.updateMany(
    {
      status: "PENDING",
      expiresAt: { $lte: now },
    },
    {
      $set: { status: "EXPIRED" },
    },
  );
}

export async function listAdminCheckouts(filters: AdminCheckoutQuery) {
  await markExpiredCheckouts();

  const page = filters.page;
  const limit = filters.limit;
  const query: Record<string, unknown> = {};

  if (filters.status) query.status = filters.status;
  if (filters.paymentStatus) query.paymentStatus = filters.paymentStatus;

  if (filters.from || filters.to) {
    const createdAt: Record<string, Date> = {};
    if (filters.from) createdAt.$gte = new Date(filters.from);
    if (filters.to) createdAt.$lte = new Date(filters.to);
    query.createdAt = createdAt;
  }

  if (filters.search) {
    const search = escapeRegex(filters.search);
    const conditions: Record<string, unknown>[] = [
      { "shippingAddress.fullName": { $regex: search, $options: "i" } },
      { "shippingAddress.phone": { $regex: search, $options: "i" } },
      { paymentMethod: { $regex: search, $options: "i" } },
      { "items.productName": { $regex: search, $options: "i" } },
      { couponCode: { $regex: search, $options: "i" } },
    ];

    if (Types.ObjectId.isValid(filters.search)) {
      conditions.push({ _id: new Types.ObjectId(filters.search) });
      conditions.push({ userId: new Types.ObjectId(filters.search) });
      conditions.push({ orderId: new Types.ObjectId(filters.search) });
    }

    query.$or = conditions;
  }

  const [items, total] = await Promise.all([
    CheckoutModel.find(query)
      .select("-checkoutToken -idempotencyKey -__v")
      .populate({ path: "userId", select: "name email phone" })
      .sort({
        createdAt: filters.sort === "oldest" ? 1 : -1,
        _id: filters.sort === "oldest" ? 1 : -1,
      })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()
      .exec(),
    CheckoutModel.countDocuments(query),
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

export async function getAdminCheckoutById(checkoutId: string) {
  if (!Types.ObjectId.isValid(checkoutId)) {
    throw ApiError.badRequest("Invalid checkout ID.");
  }

  await markExpiredCheckouts();

  const checkout = await CheckoutModel.findById(checkoutId)
    .select("-checkoutToken -idempotencyKey -__v")
    .populate({ path: "userId", select: "name email phone status" })
    .lean()
    .exec();

  if (!checkout) {
    throw ApiError.notFound("Checkout not found.", {
      code: "CHECKOUT_NOT_FOUND",
    });
  }

  return checkout;
}

export async function getAdminCheckoutAnalytics() {
  await markExpiredCheckouts();

  const [statusCounts, paymentCounts, currencyTotals, recentTrend] =
    await Promise.all([
      CheckoutModel.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      CheckoutModel.aggregate([
        { $group: { _id: "$paymentStatus", count: { $sum: 1 } } },
      ]),
      CheckoutModel.aggregate([
        {
          $group: {
            _id: "$totals.currency",
            count: { $sum: 1 },
            totalAmount: { $sum: "$totals.totalAmount" },
            averageAmount: { $avg: "$totals.totalAmount" },
          },
        },
      ]),
      CheckoutModel.aggregate([
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
            amount: { $sum: "$totals.totalAmount" },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
      ]),
    ]);

  const count = (rows: Array<{ _id: string; count: number }>, key: string) =>
    rows.find((row) => row._id === key)?.count ?? 0;

  const total = statusCounts.reduce((sum, row) => sum + row.count, 0);
  const completed = count(statusCounts, "COMPLETED");

  return {
    total,
    pending: count(statusCounts, "PENDING"),
    processing: count(statusCounts, "PROCESSING"),
    completed,
    failed: count(statusCounts, "FAILED"),
    cancelled: count(statusCounts, "CANCELLED"),
    expired: count(statusCounts, "EXPIRED"),
    paid: count(paymentCounts, "PAID"),
    paymentPending: count(paymentCounts, "PENDING"),
    paymentFailed: count(paymentCounts, "FAILED"),
    refunded: count(paymentCounts, "REFUNDED"),
    completionRate: total
      ? Number(((completed / total) * 100).toFixed(2))
      : 0,
    currencyTotals,
    recentTrend,
  };
}
