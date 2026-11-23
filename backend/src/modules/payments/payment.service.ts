import { Types } from "mongoose";

import { ApiError } from "../../utils/ApiError";
import { OrderModel } from "../orders/order.model";
import { Payment } from "./payment.model";
import { reservePayment } from "./payment.persistence.service";
import {
  Transaction,
  TRANSACTION_TYPES,
} from "../transactions/transaction.model";
import { awardLoyaltyPointsForOrder } from "../loyalty/loyalty.service";
import { dispatchAutomationEvent } from "../automation/automation.service";

import {
  createPayment,
  getPaymentMethodAvailability,
} from "../../services/payment.service";

type RequestedMethod = "cod" | "online";

function requireObjectId(value: string, label: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw ApiError.badRequest(`${label} is invalid.`);
  }

  return new Types.ObjectId(value);
}

function normalizeMethod(value: unknown): RequestedMethod {
  if (typeof value !== "string") {
    throw ApiError.badRequest("Payment method is required.");
  }

  const method = value.trim().toLowerCase();

  if (method !== "cod" && method !== "online") {
    throw ApiError.badRequest("Unsupported payment method.");
  }

  return method;
}

function providerFor(method: RequestedMethod): string {
  if (method === "cod") return "none";

  // The payment service resolves the configured provider.
  // Do not accept a provider chosen by the public client.
  return "configured";
}

export async function initiateCustomerPayment(input: {
  customerId: string;
  orderId: string;
  method: unknown;
  idempotencyKey: string;
}) {
  const customerId = requireObjectId(input.customerId, "Customer ID");
  const orderId = requireObjectId(input.orderId, "Order ID");
  const method = normalizeMethod(input.method);

  const key = input.idempotencyKey.trim();

  if (key.length < 8 || key.length > 200) {
    throw ApiError.badRequest(
      "Idempotency-Key must contain between 8 and 200 characters.",
    );
  }

  const availability = getPaymentMethodAvailability();

  if (method === "cod" && !availability.cod) {
    throw ApiError.badRequest("Cash on Delivery is unavailable.");
  }

  if (method === "online" && !availability.online) {
    throw ApiError.badRequest("Online payment is unavailable.");
  }

  const order = await OrderModel.findOne({
    _id: orderId,
    userId: customerId,
  }).exec();

  if (!order) {
    throw ApiError.notFound("Order not found.");
  }

  if (!["PENDING", "FAILED"].includes(order.paymentStatus)) {
    throw ApiError.conflict(
      "This order is not available for a new payment attempt.",
    );
  }

  const orderMethod = order.paymentMethod.trim().toLowerCase();

  if (
    (orderMethod === "cod" || orderMethod === "online") &&
    orderMethod !== method
  ) {
    throw ApiError.badRequest("Payment method does not match the order.");
  }

  const amount = Math.round(order.totals.totalAmount * 100) / 100;
  const currency = order.totals.currency.toUpperCase();

  if (!Number.isFinite(amount) || amount <= 0) {
    throw ApiError.badRequest("Order total is not payable.");
  }

  if (!/^[A-Z]{3}$/.test(currency)) {
    throw ApiError.badRequest("Order currency is invalid.");
  }

  const reserved = await reservePayment({
    customerId: customerId.toString(),
    orderId: order._id.toString(),
    amount,
    currency,
    method,
    provider: providerFor(method),
    idempotencyKey: key,
    metadata: {
      orderNumber: order.orderNumber,
    },
  });

  if (reserved.reused) {
    const existing = reserved.payment;

    return {
      reused: true,
      payment: {
        transactionId: existing.transactionId,
        orderId: existing.orderId,
        amount: existing.amount,
        currency: existing.currency,
        method: existing.method,
        provider: existing.provider,
        status: existing.status,
        redirectUrl: existing.redirectUrl,
        checkoutUrl: existing.checkoutUrl,
      },
    };
  }

  const payment = reserved.payment;

  try {
    const result = await createPayment({
      transactionId: payment.transactionId,
      orderId: order._id.toString(),
      amount,
      currency,
      method,
      description: `Order ${order.orderNumber}`,
      metadata: {
        orderNumber: order.orderNumber,
      },
    });

    const response = result.providerResponse;
    const status = result.transaction.status;

    const updated = await Payment.findByIdAndUpdate(
      payment._id,
      {
        $set: {
          status,
          providerTransactionId: response?.providerTransactionId,
          redirectUrl: result.transaction.redirectUrl,
          checkoutUrl: result.transaction.checkoutUrl,
          paidAt: status === "success" ? new Date() : undefined,
        },
      },
      { new: true, runValidators: true },
    )
      .select("-idempotencyKey -requestFingerprint")
      .exec();

    if (!updated) {
      throw ApiError.internal(
        "Payment reservation disappeared during initiation.",
      );
    }

    if (status === "success") {
      await OrderModel.updateOne(
        { _id: updated.orderId },
        { $set: { paymentStatus: "PAID" } },
      ).exec();
      await awardLoyaltyPointsForOrder(updated.orderId.toString());
    }

    await Transaction.create({
      paymentId: updated._id,
      transactionId: updated.transactionId,
      orderId: updated.orderId,
      type: TRANSACTION_TYPES.PAYMENT_CREATED,
      status: updated.status,
      amount: updated.amount,
      currency: updated.currency,
      provider: updated.provider,
      actorId: customerId,
      details: {
        method: updated.method,
        orderNumber: order.orderNumber,
      },
    });

    if (status === "success") {
      await dispatchAutomationEvent(
        "PAYMENT_COMPLETED",
        {
          paymentId: updated._id.toString(),
          transactionId: updated.transactionId,
          orderId: updated.orderId.toString(),
          amount: updated.amount,
          currency: updated.currency,
          method: updated.method,
          provider: updated.provider,
          status: updated.status,
        },
        `payment-completed:${updated._id.toString()}`,
      );
    }

    return {
      reused: false,
      payment: {
        transactionId: updated.transactionId,
        referenceId: updated.referenceId,
        orderId: updated.orderId,
        amount: updated.amount,
        currency: updated.currency,
        method: updated.method,
        provider: updated.provider,
        status: updated.status,
        redirectUrl: updated.redirectUrl,
        checkoutUrl: updated.checkoutUrl,
      },
    };
  } catch (error) {
    await Payment.updateOne(
      {
        _id: payment._id,
        status: { $in: ["created", "pending"] },
      },
      {
        $set: {
          status: "failed",
          failureCode: "PAYMENT_INITIATION_FAILED",
          failureMessage: "Payment initiation failed.",
        },
      },
    ).exec();

    throw error;
  }
}

