import { Schema, model, models, type Model } from "mongoose";

import {
  ORDER_FULFILLMENT_STATUSES,
  ORDER_PAYMENT_STATUSES,
  ORDER_STATUSES,
  type Order,
} from "./order.types";

const orderAddressSchema = new Schema(
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

const orderItemSchema = new Schema(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    sellerId: {
      type: Schema.Types.ObjectId,
      ref: "Seller",
      immutable: true,
      index: true,
    },
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
    imageUrl: {
      type: String,
      trim: true,
      maxlength: 2048,
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
      default: true,
    },
    allowOverselling: {
      type: Boolean,
      default: false,
    },
    inventoryAllocations: {
      type: [
        new Schema(
          {
            warehouseId: {
              type: Schema.Types.ObjectId,
              ref: "Warehouse",
              required: true,
            },
            quantity: {
              type: Number,
              required: true,
              min: 1,
              validate: {
                validator: Number.isSafeInteger,
                message: "Allocation quantity must be a safe integer.",
              },
            },
          },
          { _id: false, strict: "throw" },
        ),
      ],
      default: [],
    },
    fulfilledQuantity: {
      type: Number,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "Fulfilled quantity must be an integer.",
      },
    },
    returnedQuantity: {
      type: Number,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "Returned quantity must be an integer.",
      },
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    discountAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    taxAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lineTotal: {
      type: Number,
      required: true,
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
  },
  {
    _id: true,
    strict: "throw",
  },
);

const orderTotalsSchema = new Schema(
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
      min: 1,
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
    refundedAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    _id: false,
    strict: "throw",
  },
);

const orderSchema = new Schema<Order>(
  {
    orderNumber: {
      type: String,
      required: true,
      trim: true,
      immutable: true,
      maxlength: 50,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },
    checkoutId: {
      type: Schema.Types.ObjectId,
      ref: "Checkout",
      immutable: true,
    },
    items: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: (items: unknown[]) => items.length > 0,
        message: "An order must contain at least one item.",
      },
    },
    shippingAddress: {
      type: orderAddressSchema,
      required: true,
    },
    billingAddress: {
      type: orderAddressSchema,
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
    paymentStatus: {
      type: String,
      enum: ORDER_PAYMENT_STATUSES,
      default: "PENDING",
      required: true,
    },
    fulfillmentStatus: {
      type: String,
      enum: ORDER_FULFILLMENT_STATUSES,
      default: "UNFULFILLED",
      required: true,
    },
    status: {
      type: String,
      enum: ORDER_STATUSES,
      default: "PENDING",
      required: true,
    },
    totals: {
      type: orderTotalsSchema,
      required: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    internalNote: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    cancellationReason: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    cancelledAt: Date,
    confirmedAt: Date,
    shippedAt: Date,
    deliveredAt: Date,
  },
  {
    timestamps: true,
    strict: "throw",
    collection: "orders",
    versionKey: false,
  },
);

orderSchema.index(
  { orderNumber: 1 },
  { unique: true, name: "unique_order_number" },
);

orderSchema.index(
  { checkoutId: 1 },
  {
    unique: true,
    sparse: true,
    name: "unique_order_checkout",
  },
);

orderSchema.index({ userId: 1, createdAt: -1 }, { name: "orders_by_customer" });

orderSchema.index({ status: 1, createdAt: -1 }, { name: "orders_by_status" });

orderSchema.index(
  { paymentStatus: 1, createdAt: -1 },
  { name: "orders_by_payment_status" },
);

orderSchema.pre("validate", function () {
  if (!this.totals || !this.items) return;

  const itemCount = this.items.reduce((sum, item) => sum + item.quantity, 0);

  if (this.totals.itemCount !== itemCount) {
    this.invalidate(
      "totals.itemCount",
      "Order item count does not match its line items.",
    );
  }

  const currency = this.totals.currency.toUpperCase();

  if (this.items.some((item) => item.currency.toUpperCase() !== currency)) {
    this.invalidate("items", "All order items must use the order currency.");
  }

  if (
    this.items.some(
      (item) =>
        item.fulfilledQuantity > item.quantity ||
        item.returnedQuantity > item.quantity ||
        item.returnedQuantity > item.fulfilledQuantity,
    )
  ) {
    this.invalidate(
      "items",
      "Fulfilled and returned quantities are inconsistent.",
    );
  }

  const totalAmount =
    Math.round(
      (this.totals.subtotal -
        this.totals.discountAmount +
        this.totals.shippingAmount +
        this.totals.taxAmount) *
        100,
    ) / 100;

  if (Math.abs(totalAmount - this.totals.totalAmount) > 0.01) {
    this.invalidate(
      "totals.totalAmount",
      "Order total does not match its financial components.",
    );
  }

  if (this.totals.refundedAmount > this.totals.totalAmount) {
    this.invalidate(
      "totals.refundedAmount",
      "Refunded amount cannot exceed the order total.",
    );
  }
});

export const OrderModel =
  (models.Order as Model<Order> | undefined) ??
  model<Order>("Order", orderSchema);

export default OrderModel;
