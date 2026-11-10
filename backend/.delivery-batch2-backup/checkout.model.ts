import { Schema, model, models, type Model } from "mongoose";

import {
  CHECKOUT_PAYMENT_STATUSES,
  CHECKOUT_STATUSES,
  type Checkout,
} from "./checkout.types";

const checkoutAddressSnapshotSchema = new Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      maxlength: 30,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 254,
    },
    addressLine1: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    addressLine2: {
      type: String,
      trim: true,
      maxlength: 200,
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
    postalCode: {
      type: String,
      trim: true,
      maxlength: 30,
    },
    country: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
  },
  {
    _id: false,
    strict: "throw",
  },
);

const checkoutItemSnapshotSchema = new Schema(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    sellerId: { type: Schema.Types.ObjectId, ref: "Seller", immutable: true },
    variantId: {
      type: Schema.Types.ObjectId,
      ref: "ProductVariant",
    },
    sku: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    productName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 250,
    },
    variantName: {
      type: String,
      trim: true,
      maxlength: 250,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      max: 1000,
      validate: {
        validator: Number.isInteger,
        message: "Quantity must be an integer.",
      },
    },
    trackInventory: {
      type: Boolean,
      required: true,
    },
    allowOverselling: {
      type: Boolean,
      required: true,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    compareAtPrice: {
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
    lineSubtotal: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    _id: true,
    strict: "throw",
  },
);

const checkoutTotalsSchema = new Schema(
  {
    currency: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 3,
    },
    itemCount: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "Item count must be an integer.",
      },
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    discountAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    shippingAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    taxAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    _id: false,
    strict: "throw",
  },
);

const checkoutSchema = new Schema<Checkout>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
      index: true,
    },
    checkoutToken: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      immutable: true,
    },
    idempotencyKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
      immutable: true,
    },
    status: {
      type: String,
      enum: CHECKOUT_STATUSES,
      default: "PENDING",
      required: true,
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: CHECKOUT_PAYMENT_STATUSES,
      default: "PENDING",
      required: true,
      index: true,
    },
    items: {
      type: [checkoutItemSnapshotSchema],
      required: true,
      validate: {
        validator: (items: unknown[]) => items.length > 0,
        message: "Checkout must contain at least one item.",
      },
    },
    shippingAddress: {
      type: checkoutAddressSnapshotSchema,
      required: true,
    },
    billingAddress: {
      type: checkoutAddressSnapshotSchema,
    },
    shippingMethod: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    paymentMethod: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    couponCode: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 50,
    },
    totals: {
      type: checkoutTotalsSchema,
      required: true,
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    completedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    strict: "throw",
    collection: "checkouts",
    versionKey: false,
  },
);

checkoutSchema.index(
  { userId: 1, idempotencyKey: 1 },
  {
    unique: true,
    name: "unique_checkout_idempotency_per_user",
  },
);

checkoutSchema.index(
  { userId: 1, status: 1, createdAt: -1 },
  { name: "checkout_user_status_created" },
);

checkoutSchema.index(
  { expiresAt: 1 },
  {
    expireAfterSeconds: 0,
    name: "checkout_expiry_ttl",
  },
);

checkoutSchema.pre("validate", function () {
  const currency = this.totals?.currency?.toUpperCase();

  if (
    currency &&
    this.items.some((item) => item.currency.toUpperCase() !== currency)
  ) {
    this.invalidate(
      "items",
      "All checkout items must use the checkout currency.",
    );
  }

  const calculatedItemCount = this.items.reduce(
    (sum, item) => sum + item.quantity,
    0,
  );

  if (this.totals && this.totals.itemCount !== calculatedItemCount) {
    this.invalidate(
      "totals.itemCount",
      "Item count does not match checkout items.",
    );
  }

  const calculatedSubtotal =
    Math.round(
      this.items.reduce(
        (sum, item) => sum + item.unitPrice * item.quantity,
        0,
      ) * 100,
    ) / 100;

  if (
    this.totals &&
    Math.abs(this.totals.subtotal - calculatedSubtotal) > 0.01
  ) {
    this.invalidate(
      "totals.subtotal",
      "Subtotal does not match checkout items.",
    );
  }

  if (this.totals) {
    const calculatedTotal =
      Math.round(
        (this.totals.subtotal -
          this.totals.discountAmount +
          this.totals.shippingAmount +
          this.totals.taxAmount) *
          100,
      ) / 100;

    if (Math.abs(this.totals.totalAmount - calculatedTotal) > 0.01) {
      this.invalidate(
        "totals.totalAmount",
        "Total amount does not match checkout totals.",
      );
    }
  }
});

export const CheckoutModel =
  (models.Checkout as Model<Checkout> | undefined) ??
  model<Checkout>("Checkout", checkoutSchema);

export default CheckoutModel;
