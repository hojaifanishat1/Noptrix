import mongoose, { Schema, model, type Model } from "mongoose";

import {
  PURCHASE_PAYMENT_STATUSES,
  PURCHASE_STATUSES,
  type Purchase,
} from "./purchase.types";

const purchaseItemSchema = new Schema(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
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
    quantity: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: "Quantity must be an integer.",
      },
    },
    receivedQuantity: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "Received quantity must be an integer.",
      },
    },
    unitCost: {
      type: Number,
      required: true,
      min: 0,
    },
    discountAmount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    taxRate: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 100,
    },
    taxAmount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    lineSubtotal: {
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
  { _id: true },
);

const purchasePaymentSchema = new Schema(
  {
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    method: {
      type: String,
      enum: ["CASH", "BANK_TRANSFER", "CARD", "CHEQUE", "OTHER"],
      required: true,
    },
    referenceNumber: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    paidAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    note: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    recordedBy: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Admin",
    },
  },
  { timestamps: true },
);

const purchaseReceivingSchema = new Schema(
  {
    items: [
      {
        productId: {
          type: Schema.Types.ObjectId,
          required: true,
          ref: "Product",
        },
        variantId: {
          type: Schema.Types.ObjectId,
          ref: "ProductVariant",
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
      },
    ],
    note: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    receivedBy: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Admin",
    },
    receivedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  { _id: true },
);

const purchaseAuditSchema = new Schema(
  {
    action: {
      type: String,
      enum: [
        "CREATED",
        "UPDATED",
        "APPROVED",
        "ORDERED",
        "RECEIVED",
        "PAYMENT_RECORDED",
        "CANCELLED",
      ],
      required: true,
    },
    performedBy: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Admin",
    },
    performedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    note: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  { _id: false },
);

const purchaseSchema = new Schema<Purchase>(
  {
    purchaseNumber: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
      uppercase: true,
      maxlength: 50,
    },
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: "Supplier",
      required: true,
      index: true,
    },
    warehouseId: {
      type: Schema.Types.ObjectId,
      ref: "Warehouse",
      required: true,
      index: true,
    },
    items: {
      type: [purchaseItemSchema],
      required: true,
      validate: {
        validator: (items: unknown[]) => items.length > 0,
        message: "A purchase must contain at least one item.",
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
      default: 0,
      min: 0,
    },
    taxAmount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    shippingCost: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    grandTotal: {
      type: Number,
      required: true,
      min: 0,
    },
    amountPaid: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    amountDue: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentStatus: {
      type: String,
      enum: PURCHASE_PAYMENT_STATUSES,
      required: true,
      default: "UNPAID",
    },
    payments: {
      type: [purchasePaymentSchema],
      default: [],
    },
    receivingHistory: {
      type: [purchaseReceivingSchema],
      default: [],
    },
    status: {
      type: String,
      enum: PURCHASE_STATUSES,
      required: true,
      default: "DRAFT",
      index: true,
    },
    currency: {
      type: String,
      required: true,
      default: "BDT",
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 3,
    },
    expectedDeliveryDate: Date,
    orderedAt: Date,
    approvedAt: Date,
    receivedAt: Date,
    cancelledAt: Date,
    notes: {
      type: String,
      trim: true,
      maxlength: 5000,
    },
    cancellationReason: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    referenceNumber: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Admin",
      immutable: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
    },
    receivedBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
    },
    cancelledBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
    },
    auditTrail: {
      type: [purchaseAuditSchema],
      default: [],
      select: false,
    },
  },
  {
    timestamps: true,
    versionKey: "__v",
    strict: true,
    minimize: false,
  },
);

purchaseSchema.index({ createdAt: -1, status: 1 });
purchaseSchema.index({ supplierId: 1, createdAt: -1 });
purchaseSchema.index({ warehouseId: 1, status: 1 });
purchaseSchema.index({ paymentStatus: 1, amountDue: -1 });
purchaseSchema.index({ "items.productId": 1 });
purchaseSchema.index({ expectedDeliveryDate: 1, status: 1 });

export type PurchaseDocument = mongoose.HydratedDocument<Purchase>;

export const PurchaseModel =
  (mongoose.models.Purchase as Model<Purchase> | undefined) ??
  model<Purchase>("Purchase", purchaseSchema);
