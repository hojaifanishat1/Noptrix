import { Schema, model, Types } from "mongoose";

/*
|--------------------------------------------------------------------------
| Constants
|--------------------------------------------------------------------------
*/

export const RIDER_EARNING_STATUSES = [
  "PENDING",
  "APPROVED",
  "PAID",
  "CANCELLED",
] as const;

export type RiderEarningStatus = (typeof RIDER_EARNING_STATUSES)[number];

export const RIDER_EARNING_TYPES = [
  "DELIVERY",
  "BONUS",
  "INCENTIVE",
  "ADJUSTMENT",
  "PENALTY",
] as const;

export type RiderEarningType = (typeof RIDER_EARNING_TYPES)[number];

/*
|--------------------------------------------------------------------------
| Interface
|--------------------------------------------------------------------------
*/

export interface IRiderEarning {
  riderId: Types.ObjectId;

  orderId?: Types.ObjectId;
  sourceDeliveryId?: Types.ObjectId;

  payoutId?: Types.ObjectId;

  type: RiderEarningType;

  amount: number;

  currency: string;

  status: RiderEarningStatus;

  description?: string;

  earningDate: Date;

  approvedAt?: Date;
  approvedBy?: Types.ObjectId;

  paidAt?: Date;
  paidBy?: Types.ObjectId;

  cancelledAt?: Date;
  cancelledBy?: Types.ObjectId;
  cancellationReason?: string;

  notes?: string;

  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

/*
|--------------------------------------------------------------------------
| Schema
|--------------------------------------------------------------------------
*/

const riderEarningSchema = new Schema<IRiderEarning>(
  {
    riderId: {
      type: Schema.Types.ObjectId,
      ref: "Rider",
      required: true,
      index: true,
    },

    orderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      index: true,
    },

    sourceDeliveryId: {
      type: Schema.Types.ObjectId,
      ref: "Delivery",
      default: undefined,
    },

    payoutId: {
      type: Schema.Types.ObjectId,
      ref: "RiderPayout",
      default: undefined,
      index: true,
    },

    type: {
      type: String,
      enum: RIDER_EARNING_TYPES,
      required: true,
      index: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    currency: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      default: "BDT",
      maxlength: 3,
    },

    status: {
      type: String,
      enum: RIDER_EARNING_STATUSES,
      required: true,
      default: "PENDING",
      index: true,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    earningDate: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },

    approvedAt: {
      type: Date,
    },

    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    paidAt: {
      type: Date,
    },

    paidBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    cancelledAt: {
      type: Date,
    },

    cancelledBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    cancellationReason: {
      type: String,
      trim: true,
      maxlength: 1000,
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 2000,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  },
);

/*
|--------------------------------------------------------------------------
| Indexes
|--------------------------------------------------------------------------
*/

riderEarningSchema.index({
  riderId: 1,
  earningDate: -1,
});

riderEarningSchema.index({
  riderId: 1,
  status: 1,
});

riderEarningSchema.index({
  orderId: 1,
  type: 1,
});

riderEarningSchema.index(
  { sourceDeliveryId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      sourceDeliveryId: { $type: "objectId" },
    },
  },
);

riderEarningSchema.index({
  status: 1,
  earningDate: -1,
});

/*
|--------------------------------------------------------------------------
| Model
|--------------------------------------------------------------------------
*/

export const RiderEarning = model<IRiderEarning>(
  "RiderEarning",
  riderEarningSchema,
);
