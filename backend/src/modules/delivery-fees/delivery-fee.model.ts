import { Schema, model, models, type Model } from "mongoose";

import type { IDeliveryFee } from "./delivery-fee.types";

const deliveryFeeSchema = new Schema<IDeliveryFee>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      maxlength: 160,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
    },

    country: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      minlength: 2,
      maxlength: 3,
    },
    state: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    city: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    deliveryZoneId: {
      type: Schema.Types.ObjectId,
      ref: "DeliveryZone",
    },
    deliveryMethodId: {
      type: Schema.Types.ObjectId,
      ref: "DeliveryMethod",
    },
    postalCodes: {
      type: [String],
      default: [],
      validate: {
        validator: (value: string[]) =>
          value.every((item) => item.trim().length > 0),
        message: "Postal codes cannot contain empty values.",
      },
    },

    method: {
      type: String,
      enum: ["flat", "weight_based", "order_value_based"],
      required: true,
      default: "flat",
    },
    baseFee: {
      type: Number,
      required: true,
      min: 0,
    },
    perKgFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    freeDeliveryThreshold: {
      type: Number,
      min: 0,
    },
    minimumOrderAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    minimumWeightKg: {
      type: Number,
      default: 0,
      min: 0,
    },
    maximumWeightKg: {
      type: Number,
      min: 0,
    },

    supportsCOD: {
      type: Boolean,
      default: true,
    },
    priority: {
      type: Number,
      default: 0,
      min: 0,
      max: 100000,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      required: true,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
    },
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
    versionKey: "__v",
  },
);

deliveryFeeSchema.index({
  country: 1,
  status: 1,
  priority: -1,
});

deliveryFeeSchema.index({
  country: 1,
  city: 1,
  status: 1,
  priority: -1,
});

deliveryFeeSchema.index({
  deliveryZoneId: 1,
  deliveryMethodId: 1,
  status: 1,
  priority: -1,
});

deliveryFeeSchema.index({
  postalCodes: 1,
  status: 1,
});

deliveryFeeSchema.pre("validate", function () {
  if (
    this.maximumWeightKg !== undefined &&
    this.maximumWeightKg < this.minimumWeightKg
  ) {
    this.invalidate(
      "maximumWeightKg",
      "Maximum weight must be greater than or equal to minimum weight.",
    );
  }

  if (this.method !== "weight_based" && this.perKgFee !== 0) {
    this.invalidate(
      "perKgFee",
      "perKgFee must be zero unless method is weight_based.",
    );
  }
});

export const DeliveryFee: Model<IDeliveryFee> =
  (models.DeliveryFee as Model<IDeliveryFee>) ||
  model<IDeliveryFee>("DeliveryFee", deliveryFeeSchema);
