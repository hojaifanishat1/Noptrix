import mongoose, { Schema, model, type Model } from "mongoose";

import type { AreaFeeOverride } from "./area-fee-override.types";

const areaFeeOverrideSchema = new Schema<AreaFeeOverride>(
  {
    areaId: {
      type: Schema.Types.ObjectId,
      ref: "DeliveryArea",
      required: true,
      index: true,
    },

    methodId: {
      type: Schema.Types.ObjectId,
      ref: "DeliveryMethod",
      index: true,
    },

    fee: {
      type: Number,
      required: true,
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

    currency: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 3,
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
      default: 100,
      min: 0,
    },

    validFrom: Date,
    validUntil: Date,
  },
  {
    timestamps: true,
    strict: "throw",
    collection: "area_fee_overrides",
  },
);

areaFeeOverrideSchema.index({
  areaId: 1,
  methodId: 1,
  status: 1,
  priority: -1,
});

areaFeeOverrideSchema.pre("validate", function () {
  if (
    this.validFrom &&
    this.validUntil &&
    this.validFrom >= this.validUntil
  ) {
    this.invalidate(
      "validUntil",
      "validUntil must be later than validFrom.",
    );
  }
});

export const AreaFeeOverrideModel: Model<AreaFeeOverride> =
  (mongoose.models.AreaFeeOverride as Model<AreaFeeOverride> | undefined) ??
  model<AreaFeeOverride>(
    "AreaFeeOverride",
    areaFeeOverrideSchema,
  );

export default AreaFeeOverrideModel;
