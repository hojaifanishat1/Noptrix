import { createHmac, timingSafeEqual, createHash } from "node:crypto";
import axios from "axios";
import { Types } from "mongoose";

import { env } from "../../config/env";
import {
  getPaymentWebhookSecret,
  getPaymentConfig,
  PAYMENT_PROVIDERS,
} from "../../config/payment";
import { ApiError } from "../../utils/ApiError";
import { logger } from "../../utils/logger";
import { Payment } from "../payments/payment.model";
import {
  Transaction,
  TRANSACTION_TYPES,
} from "../transactions/transaction.model";
import { OrderModel } from "../orders/order.model";
import { awardLoyaltyPointsForOrder } from "../loyalty/loyalty.service";
import { dispatchAutomationEvent } from "../automation/automation.service";
import { WebhookEvent } from "./webhook.model";
import {
  generalWebhookSchema,
  sslCommerzIpnSchema,
  type GeneralWebhookPayload,
  type SslCommerzIpnPayload,
} from "./webhook.validator";

const MAX_BODY_BYTES = 1024 * 1024;

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === 11000
  );
}

function safeEqualHex(expected: string, received: string): boolean {
  const normalize = (value: string) =>
    value
      .trim()
      .replace(/^sha256=/i, "")
      .toLowerCase();

  const left = Buffer.from(normalize(expected), "hex");
  const right = Buffer.from(normalize(received), "hex");

  return (
    left.length > 0 &&
    left.length === right.length &&
    timingSafeEqual(left, right)
  );
}

/**
 * General webhook signature:
 * HMAC-SHA256 over the exact raw request bytes.
 */
export function verifyGeneralWebhookSignature(
  rawBody: Buffer,
  signature: string | undefined,
  secret: string,
): boolean {
  if (!signature || !secret || rawBody.length > MAX_BODY_BYTES) {
    return false;
  }

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");

  return safeEqualHex(expected, signature);
}

function getGeneralWebhookSecret(provider: string): string {
  // Use provider-specific secrets for integrations where available.
  const normalized = provider.toUpperCase().replace(/[^A-Z0-9]/g, "_");
  const specific = process.env[`${normalized}_WEBHOOK_SECRET`];

  if (specific && specific.length >= 16) {
    return specific;
  }

  // Payment secret is only a fallback for configured payment providers.
  if (provider === getPaymentConfig().provider) {
    return getPaymentWebhookSecret();
  }

  throw ApiError.unauthorized("Webhook signing secret is not configured.");
}

