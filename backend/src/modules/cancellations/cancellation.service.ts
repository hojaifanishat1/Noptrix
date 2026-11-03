import { randomBytes } from "node:crypto";
import mongoose, { Types } from "mongoose";

import { ApiError } from "../../utils/ApiError";
import { OrderModel } from "../orders/order.model";
import { releaseOrderInventoryAllocations } from "../orders/order.service";
import { CancellationModel } from "./cancellation.model";

import type {
  Cancellation,
  CancellationListFilters,
  CreateCancellationInput,
  ReviewCancellationInput,
} from "./cancellation.types";

const cancellableStatuses = ["PENDING", "CONFIRMED", "PROCESSING"];

const toObjectId = (value: string, field: string): Types.ObjectId => {
  if (!Types.ObjectId.isValid(value)) {
    throw ApiError.badRequest(`Invalid ${field}.`);
  }

  return new Types.ObjectId(value);
};

const normalizeUserId = (value: string | Types.ObjectId): Types.ObjectId => {
  const id = String(value);

  if (!Types.ObjectId.isValid(id)) {
    throw ApiError.badRequest("Invalid user ID.");
  }

  return new Types.ObjectId(id);
};

const roundMoney = (amount: number): number =>
  Math.round((amount + Number.EPSILON) * 100) / 100;

const generateCancellationNumber = (): string =>
  `CAN-${Date.now()}-${randomBytes(3).toString("hex").toUpperCase()}`;

const calculateRefundAmount = (order: {
  items: Array<{
    lineTotal: number;
    discountAmount: number;
    taxAmount: number;
  }>;
  totals: {
    shippingAmount: number;
    totalAmount: number;
    refundedAmount: number;
  };
}): number => {
  const itemsTotal = order.items.reduce(
    (sum, item) => sum + item.lineTotal - item.discountAmount + item.taxAmount,
    0,
  );

  return Math.max(
    0,
    Math.min(
      roundMoney(itemsTotal + order.totals.shippingAmount),
      roundMoney(order.totals.totalAmount - order.totals.refundedAmount),
    ),
  );
};

/**
 * Customer requests cancellation of their entire order.
 * Partial cancellation is not supported by the current Order model.
 */
export const createCancellation = async (
  userIdInput: string | Types.ObjectId,
  input: CreateCancellationInput,
): Promise<Cancellation> => {
  const userId = normalizeUserId(userIdInput);
  const orderId = toObjectId(input.orderId, "order ID");

  if (input.itemIds?.length) {
    throw ApiError.badRequest(
      "Partial cancellation is not supported. Request cancellation of the entire order.",
    );
  }

  const order = await OrderModel.findOne({
    _id: orderId,
    userId,
  });

  if (!order) {
    throw ApiError.notFound("Order not found.");
  }

  if (!cancellableStatuses.includes(order.status)) {
    throw ApiError.badRequest("This order is not eligible for cancellation.");
  }

  const existing = await CancellationModel.findOne({
    orderId,
    userId,
    status: { $in: ["PENDING", "APPROVED"] },
  });

  if (existing) {
    throw ApiError.conflict(
      "An active cancellation request already exists for this order.",
    );
  }

  if (!order.items.length) {
    throw ApiError.badRequest("The order contains no items.");
  }

  const items = order.items.map((item) => ({
    orderItemId: item._id as Types.ObjectId,
    productId: item.productId,
    ...(item.variantId ? { variantId: item.variantId } : {}),
    productName: item.productName,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    lineTotal: item.lineTotal,
  }));

  const cancellation = await CancellationModel.create({
    cancellationNumber: generateCancellationNumber(),
    orderId: order._id,
    userId,
    reason: input.reason,
    customerNote: input.customerNote,
    items,
    status: "PENDING",
    requestedRefundAmount: calculateRefundAmount(order),
    currency: order.totals.currency,
  });

  return cancellation.toObject() as Cancellation;
};

/**
 * Customer can retrieve only their own cancellation request.
 */
