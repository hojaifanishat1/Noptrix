import { Schema, model, models, type Model, type Types } from "mongoose";

export const RIDER_CHANGE_TYPES = ["VEHICLE", "PAYMENT"] as const;
export const RIDER_CHANGE_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;

export interface RiderChangeRequest {
  riderId: Types.ObjectId;
  type: (typeof RIDER_CHANGE_TYPES)[number];
  requestedValues: Record<string, unknown>;
  status: (typeof RIDER_CHANGE_STATUSES)[number];
  reviewedBy?: Types.ObjectId | null;
  reviewedAt?: Date | null;
  reviewNote?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const schema = new Schema<RiderChangeRequest>(
  {
    riderId: {
      type: Schema.Types.ObjectId,
      ref: "Rider",
      required: true,
      immutable: true,
      index: true,
    },
    type: {
      type: String,
      enum: RIDER_CHANGE_TYPES,
      required: true,
      immutable: true,
    },
    requestedValues: {
      type: Schema.Types.Mixed,
      required: true,
    },
    status: {
      type: String,
      enum: RIDER_CHANGE_STATUSES,
      default: "PENDING",
      required: true,
      index: true,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    reviewNote: {
      type: String,
      default: null,
      maxlength: 1000,
    },
  },
  { timestamps: true, versionKey: false, strict: "throw" },
);

schema.index({ riderId: 1, createdAt: -1 });

export const RiderChangeRequestModel =
  (models.RiderChangeRequest as Model<RiderChangeRequest> | undefined) ??
  model<RiderChangeRequest>("RiderChangeRequest", schema);