async function claimEvent(input: {
  provider: string;
  eventId: string;
  eventType: string;
  transactionId?: string;
}) {
  try {
    return await WebhookEvent.create({
      ...input,
      status: "processing",
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      const existing = await WebhookEvent.findOne({
        provider: input.provider,
        eventId: input.eventId,
      }).lean();

      if (existing?.status === "processed") {
        return null;
      }

      if (existing?.status === "failed") {
        const retry = await WebhookEvent.findOneAndUpdate(
          {
            _id: existing._id,
            status: "failed",
          },
          {
            $set: {
              ...input,
              status: "processing",
            },
            $unset: {
              failureCode: 1,
              processedAt: 1,
            },
          },
          { new: true },
        ).exec();

        if (retry) return retry;
      }

      throw ApiError.conflict("This webhook event has already been received.", {
        code: "DUPLICATE_WEBHOOK_EVENT",
      });
    }

    throw error;
  }
}

async function markEventProcessed(eventId: Types.ObjectId): Promise<void> {
  await WebhookEvent.updateOne(
    { _id: eventId, status: "processing" },
    {
      $set: {
        status: "processed",
        processedAt: new Date(),
      },
      $unset: { failureCode: 1 },
    },
  ).exec();
}

async function markEventFailed(
  eventId: Types.ObjectId,
  failureCode: string,
): Promise<void> {
  await WebhookEvent.updateOne(
    { _id: eventId },
    {
      $set: {
        status: "failed",
        failureCode,
      },
    },
  ).exec();
}

async function synchronizePaidOrder(
  orderId: Types.ObjectId | string,
): Promise<void> {
  await OrderModel.updateOne(
    { _id: orderId },
    { $set: { paymentStatus: "PAID" } },
  ).exec();
  await awardLoyaltyPointsForOrder(orderId.toString());
}

function normalizeProviderStatus(
  status: GeneralWebhookPayload["status"],
): string {
  switch (status) {
    case "pending":
      return "pending";
    case "processing":
      return "processing";
    case "success":
      return "success";
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
  }
}

/**
 * Process a signed, normalized webhook payload.
 *
 * This handler only changes payments that match the transaction ID,
 * amount, currency and provider. It never trusts the event status alone.
 */
export async function processGeneralWebhook(input: {
  provider: string;
  rawBody: Buffer;
  signature?: string;
  payload: unknown;
}) {
  const provider = input.provider.trim().toLowerCase();

  if (!/^[a-z0-9_-]{2,50}$/.test(provider)) {
    throw ApiError.badRequest("Invalid webhook provider.");
  }

  if (
    !Buffer.isBuffer(input.rawBody) ||
    input.rawBody.length === 0 ||
    input.rawBody.length > MAX_BODY_BYTES
  ) {
    throw ApiError.badRequest("Webhook body is invalid.");
  }

  const secret = getGeneralWebhookSecret(provider);

  if (!verifyGeneralWebhookSignature(input.rawBody, input.signature, secret)) {
    logger.warn({ provider }, "Webhook signature verification failed.");

    throw ApiError.unauthorized("Invalid webhook signature.", {
      code: "INVALID_WEBHOOK_SIGNATURE",
    });
  }

  const parsed = generalWebhookSchema.safeParse(input.payload);

  if (!parsed.success) {
    throw ApiError.badRequest("Invalid webhook payload.", {
      code: "INVALID_WEBHOOK_PAYLOAD",
    });
  }

  const payload = parsed.data;

  // The payment integration must explicitly support this provider.
  if (provider !== getPaymentConfig().provider) {
    throw ApiError.badRequest(
      "Webhook provider does not match the configured payment provider.",
    );
  }

  const event = await claimEvent({
    provider,
    eventId: payload.eventId,
    eventType: payload.eventType,
    transactionId: payload.transactionId,
  });

  if (!event) {
    return { received: true, duplicate: true };
  }

  try {
    const payment = await Payment.findOne({
      transactionId: payload.transactionId,
      provider,
    }).exec();

    if (!payment) {
      throw ApiError.notFound("Matching payment was not found.");
    }

    if (
      Math.round(Number(payment.amount) * 100) !==
        Math.round(payload.amount * 100) ||
      String(payment.currency).toUpperCase() !== payload.currency.toUpperCase()
    ) {
      throw ApiError.badRequest(
        "Webhook amount or currency does not match the payment.",
        { code: "PAYMENT_DETAILS_MISMATCH" },
      );
    }

    const targetStatus = normalizeProviderStatus(payload.status);

    // Never downgrade a successful payment via a delayed webhook.
    if (
      String(payment.status).toLowerCase() === "success" &&
      targetStatus !== "success"
    ) {
      await markEventProcessed(event._id);

      return {
        received: true,
        duplicate: false,
        ignored: true,
        reason: "payment_already_successful",
      };
    }

    if (String(payment.status).toLowerCase() === "success") {
      await synchronizePaidOrder(payment.orderId);
      await dispatchAutomationEvent(
        "PAYMENT_COMPLETED",
        {
          paymentId: payment._id.toString(),
          transactionId: payment.transactionId,
          orderId: payment.orderId.toString(),
          amount: payment.amount,
          currency: payment.currency,
          method: payment.method,
          provider: payment.provider,
          status: payment.status,
        },
        `payment-completed:${payment._id.toString()}`,
      );
      await markEventProcessed(event._id);

      return {
        received: true,
        duplicate: false,
        ignored: true,
        reason: "payment_already_successful",
      };
    }

    const updated = await Payment.findOneAndUpdate(
      {
        _id: payment._id,
        status: { $in: ["created", "pending", "processing"] },
      },
      {
        $set: {
          status: targetStatus,
          ...(targetStatus === "success" ? { paidAt: new Date() } : {}),
          ...(payload.providerTransactionId
            ? { providerTransactionId: payload.providerTransactionId }
            : {}),
        },
      },
      { new: true, runValidators: true },
    ).exec();

    if (updated) {
      const transactionType =
        targetStatus === "success"
          ? TRANSACTION_TYPES.PAYMENT_SUCCEEDED
          : targetStatus === "failed"
            ? TRANSACTION_TYPES.PAYMENT_FAILED
            : targetStatus === "cancelled"
              ? TRANSACTION_TYPES.PAYMENT_CANCELLED
              : targetStatus === "processing"
                ? TRANSACTION_TYPES.PAYMENT_PROCESSING
                : TRANSACTION_TYPES.PAYMENT_PENDING;

      try {
        await Transaction.create({
          paymentId: updated._id,
          transactionId: updated.transactionId,
          orderId: updated.orderId,
          type: transactionType,
          previousStatus: payment.status,
          status: updated.status,
          amount: updated.amount,
          currency: updated.currency,
          provider,
          providerEventId: payload.eventId,
          details: {
            eventType: payload.eventType,
          },
        });
      } catch (error) {
        // The unique providerEventId index prevents a duplicate
        // transaction record. Do not swallow unrelated DB errors.
        if (!isDuplicateKeyError(error)) {
          throw error;
        }
      }

      if (targetStatus === "success") {
        await synchronizePaidOrder(updated.orderId);
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
      } else if (targetStatus === "failed") {
        await OrderModel.updateOne(
          {
            _id: updated.orderId,
            paymentStatus: "PENDING",
          },
          { $set: { paymentStatus: "FAILED" } },
        ).exec();
      }
    }

    await markEventProcessed(event._id);

    logger.info(
      {
        provider,
        eventId: payload.eventId,
        transactionId: payload.transactionId,
        status: targetStatus,
      },
      "General webhook processed.",
    );

    return { received: true, duplicate: false };
  } catch (error) {
    await markEventFailed(event._id, "PROCESSING_FAILED");

    logger.error(
      {
        provider,
        eventId: payload.eventId,
        transactionId: payload.transactionId,
      },
      "General webhook processing failed.",
    );

    throw error;
  }
}

/**
 * Validate SSLCommerz IPN through SSLCommerz's own validation API.
 * An IPN status field by itself is not proof of payment.
 */
async function validateSslCommerzTransaction(payload: SslCommerzIpnPayload) {
  const storeId = process.env.SSLCOMMERZ_STORE_ID;
  const storePassword = process.env.SSLCOMMERZ_STORE_PASSWORD;

  if (!storeId || !storePassword) {
    throw ApiError.internal("SSLCommerz credentials are not configured.");
  }

  const baseUrl =
    env.NODE_ENV === "production"
      ? "https://securepay.sslcommerz.com/validator/api/validationserverAPI.php"
      : "https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php";

  const response = await axios.get(baseUrl, {
    params: {
      val_id: payload.val_id,
      store_id: storeId,
      store_passwd: storePassword,
      format: "json",
    },
    timeout: 15000,
    maxRedirects: 0,
    validateStatus: (status) => status >= 200 && status < 300,
  });

  const result = response.data as Record<string, unknown>;

  const status = String(result.status ?? "").toUpperCase();

  if (!["VALID", "VALIDATED"].includes(status)) {
    throw ApiError.unauthorized("SSLCommerz transaction validation failed.", {
      code: "SSLCOMMERZ_VALIDATION_FAILED",
    });
  }

  if (String(result.tran_id ?? "") !== payload.tran_id) {
    throw ApiError.badRequest("SSLCommerz transaction ID mismatch.");
  }

  return result;
}

export async function processSslCommerzIpn(rawPayload: unknown) {
  const parsed = sslCommerzIpnSchema.safeParse(rawPayload);

  if (!parsed.success) {
    throw ApiError.badRequest("Invalid SSLCommerz IPN payload.");
  }

  const payload = parsed.data;

  if (getPaymentConfig().provider !== PAYMENT_PROVIDERS.SSLCOMMERZ) {
    throw ApiError.badRequest(
      "SSLCommerz is not the configured payment provider.",
    );
  }

  const validated = await validateSslCommerzTransaction(payload);

  const payment = await Payment.findOne({
    transactionId: payload.tran_id,
    provider: PAYMENT_PROVIDERS.SSLCOMMERZ,
  }).exec();

  if (!payment) {
    throw ApiError.notFound("Matching SSLCommerz payment was not found.");
  }

  const validatedAmount = Number(validated.amount);
  const validatedCurrency = String(validated.currency ?? "").toUpperCase();

  if (
    !Number.isFinite(validatedAmount) ||
    Math.round(validatedAmount * 100) !==
      Math.round(Number(payment.amount) * 100) ||
    validatedCurrency !== String(payment.currency).toUpperCase()
  ) {
    throw ApiError.badRequest("SSLCommerz amount or currency mismatch.", {
      code: "PAYMENT_DETAILS_MISMATCH",
    });
  }

  const eventId = createHash("sha256")
    .update(`${payload.val_id}:${payload.tran_id}`)
    .digest("hex");

  const event = await claimEvent({
    provider: PAYMENT_PROVIDERS.SSLCOMMERZ,
    eventId,
    eventType: "IPN",
    transactionId: payload.tran_id,
  });

  if (!event) {
    return { received: true, duplicate: true };
  }

  try {
    const validatedStatus = String(validated.status ?? "").toUpperCase();

    const isSuccess = ["VALID", "VALIDATED"].includes(validatedStatus);

    if (!isSuccess) {
      throw ApiError.unauthorized("SSLCommerz payment is not valid.");
    }

    if (String(payment.status).toLowerCase() === "success") {
      await synchronizePaidOrder(payment.orderId);
      await dispatchAutomationEvent(
        "PAYMENT_COMPLETED",
        {
          paymentId: payment._id.toString(),
          transactionId: payment.transactionId,
          orderId: payment.orderId.toString(),
          amount: payment.amount,
          currency: payment.currency,
          method: payment.method,
          provider: payment.provider,
          status: payment.status,
        },
        `payment-completed:${payment._id.toString()}`,
      );
      await markEventProcessed(event._id);
      return { received: true, duplicate: false, ignored: true };
    }

    const updated = await Payment.findOneAndUpdate(
      {
        _id: payment._id,
        status: { $in: ["created", "pending", "processing"] },
      },
      {
        $set: {
          status: "success",
          paidAt: new Date(),
          providerTransactionId: String(
            validated.bank_tran_id ?? validated.tran_id ?? payload.tran_id,
          ),
        },
      },
      { new: true, runValidators: true },
    ).exec();

    if (updated) {
      try {
        await Transaction.create({
          paymentId: updated._id,
          transactionId: updated.transactionId,
          orderId: updated.orderId,
          type: TRANSACTION_TYPES.PAYMENT_SUCCEEDED,
          previousStatus: payment.status,
          status: updated.status,
          amount: updated.amount,
          currency: updated.currency,
          provider: PAYMENT_PROVIDERS.SSLCOMMERZ,
          providerEventId: eventId,
          details: { eventType: "IPN" },
        });
      } catch (error) {
        if (!isDuplicateKeyError(error)) {
          throw error;
        }
      }

      await synchronizePaidOrder(updated.orderId);
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

    await markEventProcessed(event._id);

    logger.info(
      {
        provider: PAYMENT_PROVIDERS.SSLCOMMERZ,
        eventId,
        transactionId: payload.tran_id,
        status: "success",
      },
      "SSLCommerz IPN validated and processed.",
    );

    return { received: true, duplicate: false };
  } catch (error) {
    await markEventFailed(event._id, "PROCESSING_FAILED");
    throw error;
  }
}
