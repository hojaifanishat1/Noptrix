import { Schema, model, models, type Model } from "mongoose";

import {
  DELIVERY_STATUSES,
  type IDelivery,
  type IDeliveryEvent,
} from "./delivery.types";

const deliveryEventSchema = new Schema<IDeliveryEvent>(
  {
    eventId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    status: {
      type: String,
      enum: DELIVERY_STATUSES,
      required: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },

    location: {
      type: String,
      trim: true,
      maxlength: 200,
    },

    occurredAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: {
      createdAt: true,
      updatedAt: false,
    },
  },
);

const deliverySchema = new Schema<IDelivery>(
  {
    deliveryNumber: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
      index: true,
    },

    orderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },

    shipmentId: {
      type: Schema.Types.ObjectId,
      ref: "Shipping",
      index: true,
    },

    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      index: true,
    },

    riderId: {
      type: Schema.Types.ObjectId,
      ref: "Rider",
      index: true,
    },

    status: {
      type: String,
      enum: DELIVERY_STATUSES,
      default: "pending",
      required: true,
      index: true,
    },

    recipientName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    recipientPhone: {
      type: String,
      required: true,
      trim: true,
      maxlength: 30,
    },

    address: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },

    city: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    deliveryFee: {
      type: Number,
      required: true,
      min: 0,
    },

    currency: {
      type: String,
      required: true,
      uppercase: true,
      minlength: 3,
      maxlength: 3,
      default: "BDT",
    },

    riderEarningAmount: {
      type: Number,
      min: 0,
    },

    riderEarningCurrency: {
      type: String,
      trim: true,
      uppercase: true,
      minlength: 3,
      maxlength: 3,
      default: "BDT",
    },

    assignedAt: {
      type: Date,
    },

    acceptedAt: {
      type: Date,
    },

    pickedUpAt: {
      type: Date,
    },

    deliveredAt: {
      type: Date,
    },

    cancelledAt: {
      type: Date,
    },

    attemptCount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    failureReason: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    proofOfDeliveryUrl: {
      type: String,
      trim: true,
      maxlength: 2048,
    },

    recipientSignatureUrl: {
      type: String,
      trim: true,
      maxlength: 2048,
    },

    events: {
      type: [deliveryEventSchema],
      default: [],
    },

    idempotencyKey: {
      type: String,
      trim: true,
      maxlength: 200,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
    },
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
  },
);

deliverySchema.index({
  orderId: 1,
  createdAt: -1,
});

deliverySchema.index({
  riderId: 1,
  status: 1,
  updatedAt: -1,
});

deliverySchema.index({
  customerId: 1,
  createdAt: -1,
});

deliverySchema.index(
  { idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      idempotencyKey: { $type: "string" },
    },
  },
);

export const Delivery: Model<IDelivery> =
  (models.Delivery as Model<IDelivery>) ||
  model<IDelivery>("Delivery", deliverySchema);
