import mongoose, { Types } from "mongoose";

import { ApiError } from "../../utils/ApiError";
import { OrderModel } from "../orders/order.model";
import { ReturnModel } from "./return.model";

import type {
  CreateReturnInput,
  InspectReturnInput,
  ReturnListFilters,
  ReviewReturnInput,
} from "./return.types";

const ACTIVE_RETURN_STATUSES = [
  "PENDING",
  "APPROVED",
  "RECEIVED",
  "INSPECTING",
] as const;

function createReturnNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = new Types.ObjectId().toString().slice(-6).toUpperCase();

  return `RET-${timestamp}-${random}`;
}

function toObjectId(value: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw ApiError.badRequest("Invalid ID.");
  }

  return new Types.ObjectId(value);
}

export const createReturn = async (
  userId: string,
  input: CreateReturnInput,
) => {
  const order = await OrderModel.findOne({
    _id: toObjectId(input.orderId),
    userId: toObjectId(userId),
  });

  if (!order) {
    throw ApiError.notFound("Order not found.");
  }

  if (order.status !== "DELIVERED") {
    throw ApiError.badRequest(
      "A return can only be requested for a delivered order.",
    );
  }

  const existingReturn = await ReturnModel.exists({
    orderId: order._id,
    userId: order.userId,
    status: { $in: ACTIVE_RETURN_STATUSES },
  });

  if (existingReturn) {
    throw ApiError.conflict(
      "An active return request already exists for this order.",
    );
  }

  const returnItems = input.items.map((requestedItem) => {
    const orderItem = order.items.find(
      (item) => item._id?.toString() === requestedItem.orderItemId,
    );

    if (!orderItem) {
      throw ApiError.badRequest(
        `Order item ${requestedItem.orderItemId} does not belong to this order.`,
      );
    }

    const alreadyReturned = orderItem.returnedQuantity ?? 0;
    const fulfilledQuantity = orderItem.fulfilledQuantity ?? orderItem.quantity;
    const availableQuantity = fulfilledQuantity - alreadyReturned;

    if (requestedItem.quantity > availableQuantity) {
      throw ApiError.badRequest(
        `Requested return quantity exceeds the available quantity for ${orderItem.productName}.`,
      );
    }

    return {
      orderItemId: orderItem._id,
      productId: orderItem.productId,
      variantId: orderItem.variantId,
      productName: orderItem.productName,
      sku: orderItem.sku,
      quantity: requestedItem.quantity,
      unitPrice: orderItem.unitPrice,
      lineTotal: orderItem.unitPrice * requestedItem.quantity,
      reason: requestedItem.reason,
      customerNote: requestedItem.customerNote,
      evidenceUrls: requestedItem.evidenceUrls ?? [],
      receivedQuantity: 0,
      acceptedQuantity: 0,
    };
  });

  const uniqueItemIds = new Set(input.items.map((item) => item.orderItemId));

  if (uniqueItemIds.size !== input.items.length) {
    throw ApiError.badRequest(
      "Each order item may only appear once in a return request.",
    );
  }

  const requestedRefundAmount = returnItems.reduce(
    (total, item) => total + item.lineTotal,
    0,
  );

  const returnRequest = await ReturnModel.create({
    returnNumber: createReturnNumber(),
    orderId: order._id,
    userId: order.userId,
    items: returnItems,
    status: "PENDING",
    resolution: input.resolution,
    requestedRefundAmount,
    currency: "BDT",
    customerNote: input.customerNote,
  });

  return returnRequest;
};

export const getCustomerReturn = async (userId: string, returnId: string) => {
  const returnRequest = await ReturnModel.findOne({
    _id: toObjectId(returnId),
    userId: toObjectId(userId),
  }).populate("orderId", "orderNumber status");

  if (!returnRequest) {
    throw ApiError.notFound("Return request not found.");
  }

  return returnRequest;
};

