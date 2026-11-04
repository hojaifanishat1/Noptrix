import { Schema, model, models, type Model } from "mongoose";

import {
  CANCELLATION_REASONS,
  CANCELLATION_STATUSES,
  type Cancellation,
} from "./cancellation.types";

const cancellationItemSchema = new Schema(
  {
    orderItemId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    variantId: {
      type: Schema.Types.ObjectId,
      required: false,
    },
    productName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: "Quantity must be an integer.",
      },
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    lineTotal: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false },
);

const cancellationSchema = new Schema<Cancellation>(
  {
    cancellationNumber: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
      uppercase: true,
      maxlength: 40,
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

    reason: {
      type: String,
      enum: CANCELLATION_REASONS,
      required: true,
    },

    customerNote: {
      type: String,
      trim: true,
      maxlength: 1000,
    },

    items: {
      type: [cancellationItemSchema],
      required: true,
      validate: {
        validator: (items: unknown[]) =>
          Array.isArray(items) && items.length > 0,
        message: "At least one cancellation item is required.",
      },
    },

    status: {
      type: String,
      enum: CANCELLATION_STATUSES,
      default: "PENDING",
      required: true,
      index: true,
    },

    requestedRefundAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    approvedRefundAmount: {
      type: Number,
      min: 0,
    },

    currency: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 3,
    },

    reviewedBy: {
      type: Schema.Types.ObjectId,
    },

    reviewedByRole: {
      type: String,
      enum: ["OWNER", "ADMIN"],
    },

    reviewedAt: Date,

    reviewNote: {
      type: String,
      trim: true,
      maxlength: 1000,
    },

    completedAt: Date,
    rejectedAt: Date,
  },
  {
    timestamps: true,
    versionKey: "__v",
    strict: "throw",
  },
);

cancellationSchema.index({
  userId: 1,
  createdAt: -1,
});

cancellationSchema.index({
  orderId: 1,
  status: 1,
});

cancellationSchema.index({
  status: 1,
  createdAt: -1,
});

cancellationSchema.pre("validate", function () {
  if (
    this.approvedRefundAmount !== undefined &&
    this.approvedRefundAmount > this.requestedRefundAmount
  ) {
    this.invalidate(
      "approvedRefundAmount",
      "Approved refund cannot exceed the requested refund amount.",
    );
  }

  if (this.status === "APPROVED" || this.status === "COMPLETED") {
    if (this.approvedRefundAmount === undefined) {
      this.invalidate(
        "approvedRefundAmount",
        "An approved refund amount is required.",
      );
    }
  }

  if (this.status === "REJECTED" && !this.rejectedAt) {
    this.rejectedAt = new Date();
  }

  if (this.status === "COMPLETED" && !this.completedAt) {
    this.completedAt = new Date();
  }
});

export const CancellationModel =
  (models.Cancellation as Model<Cancellation>) ||
  model<Cancellation>("Cancellation", cancellationSchema);

export default CancellationModel;
