import { Types } from "mongoose";

import { ApiError } from "../../utils/ApiError";
import OrderModel from "../orders/order.model";
import { Seller } from "../sellers/seller.model";
import COD from "../cod/cod.model";
import RefundModel from "../refunds/refund.model";
import { SellerPayoutModel } from "./sellerPayout.model";

import type {
  SellerPayoutQuery,
  UpdateSellerPayoutStatusInput,
} from "./sellerPayout.validator";

const roundMoney = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const validId = (value: string) => {
  if (!Types.ObjectId.isValid(value)) {
    throw ApiError.badRequest("Invalid MongoDB ObjectId.");
  }
  return new Types.ObjectId(value);
};

export const generateSellerPayouts = async (sellerId?: string) => {
  const orders = await OrderModel.find({
    status: "DELIVERED",
    paymentStatus: "PAID",
    ...(sellerId ? { "items.sellerId": validId(sellerId) } : {}),
  }).lean();

  let created = 0;
  let skipped = 0;

  for (const order of orders) {
    const successfulRefund = await RefundModel.exists({
      orderId: order._id,
      status: "SUCCEEDED",
    });

    if (successfulRefund) {
      skipped++;
      continue;
    }

    if (order.paymentMethod.trim().toLowerCase() === "cod") {
      const codRecord = await COD.findOne({
        orderId: order._id,
        status: "REMITTED",
      }).lean();

      if (!codRecord) {
        skipped++;
        continue;
      }
    }

    const sellerTotals = new Map<
      string,
      { grossAmount: number; currency: string }
    >();

    for (const item of order.items) {
      if (!item.sellerId || item.returnedQuantity > 0) continue;

      const id = item.sellerId.toString();
      const current = sellerTotals.get(id);

      if (current && current.currency !== item.currency.toUpperCase()) {
        throw ApiError.badRequest(
          `Order ${order.orderNumber} has mixed currencies for one seller.`,
        );
      }

      sellerTotals.set(id, {
        grossAmount: roundMoney(
          (current?.grossAmount ?? 0) + item.lineTotal,
        ),
        currency: item.currency.toUpperCase(),
      });
    }

    for (const [id, totals] of sellerTotals) {
      const seller = await Seller.findById(id)
        .select("commissionRate status onboardingStatus")
        .lean();

      if (
        !seller ||
        seller.status !== "ACTIVE" ||
        seller.onboardingStatus !== "COMPLETED" ||
        typeof seller.commissionRate !== "number"
      ) {
        skipped++;
        continue;
      }

      const exists = await SellerPayoutModel.exists({
        sellerId: seller._id,
        orderId: order._id,
      });

      if (exists) {
        skipped++;
        continue;
      }

      const commissionAmount = roundMoney(
        (totals.grossAmount * seller.commissionRate) / 100,
      );

      const netAmount = roundMoney(
        totals.grossAmount - commissionAmount,
      );

      try {
        await SellerPayoutModel.create({
          sellerId: seller._id,
          orderId: order._id,
          orderNumber: order.orderNumber,
          currency: totals.currency,
          grossAmount: totals.grossAmount,
          commissionRate: seller.commissionRate,
          commissionAmount,
          netAmount,
          status: "PENDING",
        });
        created++;
      } catch (error) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === 11000
        ) {
          skipped++;
          continue;
        }
        throw error;
      }
    }
  }

  return { scanned: orders.length, created, skipped };
};

export const listSellerPayouts = async (
  filters: SellerPayoutQuery,
) => {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 20;

  const query: Record<string, unknown> = {};

  if (filters.status) query.status = filters.status;
  if (filters.sellerId) query.sellerId = validId(filters.sellerId);
  if (filters.currency) query.currency = filters.currency;

  const [items, total, summary] = await Promise.all([
    SellerPayoutModel.find(query)
      .populate("sellerId", "sellerCode businessName email")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    SellerPayoutModel.countDocuments(query),
    SellerPayoutModel.aggregate([
      { $match: query },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          grossAmount: { $sum: "$grossAmount" },
          commissionAmount: { $sum: "$commissionAmount" },
          netAmount: { $sum: "$netAmount" },
        },
      },
    ]),
  ]);

  return {
    items,
    summary,
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

export const updateSellerPayoutStatus = async (
  payoutId: string,
  actorId: string,
  input: UpdateSellerPayoutStatusInput,
) => {
  const payout = await SellerPayoutModel.findById(validId(payoutId));

  if (!payout) throw ApiError.notFound("Seller payout not found.");

  if (input.status === "APPROVED") {
    if (payout.status !== "PENDING") {
      throw ApiError.badRequest("Only pending payouts can be approved.");
    }

    payout.status = "APPROVED";
    payout.approvedAt = new Date();
    payout.approvedBy = validId(actorId);
  } else if (input.status === "PAID") {
    if (payout.status !== "APPROVED") {
      throw ApiError.badRequest("Only approved payouts can be marked paid.");
    }

    if (!input.paymentReference) {
      throw ApiError.badRequest("Payment reference is required.");
    }

    payout.status = "PAID";
    payout.paidAt = new Date();
    payout.paidBy = validId(actorId);
    payout.paymentReference = input.paymentReference;
  } else if (input.status === "CANCELLED") {
    if (payout.status !== "PENDING" && payout.status !== "APPROVED") {
      throw ApiError.badRequest(
        "Only pending or approved payouts can be cancelled.",
      );
    }

    payout.status = "CANCELLED";
  }

  if (input.notes !== undefined) payout.notes = input.notes;

  await payout.save();
  return payout;
};
