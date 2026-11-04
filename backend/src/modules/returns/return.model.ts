import { Schema, model, models, type Model } from "mongoose";

import {
  RETURN_REASONS,
  RETURN_RESOLUTIONS,
  RETURN_STATUSES,
  type ReturnRequest,
} from "./return.types";

const returnItemSchema = new Schema(
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
    },
    productName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    sku: {
      type: String,
      trim: true,
      maxlength: 100,
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
    reason: {
      type: String,
      enum: RETURN_REASONS,
      required: true,
    },
    customerNote: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    evidenceUrls: {
      type: [String],
      default: [],
      validate: {
        validator: (urls: string[]) =>
          urls.every((url) => /^https?:\/\//i.test(url)),
        message: "Evidence URLs must be valid HTTP(S) URLs.",
      },
    },
    receivedQuantity: {
      type: Number,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "Received quantity must be an integer.",
      },
    },
    acceptedQuantity: {
      type: Number,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "Accepted quantity must be an integer.",
      },
    },
    inspectionNote: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
  },
  { _id: false },
);

const returnSchema = new Schema<ReturnRequest>(
  {
    returnNumber: {
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

    items: {
      type: [returnItemSchema],
      required: true,
      validate: {
        validator: (items: unknown[]) =>
          Array.isArray(items) && items.length > 0,
        message: "At least one return item is required.",
      },
    },

    status: {
      type: String,
      enum: RETURN_STATUSES,
      default: "PENDING",
      required: true,
      index: true,
    },

    resolution: {
      type: String,
      enum: RETURN_RESOLUTIONS,
      required: true,
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

    customerNote: {
      type: String,
      trim: true,
      maxlength: 1000,
    },

    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
    },

    reviewedAt: Date,

    reviewNote: {
      type: String,
      trim: true,
      maxlength: 1000,
    },

    inspectionNote: {
      type: String,
      trim: true,
      maxlength: 1000,
    },

    receivedAt: Date,
    inspectedAt: Date,
    completedAt: Date,
    rejectedAt: Date,
    cancelledAt: Date,

    refundId: {
      type: Schema.Types.ObjectId,
      ref: "Refund",
    },
  },
  {
    timestamps: true,
    versionKey: "__v",
    strict: "throw",
  },
);

returnSchema.index({ userId: 1, createdAt: -1 });
returnSchema.index({ orderId: 1, status: 1 });
returnSchema.index({ status: 1, createdAt: -1 });

returnSchema.pre("validate", function () {
  if (
    this.approvedRefundAmount !== undefined &&
    this.approvedRefundAmount > this.requestedRefundAmount
  ) {
    this.invalidate(
      "approvedRefundAmount",
      "Approved refund cannot exceed the requested refund amount.",
    );
  }

  for (const item of this.items) {
    if (item.acceptedQuantity > item.receivedQuantity) {
      this.invalidate(
        "items",
        "Accepted quantity cannot exceed received quantity.",
      );
    }

    if (item.receivedQuantity > item.quantity) {
      this.invalidate(
        "items",
        "Received quantity cannot exceed requested quantity.",
      );
    }
  }

  if (this.status === "REJECTED" && !this.rejectedAt) {
    this.rejectedAt = new Date();
  }

  if (this.status === "RECEIVED" && !this.receivedAt) {
    this.receivedAt = new Date();
  }

  if (this.status === "INSPECTING" && !this.inspectedAt) {
    this.inspectedAt = new Date();
  }

  if (this.status === "COMPLETED" && !this.completedAt) {
    this.completedAt = new Date();
  }

  if (this.status === "CANCELLED" && !this.cancelledAt) {
    this.cancelledAt = new Date();
  }
});

export const ReturnModel =
  (models.ReturnRequest as Model<ReturnRequest>) ||
  model<ReturnRequest>("ReturnRequest", returnSchema);

export default ReturnModel;
