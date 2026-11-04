import { Schema, model, models, type Model } from "mongoose";

import { REFUND_REASONS, REFUND_STATUSES, type Refund } from "./refund.types";

const refundTransactionSchema = new Schema(
  {
    provider: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    providerRefundId: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    status: {
      type: String,
      enum: REFUND_STATUSES,
      required: true,
    },
    responseCode: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    responseMessage: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    processedAt: Date,
    manualReference: {
      type: String,
      trim: true,
      maxlength: 200,
    },
  },
  { _id: false, strict: "throw" },
);

const refundSchema = new Schema<Refund>(
  {
    refundNumber: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
      uppercase: true,
      maxlength: 50,
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      immutable: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
      index: true,
    },
    paymentId: {
      type: Schema.Types.ObjectId,
      ref: "Payment",
    },
    cancellationId: {
      type: Schema.Types.ObjectId,
      ref: "Cancellation",
    },
    returnId: {
      type: Schema.Types.ObjectId,
      ref: "ReturnRequest",
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
      validate: {
        validator: (value: number) =>
          Number.isFinite(value) && Math.round(value * 100) === value * 100,
        message: "Refund amount must be finite and have at most two decimals.",
      },
    },
    currency: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 3,
      match: /^[A-Z]{3}$/,
    },
    reason: {
      type: String,
      enum: REFUND_REASONS,
      required: true,
    },
    customerNote: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    internalNote: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    status: {
      type: String,
      enum: REFUND_STATUSES,
      default: "PENDING",
      required: true,
      index: true,
    },
    requestedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    processedBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
    },
    transaction: {
      type: refundTransactionSchema,
    },
    idempotencyKey: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      maxlength: 200,
    },
    requestedAt: {
      type: Date,
      required: true,
      default: Date.now,
      immutable: true,
    },
    processedAt: Date,
    failedAt: Date,
    cancelledAt: Date,
  },
  {
    timestamps: true,
    versionKey: "__v",
    strict: "throw",
  },
);

refundSchema.index({ idempotencyKey: 1 }, { unique: true });
refundSchema.index({ userId: 1, createdAt: -1 });
refundSchema.index({ orderId: 1, status: 1 });
refundSchema.index({ status: 1, createdAt: -1 });

refundSchema.index(
  { cancellationId: 1 },
  {
    unique: true,
    partialFilterExpression: { cancellationId: { $type: "objectId" } },
  },
);

refundSchema.index(
  { returnId: 1 },
  {
    unique: true,
    partialFilterExpression: { returnId: { $type: "objectId" } },
  },
);

refundSchema.pre("validate", function () {
  if (this.status === "SUCCEEDED" && !this.processedAt) {
    this.processedAt = new Date();
  }

  if (this.status === "FAILED" && !this.failedAt) {
    this.failedAt = new Date();
  }

  if (this.status === "CANCELLED" && !this.cancelledAt) {
    this.cancelledAt = new Date();
  }

  if (this.status === "SUCCEEDED" && !this.transaction) {
    this.invalidate(
      "transaction",
      "Successful refunds require transaction details.",
    );
  }

  if (
    this.transaction &&
    this.transaction.status !== this.status
  ) {
    this.invalidate(
      "transaction.status",
      "Transaction status must match refund status.",
    );
  }
});

export const RefundModel =
  (models.Refund as Model<Refund> | undefined) ??
  model<Refund>("Refund", refundSchema);

export default RefundModel;
