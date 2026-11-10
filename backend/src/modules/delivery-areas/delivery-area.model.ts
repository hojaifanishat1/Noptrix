import mongoose, { Schema, model, type Model } from "mongoose";

import type { DeliveryArea } from "./delivery-area.types";

const deliveryAreaSchema = new Schema<DeliveryArea>(
  {
    zoneId: {
      type: Schema.Types.ObjectId,
      ref: "DeliveryZone",
      required: true,
      index: true,
    },

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
      maxlength: 150,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    city: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    state: {
      type: String,
      trim: true,
      maxlength: 100,
    },

    postalCodes: {
      type: [String],
      default: [],
    },

    boundary: {
      type: {
        type: String,
        enum: ["Polygon"],
      },
      coordinates: {
        type: [[[Number]]],
      },
    },

    center: {
      latitude: { type: Number, min: -90, max: 90 },
      longitude: { type: Number, min: -180, max: 180 },
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
      max: 100000,
    },
  },
  {
    timestamps: true,
    strict: "throw",
    collection: "delivery_areas",
  },
);

deliveryAreaSchema.index(
  { zoneId: 1, slug: 1 },
  { unique: true },
);

deliveryAreaSchema.index(
  { boundary: "2dsphere" },
  {
    partialFilterExpression: {
      "boundary.type": "Polygon",
    },
  },
);

deliveryAreaSchema.index({
  city: 1,
  status: 1,
  priority: -1,
});

deliveryAreaSchema.pre("validate", function () {
  const boundary = this.boundary;

  if (boundary?.type === "Polygon") {
    const ring = boundary.coordinates?.[0];

    if (!ring || ring.length < 4) {
      this.invalidate(
        "boundary",
        "Polygon must contain at least four coordinates.",
      );
    }
  }
});

export const DeliveryAreaModel: Model<DeliveryArea> =
  (mongoose.models.DeliveryArea as Model<DeliveryArea> | undefined) ??
  model<DeliveryArea>("DeliveryArea", deliveryAreaSchema);

export default DeliveryAreaModel;
