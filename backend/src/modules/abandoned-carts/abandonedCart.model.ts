import mongoose, { Schema, type Model } from "mongoose";
import {
  ABANDONED_CART_STATUSES,
  type AbandonedCart,
} from "./abandonedCart.types";

const abandonedCartSchema = new Schema<AbandonedCart>(
  {
    cartId: {
      type: Schema.Types.ObjectId,
      ref: "Cart",
      required: true,
      index: true,
    },

    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: ABANDONED_CART_STATUSES,
      default: "OPEN",
      required: true,
      index: true,
    },

    cartStatusAtCapture: {
      type: String,
      enum: ["ACTIVE", "CONVERTED", "ABANDONED"],
      required: true,
    },

    items: {
      type: [Schema.Types.Mixed],
      required: true,
      default: [],
    } as unknown as import("mongoose").SchemaDefinitionProperty<
      AbandonedCart["items"],
      AbandonedCart
    >,

    currency: {
      type: String,
      required: true,
      uppercase: true,
      minlength: 3,
      maxlength: 3,
    },

    itemCount: {
      type: Number,
      required: true,
      min: 0,
    },

    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },

    couponCode: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 80,
    },

    abandonedAt: {
      type: Date,
      required: true,
      index: true,
    },

    recoveryTokenHash: {
      type: String,
      select: false,
    },

    recoveryTokenExpiresAt: {
      type: Date,
    },

    emailClaimToken: {
      type: String,
      select: false,
    },

    emailClaimExpiresAt: {
      type: Date,
      index: true,
    },

    emailSentAt: {
      type: Date,
    },

    lastEmailAt: {
      type: Date,
    },

    reminderCount: {
      type: Number,
      default: 0,
      min: 0,
      max: 2,
    },

    recoveredAt: {
      type: Date,
    },

    convertedAt: {
      type: Date,
    },

    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    strict: "throw",
    collection: "abandoned_carts",
  },
);

abandonedCartSchema.index(
  { cartId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "OPEN" },
    name: "one_open_abandoned_record_per_cart",
  },
);

abandonedCartSchema.index({ status: 1, abandonedAt: -1 });
abandonedCartSchema.index({ userId: 1, status: 1, createdAt: -1 });
abandonedCartSchema.index({ status: 1, lastEmailAt: 1 });
abandonedCartSchema.index({ status: 1, emailClaimExpiresAt: 1 });


export const AbandonedCartModel: Model<AbandonedCart> =
  (mongoose.models.AbandonedCart as Model<AbandonedCart> | undefined) ??
  mongoose.model<AbandonedCart>("AbandonedCart", abandonedCartSchema);

export default AbandonedCartModel;
