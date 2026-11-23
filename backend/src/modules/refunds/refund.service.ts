import mongoose, { Types } from "mongoose";

import { ApiError } from "../../utils/ApiError";
import { dispatchAutomationEvent } from "../automation/automation.service";
import { OrderModel } from "../orders/order.model";
import { ReturnModel } from "../returns/return.model";
import { CancellationModel } from "../cancellations/cancellation.model";
import RefundModel from "./refund.model";

import type {
  CreateRefundInput,
  ProcessRefundInput,
  RefundListFilters,
} from "./refund.types";

function toObjectId(value: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw ApiError.badRequest("Invalid MongoDB ObjectId.");
  }

  return new Types.ObjectId(value);
}

function createRefundNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const suffix = new Types.ObjectId().toString().slice(-6).toUpperCase();

  return `REF-${timestamp}-${suffix}`;
}

export const createRefund = async (
  userId: string,
  input: CreateRefundInput,
) => {
  const order = await OrderModel.findOne({
    _id: toObjectId(input.orderId),
    userId: toObjectId(userId),
  });

  if (!order) {
    throw ApiError.notFound("Order not found.");
  }

  if (input.amount <= 0 || !Number.isFinite(input.amount)) {
    throw ApiError.badRequest("Refund amount must be greater than zero.");
  }

  if (input.returnId) {
    const returnRequest = await ReturnModel.findOne({
      _id: toObjectId(input.returnId),
      orderId: order._id,
      userId: toObjectId(userId),
      status: "COMPLETED",
      resolution: "REFUND",
    });

    if (!returnRequest) {
      throw ApiError.badRequest(
        "A completed refund-eligible return is required.",
      );
    }

    if (
      returnRequest.approvedRefundAmount === undefined ||
      input.amount > returnRequest.approvedRefundAmount
    ) {
      throw ApiError.badRequest(
        "Refund amount exceeds the approved return amount.",
      );
    }
  } else if (input.cancellationId) {
    const cancellation = await CancellationModel.findOne({
      _id: toObjectId(input.cancellationId),
      orderId: order._id,
      userId: toObjectId(userId),
      status: { $in: ["APPROVED", "COMPLETED"] },
    });

    if (!cancellation) {
      throw ApiError.badRequest(
        "An approved cancellation is required for this refund.",
      );
    }

    if (
      cancellation.approvedRefundAmount === undefined ||
      input.amount > cancellation.approvedRefundAmount
    ) {
      throw ApiError.badRequest(
        "Refund amount exceeds the approved cancellation amount.",
      );
    }
  } else {
    throw ApiError.badRequest(
      "A refund must reference an approved cancellation or completed return.",
    );
  }

  const existing = await RefundModel.findOne({
    idempotencyKey: input.idempotencyKey,
  });

  if (existing) {
    if (
      existing.orderId.toString() !== order._id.toString() ||
      existing.userId.toString() !== userId ||
      existing.amount !== input.amount
    ) {
      throw ApiError.conflict(
        "Idempotency key has already been used for a different refund.",
      );
    }

    return existing;
  }

  try {
    const createdRefund = await RefundModel.create({
      refundNumber: createRefundNumber(),
      orderId: order._id,
      userId: toObjectId(userId),
      paymentId: input.paymentId ? toObjectId(input.paymentId) : undefined,
      cancellationId: input.cancellationId
        ? toObjectId(input.cancellationId)
        : undefined,
      returnId: input.returnId ? toObjectId(input.returnId) : undefined,
      amount: input.amount,
      currency: "BDT",
      reason: input.reason,
      customerNote: input.customerNote,
      status: "PENDING",
      requestedBy: toObjectId(userId),
      idempotencyKey: input.idempotencyKey,
      requestedAt: new Date(),
    });

    await dispatchAutomationEvent(
      "REFUND_REQUESTED",
      {
        refundId: createdRefund._id.toString(),
        refundNumber: createdRefund.refundNumber,
        orderId: createdRefund.orderId.toString(),
        userId: createdRefund.userId.toString(),
        amount: createdRefund.amount,
        currency: createdRefund.currency,
        status: createdRefund.status,
        reason: createdRefund.reason,
      },
      `refund-requested:${createdRefund._id.toString()}`,
    );

    return createdRefund;
  } catch (error) {
    if (
      error instanceof mongoose.mongo.MongoServerError &&
      error.code === 11000
    ) {
      const duplicate = await RefundModel.findOne({
        idempotencyKey: input.idempotencyKey,
      });

      if (duplicate) {
        return duplicate;
      }
    }

    throw error;
  }
};

export const getCustomerRefund = async (userId: string, refundId: string) => {
  const refund = await RefundModel.findOne({
    _id: toObjectId(refundId),
    userId: toObjectId(userId),
  }).populate("orderId", "orderNumber status");

  if (!refund) {
    throw ApiError.notFound("Refund not found.");
  }

  return refund;
};

export const listRefunds = async (filters: RefundListFilters) => {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 20));

  const query: Record<string, unknown> = {};

  if (filters.status) {
    query.status = filters.status;
  }

  if (filters.orderId) {
    query.orderId = toObjectId(filters.orderId);
  }

  if (filters.userId) {
    query.userId = toObjectId(filters.userId);
  }

  const sort =
    filters.sort === "oldest"
      ? { createdAt: 1 as const }
      : { createdAt: -1 as const };

  const [items, total] = await Promise.all([
    RefundModel.find(query)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),

    RefundModel.countDocuments(query),
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

/**
 * Mark a refund as processing.
 *
 * This does NOT issue money through a payment gateway.
 * Gateway processing and verified provider callbacks must be
 * implemented before a refund can be marked SUCCEEDED.
 */
export const processRefund = async (
  refundId: string,
  adminId: string,
  input: ProcessRefundInput,
) => {
  const refund = await RefundModel.findById(toObjectId(refundId));

  if (!refund) {
    throw ApiError.notFound("Refund not found.");
  }

  if (refund.status !== "PENDING") {
    throw ApiError.badRequest(
      "Only pending refunds can be moved to processing.",
    );
  }

  refund.status = "PROCESSING";
  refund.processedBy = toObjectId(adminId);

  if (input.internalNote) {
    refund.internalNote = input.internalNote;
  }

  await refund.save();

  return refund;
};

export const cancelPendingRefund = async (
  refundId: string,
  adminId: string,
  note?: string,
) => {
  const refund = await RefundModel.findById(toObjectId(refundId));

  if (!refund) {
    throw ApiError.notFound("Refund not found.");
  }

  if (refund.status !== "PENDING") {
    throw ApiError.badRequest("Only pending refunds can be cancelled.");
  }

  refund.status = "CANCELLED";
  refund.processedBy = toObjectId(adminId);
  refund.cancelledAt = new Date();

  if (note) {
    refund.internalNote = note;
  }

  await refund.save();

  return refund;
};
