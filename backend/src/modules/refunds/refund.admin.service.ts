import mongoose, { Types } from "mongoose";

import { ApiError } from "../../utils/ApiError";
import { RefundModel } from "./refund.model";
import { OrderModel } from "../orders/order.model";
import { Payment } from "../payments/payment.model";
import { Transaction, TRANSACTION_TYPES } from "../transactions/transaction.model";
import type { RefundListFilters, ManualRefundInput } from "./refund.types";

const toObjectId = (value: string) => {
  if (!Types.ObjectId.isValid(value)) {
    throw new ApiError(400, "Invalid ID.");
  }

  return new Types.ObjectId(value);
};

export const listAdminRefunds = async (filters: RefundListFilters) => {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 20));

  const query: Record<string, unknown> = {};

  if (filters.status) query.status = filters.status;
  if (filters.orderId) query.orderId = toObjectId(filters.orderId);
  if (filters.userId) query.userId = toObjectId(filters.userId);

  const sort = filters.sort === "oldest" ? 1 : -1;

  const [items, total] = await Promise.all([
    RefundModel.find(query)
      .populate("orderId", "orderNumber status paymentStatus totals")
      .populate("userId", "name email phone")
      .populate("paymentId", "transactionId method provider status amount currency")
      .populate("processedBy", "name email")
      .sort({ createdAt: sort, _id: sort })
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
      hasNextPage: page * limit < total,
      hasPreviousPage: page > 1,
    },
  };
};

export const getAdminRefundDetails = async (refundId: string) => {
  const refund = await RefundModel.findById(toObjectId(refundId))
    .populate("orderId")
    .populate("userId", "name email phone")
    .populate("paymentId")
    .populate("cancellationId")
    .populate("returnId")
    .populate("requestedBy", "name email")
    .populate("processedBy", "name email")
    .lean();

  if (!refund) {
    throw new ApiError(404, "Refund not found.");
  }

  return refund;
};

export const getRefundAnalytics = async () => {
  const [statusSummary, reasonSummary, totals] = await Promise.all([
    RefundModel.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          amount: { $sum: "$amount" },
        },
      },
    ]),

    RefundModel.aggregate([
      {
        $group: {
          _id: "$reason",
          count: { $sum: 1 },
          amount: { $sum: "$amount" },
        },
      },
      { $sort: { amount: -1 } },
    ]),

    RefundModel.aggregate([
      {
        $group: {
          _id: null,
          totalRequests: { $sum: 1 },
          totalRequestedAmount: { $sum: "$amount" },
          succeededAmount: {
            $sum: {
              $cond: [{ $eq: ["$status", "SUCCEEDED"] }, "$amount", 0],
            },
          },
          processingAmount: {
            $sum: {
              $cond: [{ $eq: ["$status", "PROCESSING"] }, "$amount", 0],
            },
          },
          failedAmount: {
            $sum: {
              $cond: [{ $eq: ["$status", "FAILED"] }, "$amount", 0],
            },
          },
        },
      },
    ]),
  ]);

  return {
    summary: totals[0] ?? {
      totalRequests: 0,
      totalRequestedAmount: 0,
      succeededAmount: 0,
      processingAmount: 0,
      failedAmount: 0,
    },
    byStatus: statusSummary,
    byReason: reasonSummary,
  };
};

/**
 * COD/manual refunds must only be marked successful after the operator
 * confirms that the money was actually returned.
 */
export const confirmManualRefund = async (
  refundId: string,
  adminId: string,
  input: ManualRefundInput,
) => {
  const session = await mongoose.startSession();

  try {
    let completedRefund: unknown;

    await session.withTransaction(async () => {
      const refund = await RefundModel.findOne({
        _id: toObjectId(refundId),
        status: "PROCESSING",
      }).session(session);

      if (!refund) {
        throw new ApiError(
          409,
          "Only a processing refund can be manually confirmed.",
        );
      }

      if (refund.transaction?.providerRefundId) {
        throw new ApiError(
          409,
          "This refund already has a provider refund reference.",
        );
      }

      if (refund.paymentId) {
        const linkedPayment = await Payment.findById(refund.paymentId).session(
          session,
        );

        if (linkedPayment?.method === "online") {
          throw new ApiError(
            409,
            "Online refunds cannot be manually confirmed. Use the payment provider refund flow.",
          );
        }
      }

      const reference = input.manualReference.trim();

      refund.status = "SUCCEEDED";
      refund.processedBy = toObjectId(adminId);
      refund.processedAt = new Date();
      refund.internalNote = input.internalNote?.trim() || refund.internalNote;
      refund.transaction = {
        provider: "manual",
        manualReference: reference,
        status: "SUCCEEDED",
        responseMessage: "Manually confirmed by an authorized administrator.",
        processedAt: new Date(),
      };

      await refund.save({ session });

      const order = await OrderModel.findById(refund.orderId).session(session);

      if (!order) {
        throw new ApiError(404, "Related order not found.");
      }

      const currentRefunded = Number(order.totals.refundedAmount ?? 0);
      const nextRefunded =
        Math.round((currentRefunded + refund.amount) * 100) / 100;

      if (nextRefunded > order.totals.totalAmount + 0.001) {
        throw new ApiError(
          409,
          "Refund amount would exceed the order total.",
        );
      }

      order.totals.refundedAmount = nextRefunded;
      await order.save({ session });

      if (refund.paymentId) {
        const payment = await Payment.findById(refund.paymentId).session(
          session,
        );

        if (payment) {
          const activeRefunds = await RefundModel.aggregate([
            {
              $match: {
                paymentId: refund.paymentId,
                status: "SUCCEEDED",
              },
            },
            {
              $group: {
                _id: null,
                amount: { $sum: "$amount" },
              },
            },
          ]).session(session);

          const refunded = Number(activeRefunds[0]?.amount ?? 0);

          payment.status =
            refunded >= payment.amount
              ? "refunded"
              : "partially_refunded";

          await payment.save({ session });

          await Transaction.create(
            [
              {
                paymentId: payment._id,
                transactionId: payment.transactionId,
                orderId: payment.orderId,
                type: TRANSACTION_TYPES.REFUND_SUCCEEDED,
                previousStatus: "processing",
                status: "refunded",
                amount: refund.amount,
                currency: refund.currency,
                provider: "manual",
                actorId: toObjectId(adminId),
                correlationId: refund.refundNumber,
                details: {
                  refundId: refund._id.toString(),
                  manualReference: reference,
                },
              },
            ],
            { session },
          );
        }
      }

      completedRefund = refund.toObject();
    });

    return completedRefund;
  } finally {
    await session.endSession();
  }
};
