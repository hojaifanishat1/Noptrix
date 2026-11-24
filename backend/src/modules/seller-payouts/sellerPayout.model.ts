import { Schema, model, models, type Model, Types } from "mongoose";

export const SELLER_PAYOUT_STATUSES = [
  "PENDING",
  "APPROVED",
  "PAID",
  "CANCELLED",
] as const;

export type SellerPayoutStatus =
  (typeof SELLER_PAYOUT_STATUSES)[number];

export interface SellerPayout {
  _id?: Types.ObjectId;
  sellerId: Types.ObjectId;
  orderId: Types.ObjectId;
  orderNumber: string;
  currency: string;
  grossAmount: number;
  commissionRate: number;
  commissionAmount: number;
  netAmount: number;
  status: SellerPayoutStatus;
  approvedAt?: Date;
  approvedBy?: Types.ObjectId;
  paidAt?: Date;
  paidBy?: Types.ObjectId;
  paymentReference?: string;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const sellerPayoutSchema = new Schema<SellerPayout>(
  {
    sellerId: {
      type: Schema.Types.ObjectId,
      ref: "Seller",
      required: true,
      immutable: true,
      index: true,
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      immutable: true,
      index: true,
    },
    orderNumber: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
    },
    currency: {
      type: String,
      required: true,
      uppercase: true,
      minlength: 3,
      maxlength: 3,
    },
    grossAmount: { type: Number, required: true, min: 0 },
    commissionRate: { type: Number, required: true, min: 0, max: 100 },
    commissionAmount: { type: Number, required: true, min: 0 },
    netAmount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: SELLER_PAYOUT_STATUSES,
      default: "PENDING",
      required: true,
      index: true,
    },
    approvedAt: Date,
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    paidAt: Date,
    paidBy: { type: Schema.Types.ObjectId, ref: "User" },
    paymentReference: { type: String, trim: true, maxlength: 200 },
    notes: { type: String, trim: true, maxlength: 2000 },
  },
  { timestamps: true, versionKey: false, strict: "throw" },
);

sellerPayoutSchema.index(
  { sellerId: 1, orderId: 1 },
  { unique: true, name: "unique_seller_order_payout" },
);

sellerPayoutSchema.index({ status: 1, createdAt: -1 });

export const SellerPayoutModel =
  (models.SellerPayout as Model<SellerPayout> | undefined) ??
  model<SellerPayout>("SellerPayout", sellerPayoutSchema);