export const getCustomerCancellation = async (
  userIdInput: string | Types.ObjectId,
  cancellationIdInput: string,
): Promise<Cancellation> => {
  const userId = normalizeUserId(userIdInput);
  const cancellationId = toObjectId(cancellationIdInput, "cancellation ID");

  const cancellation = await CancellationModel.findOne({
    _id: cancellationId,
    userId,
  }).lean<Cancellation | null>();

  if (!cancellation) {
    throw ApiError.notFound("Cancellation request not found.");
  }

  return cancellation;
};

/**
 * Paginated list of the authenticated customer's cancellation requests.
 */
export const listCustomerCancellations = async (
  userIdInput: string | Types.ObjectId,
  filters: CancellationListFilters = {},
) => {
  const userId = normalizeUserId(userIdInput);
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 20));

  const query: Record<string, unknown> = { userId };

  if (filters.status) {
    query.status = filters.status;
  }

  if (filters.orderId) {
    query.orderId = toObjectId(filters.orderId, "order ID");
  }

  const sort =
    filters.sort === "oldest"
      ? { createdAt: 1 as const }
      : { createdAt: -1 as const };

  const [items, total] = await Promise.all([
    CancellationModel.find(query)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean<Cancellation[]>(),
    CancellationModel.countDocuments(query),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPreviousPage: page > 1,
    },
  };
};

/**
 * Admin reviews a pending cancellation request.
 * Approval cancels the order; actual payment refund is handled separately.
 */
export const reviewCancellation = async (
  cancellationIdInput: string,
  reviewerIdInput: string | Types.ObjectId,
  input: ReviewCancellationInput,
): Promise<Cancellation> => {
  const cancellationId = toObjectId(cancellationIdInput, "cancellation ID");
  const reviewerId = normalizeUserId(reviewerIdInput);

  const session = await mongoose.startSession();

  try {
    let result: Cancellation | null = null;

    await session.withTransaction(async () => {
      const cancellation =
        await CancellationModel.findById(cancellationId).session(session);

      if (!cancellation) {
        throw ApiError.notFound("Cancellation request not found.");
      }

      if (cancellation.status !== "PENDING") {
        throw ApiError.conflict(
          "Only pending cancellation requests can be reviewed.",
        );
      }

      if (input.status === "APPROVED") {
        if (input.approvedRefundAmount === undefined) {
          throw ApiError.badRequest("Approved refund amount is required.");
        }

        if (
          !Number.isFinite(input.approvedRefundAmount) ||
          input.approvedRefundAmount < 0 ||
          input.approvedRefundAmount > cancellation.requestedRefundAmount
        ) {
          throw ApiError.badRequest(
            "Approved refund amount is outside the allowed range.",
          );
        }

        const order = await OrderModel.findOne({
          _id: cancellation.orderId,
          userId: cancellation.userId,
        }).session(session);

        if (!order) {
          throw ApiError.notFound("Associated order not found.");
        }

        if (!cancellableStatuses.includes(order.status)) {
          throw ApiError.conflict(
            "The order is no longer eligible for cancellation.",
          );
        }

        await releaseOrderInventoryAllocations(order, session);

        order.status = "CANCELLED";
        order.cancellationReason =
          input.reviewNote?.trim() ||
          `Cancellation approved: ${cancellation.reason}`;
        order.cancelledAt = new Date();

        await order.save({ session });

        cancellation.status = "APPROVED";
        cancellation.approvedRefundAmount = roundMoney(
          input.approvedRefundAmount,
        );
      } else {
        cancellation.status = "REJECTED";
        cancellation.rejectedAt = new Date();
      }

      cancellation.reviewedBy = reviewerId;
      cancellation.reviewedAt = new Date();

      if (input.reviewNote) {
        cancellation.reviewNote = input.reviewNote.trim();
      }

      await cancellation.save({ session });
      result = cancellation.toObject() as Cancellation;
    });

    if (!result) {
      throw ApiError.internal("Cancellation review failed.");
    }

    return result;
  } finally {
    await session.endSession();
  }
};
