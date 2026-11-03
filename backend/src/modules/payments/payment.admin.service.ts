import { Types } from "mongoose";

import { ApiError } from "../../utils/ApiError";
import { Payment } from "./payment.model";
import type { AdminPaymentQuery } from "./payment.admin.validator";

const SAFE_PAYMENT_FIELDS = [
  "transactionId",
  "referenceId",
  "orderId",
  "customerId",
  "amount",
  "currency",
  "method",
  "provider",
  "status",
  "providerTransactionId",
  "failureCode",
  "failureMessage",
  "paidAt",
  "expiresAt",
  "metadata",
  "createdAt",
  "updatedAt",
].join(" ");

const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export async function listAdminPayments(query: AdminPaymentQuery) {
  const page = query.page;
  const limit = query.limit;
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {};

  if (query.status) filter.status = query.status;
  if (query.method) filter.method = query.method;
  if (query.provider) filter.provider = query.provider.toLowerCase();
  if (query.orderId) filter.orderId = query.orderId;

  if (query.customerId) {
    filter.customerId = new Types.ObjectId(query.customerId);
  }

  if (query.transactionId) {
    filter.transactionId = query.transactionId;
  }

  if (query.search) {
    const search = new RegExp(escapeRegex(query.search), "i");

    filter.$or = [
      { transactionId: search },
      { referenceId: search },
      { orderId: search },
      { providerTransactionId: search },
    ];
  }

  if (query.from || query.to) {
    const createdAt: Record<string, Date> = {};

    if (query.from) createdAt.$gte = new Date(query.from);
    if (query.to) createdAt.$lte = new Date(query.to);

    filter.createdAt = createdAt;
  }

  const sortDirection = query.sort === "oldest" ? 1 : -1;

  const [payments, total] = await Promise.all([
    Payment.find(filter)
      .select(SAFE_PAYMENT_FIELDS)
      .sort({ createdAt: sortDirection, _id: sortDirection })
      .skip(skip)
      .limit(limit)
      .lean(),

    Payment.countDocuments(filter),
  ]);

  return {
    payments,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: skip + payments.length < total,
      hasPreviousPage: page > 1,
    },
  };
}

export async function getAdminPaymentByTransactionId(
  transactionId: string,
) {
  const payment = await Payment.findOne({
    transactionId: transactionId.trim(),
  })
    .select(SAFE_PAYMENT_FIELDS)
    .lean();

  if (!payment) {
    throw ApiError.notFound("Payment not found.");
  }

  return payment;
}