/**
 * List payments belonging to the authenticated customer.
 * Sensitive provider and internal fields are excluded from the response.
 */
export async function listCustomerPayments(
  customerId: string,
  page = 1,
  limit = 20,
) {
  const safePage = Math.max(1, Math.floor(page));
  const safeLimit = Math.min(100, Math.max(1, Math.floor(limit)));
  const skip = (safePage - 1) * safeLimit;

  const filter = { customerId };

  const [payments, total] = await Promise.all([
    Payment.find(filter)
      .select(
        "transactionId referenceId orderId amount currency method provider status redirectUrl checkoutUrl paidAt expiresAt createdAt updatedAt",
      )
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean(),
    Payment.countDocuments(filter),
  ]);

  return {
    payments,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit),
      hasNextPage: skip + payments.length < total,
      hasPreviousPage: safePage > 1,
    },
  };
}

/**
 * Retrieve one payment owned by the authenticated customer.
 */
export async function getCustomerPayment(
  customerId: string,
  transactionId: string,
) {
  const payment = await Payment.findOne({
    customerId,
    transactionId: transactionId.trim(),
  })
    .select(
      "transactionId referenceId orderId amount currency method provider status redirectUrl checkoutUrl paidAt expiresAt createdAt updatedAt",
    )
    .lean();

  if (!payment) {
    throw ApiError.notFound("Payment not found");
  }

  return payment;
}