export const listCustomerReturns = async (
  userId: string,
  filters: ReturnListFilters,
) => {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 20));

  const query: Record<string, unknown> = {
    userId: toObjectId(userId),
  };

  if (filters.status) {
    query.status = filters.status;
  }

  if (filters.orderId) {
    query.orderId = toObjectId(filters.orderId);
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

export const reviewReturn = async (
  returnId: string,
  reviewerId: string | undefined,
  input: ReviewReturnInput,
) => {
  const session = await mongoose.startSession();

  try {
    let result: unknown;

    await session.withTransaction(async () => {
      const returnRequest =
        await ReturnModel.findById(returnId).session(session);

      if (!returnRequest) {
        throw ApiError.notFound("Return request not found.");
      }

      if (returnRequest.status !== "PENDING") {
        throw ApiError.badRequest(
          "Only pending return requests can be reviewed.",
        );
      }

      // reviewedBy references Admin only. Owner IDs must never be
      // stored in this Admin reference.
      if (reviewerId) {
        returnRequest.reviewedBy = toObjectId(reviewerId);
      }

      returnRequest.reviewedAt = new Date();
      returnRequest.reviewNote = input.reviewNote;

      if (input.status === "REJECTED") {
        returnRequest.status = "REJECTED";
        returnRequest.rejectedAt = new Date();
        returnRequest.approvedRefundAmount = undefined;
      } else {
        const requestedAmount = returnRequest.requestedRefundAmount;
        const approvedAmount = input.approvedRefundAmount;

        if (
          approvedAmount === undefined ||
          approvedAmount < 0 ||
          approvedAmount > requestedAmount
        ) {
          throw ApiError.badRequest(
            "Approved refund amount must be between zero and the requested amount.",
          );
        }

        returnRequest.status = "APPROVED";
        returnRequest.approvedRefundAmount = approvedAmount;
      }

      await returnRequest.save({ session });
      result = returnRequest;
    });

    return result;
  } finally {
    await session.endSession();
  }
};

export const inspectReturn = async (
  returnId: string,
  input: InspectReturnInput,
) => {
  const session = await mongoose.startSession();

  try {
    let result: unknown;

    await session.withTransaction(async () => {
      const returnRequest =
        await ReturnModel.findById(returnId).session(session);

      if (!returnRequest) {
        throw ApiError.notFound("Return request not found.");
      }

      if (
        returnRequest.status !== "APPROVED" &&
        returnRequest.status !== "RECEIVED" &&
        returnRequest.status !== "INSPECTING"
      ) {
        throw ApiError.badRequest(
          "Only approved or received return requests can be inspected.",
        );
      }

      const suppliedItemIds = new Set(
        input.items.map((item) => item.orderItemId),
      );

      if (suppliedItemIds.size !== input.items.length) {
        throw ApiError.badRequest(
          "Each return item may only appear once during inspection.",
        );
      }

      for (const inspection of input.items) {
        const returnItem = returnRequest.items.find(
          (item) => item.orderItemId.toString() === inspection.orderItemId,
        );

        if (!returnItem) {
          throw ApiError.badRequest(
            "An inspected item does not belong to this return request.",
          );
        }

        if (
          inspection.receivedQuantity > returnItem.quantity ||
          inspection.acceptedQuantity > inspection.receivedQuantity
        ) {
          throw ApiError.badRequest("Invalid received or accepted quantity.");
        }

        returnItem.receivedQuantity = inspection.receivedQuantity;
        returnItem.acceptedQuantity = inspection.acceptedQuantity;

        if (inspection.inspectionNote !== undefined) {
          returnItem.inspectionNote = inspection.inspectionNote;
        }
      }

      returnRequest.status = "INSPECTING";
      returnRequest.inspectedAt = new Date();

      if (input.inspectionNote !== undefined) {
        returnRequest.inspectionNote = input.inspectionNote;
      }

      await returnRequest.save({ session });
      result = returnRequest;
    });

    return result;
  } finally {
    await session.endSession();
  }
};

export const completeReturn = async (returnId: string) => {
  const session = await mongoose.startSession();

  try {
    let result: unknown;

    await session.withTransaction(async () => {
      const returnRequest =
        await ReturnModel.findById(returnId).session(session);

      if (!returnRequest) {
        throw ApiError.notFound("Return request not found.");
      }

      if (returnRequest.status !== "INSPECTING") {
        throw ApiError.badRequest(
          "Only inspected return requests can be completed.",
        );
      }

      if (
        returnRequest.items.some(
          (item) => item.receivedQuantity < item.quantity,
        )
      ) {
        throw ApiError.badRequest(
          "All requested items must be received before completion.",
        );
      }

      if (
        returnRequest.items.some(
          (item) => item.acceptedQuantity > item.receivedQuantity,
        )
      ) {
        throw ApiError.badRequest(
          "Accepted quantities cannot exceed received quantities.",
        );
      }

      const order = await OrderModel.findById(returnRequest.orderId).session(
        session,
      );

      if (!order) {
        throw ApiError.notFound("Associated order not found.");
      }

      for (const returnItem of returnRequest.items) {
        const orderItem = order.items.find(
          (item) => item._id?.toString() === returnItem.orderItemId.toString(),
        );

        if (!orderItem) {
          throw ApiError.badRequest(
            "An order item associated with this return could not be found.",
          );
        }

        orderItem.returnedQuantity =
          (orderItem.returnedQuantity ?? 0) + returnItem.acceptedQuantity;
      }

      await order.save({ session });

      returnRequest.status = "COMPLETED";
      returnRequest.completedAt = new Date();

      await returnRequest.save({ session });
      result = returnRequest;
    });

    return result;
  } finally {
    await session.endSession();
  }
};

export const cancelCustomerReturn = async (
  userId: string,
  returnId: string,
) => {
  const returnRequest = await ReturnModel.findOne({
    _id: toObjectId(returnId),
    userId: toObjectId(userId),
  });

  if (!returnRequest) {
    throw ApiError.notFound("Return request not found.");
  }

  if (returnRequest.status !== "PENDING") {
    throw ApiError.badRequest("Only pending return requests can be cancelled.");
  }

  returnRequest.status = "CANCELLED";
  returnRequest.cancelledAt = new Date();

  await returnRequest.save();

  return returnRequest;
};
