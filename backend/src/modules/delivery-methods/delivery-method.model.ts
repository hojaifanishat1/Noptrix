import mongoose, { Schema, model, type Model } from "mongoose";

import type { DeliveryMethod } from "./delivery-method.types";

const deliveryMethodSchema = new Schema<DeliveryMethod>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: 40,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    estimatedMinMinutes: {
      type: Number,
      required: true,
      min: 1,
    },

    estimatedMaxMinutes: {
      type: Number,
      required: true,
      min: 1,
    },

    maximumDistanceKm: {
      type: Number,
      min: 0,
    },

    requiresLiveRider: {
      type: Boolean,
      default: false,
      required: true,
    },

    requiresAreaCoverage: {
      type: Boolean,
      default: true,
      required: true,
    },

    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
      required: true,
      index: true,
    },

    priority: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
    strict: "throw",
    collection: "delivery_methods",
  },
);

deliveryMethodSchema.pre("validate", function () {
  if (
    this.estimatedMinMinutes > this.estimatedMaxMinutes
  ) {
    this.invalidate(
      "estimatedMaxMinutes",
      "Maximum estimate must be greater than minimum estimate.",
    );
  }
});

export const DeliveryMethodModel: Model<DeliveryMethod> =
  (mongoose.models.DeliveryMethod as Model<DeliveryMethod> | undefined) ??
  model<DeliveryMethod>("DeliveryMethod", deliveryMethodSchema);

export default DeliveryMethodModel;
