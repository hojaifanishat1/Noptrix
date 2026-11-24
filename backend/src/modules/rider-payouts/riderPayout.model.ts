import { Schema, model, models, type Model, Types } from "mongoose";

export const RIDER_PAYOUT_STATUSES = [
  "PENDING",
  "APPROVED",
  "PAID",
  "CANCELLED",
] as const;

export type RiderPayoutStatus =
  (typeof RIDER_PAYOUT_STATUSES)[number];

export interface RiderPayout {
  _id?: Types.ObjectId;
  riderId: Types.ObjectId;
  earningIds: Types.ObjectId[];
  currency: string;
  amount: number;
  status: RiderPayoutStatus;
  approvedAt?: Date;
  approvedBy?: Types.ObjectId;
  paidAt?: Date;
  paidBy?: Types.ObjectId;
  paymentReference?: string;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const riderPayoutSchema = new Schema<RiderPayout>(
  {
    riderId: {
      type: Schema.Types.ObjectId,
      ref: "Rider",
      required: true,
      immutable: true,
      index: true,
    },
    earningIds: [{
      type: Schema.Types.ObjectId,
      ref: "RiderEarning",
      required: true,
    }],
    currency: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 3,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: RIDER_PAYOUT_STATUSES,
      default: "PENDING",
      required: true,
      index: true,
    },
    approvedAt: Date,
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    paidAt: Date,
    paidBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    paymentReference: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    strict: "throw",
  },
);

riderPayoutSchema.index({ riderId: 1, createdAt: -1 });
riderPayoutSchema.index({ status: 1, createdAt: -1 });
riderPayoutSchema.index({ earningIds: 1 });

export const RiderPayoutModel =
  (models.RiderPayout as Model<RiderPayout> | undefined) ??
  model<RiderPayout>("RiderPayout", riderPayoutSchema);
