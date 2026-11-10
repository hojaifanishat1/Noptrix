import { Document, Model, Schema, Types, model } from "mongoose";
import {
  RIDER_TYPES,
  RIDER_VEHICLE_TYPES,
  RiderType,
  RiderVehicleType,
} from "../riders/rider.types";

export const RIDER_INVITATION_STATUSES = [
  "PENDING",
  "ACCEPTED",
  "EXPIRED",
  "REVOKED",
] as const;

export type RiderInvitationStatus =
  (typeof RIDER_INVITATION_STATUSES)[number];

export interface IRiderInvitation extends Document {
  name: string;
  email: string;
  phone?: string;
  type: RiderType;
  vehicleType?: RiderVehicleType;
  vehicleNumber?: string;
  licenseNumber?: string;
  nationalId?: string;
  tokenHash: string;
  invitedBy: Types.ObjectId;
  status: RiderInvitationStatus;
  expiresAt: Date;
  acceptedAt?: Date;
  acceptedUserId?: Types.ObjectId;
  riderId?: Types.ObjectId;
  revokedAt?: Date;
  revokedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const riderInvitationSchema = new Schema<IRiderInvitation>(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 150 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254, index: true },
    phone: { type: String, trim: true, maxlength: 30 },
    type: { type: String, enum: RIDER_TYPES, required: true, default: "INTERNAL" },
    vehicleType: { type: String, enum: RIDER_VEHICLE_TYPES },
    vehicleNumber: { type: String, trim: true, uppercase: true, maxlength: 50 },
    licenseNumber: { type: String, trim: true, uppercase: true, maxlength: 100 },
    nationalId: { type: String, trim: true, maxlength: 100 },
    tokenHash: { type: String, required: true, unique: true, select: false },
    invitedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: RIDER_INVITATION_STATUSES, default: "PENDING", required: true, index: true },
    expiresAt: { type: Date, required: true, index: true },
    acceptedAt: Date,
    acceptedUserId: { type: Schema.Types.ObjectId, ref: "User" },
    riderId: { type: Schema.Types.ObjectId, ref: "Rider" },
    revokedAt: Date,
    revokedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, versionKey: false },
);

riderInvitationSchema.index({ email: 1, status: 1, createdAt: -1 });
riderInvitationSchema.index({ status: 1, expiresAt: 1 });
riderInvitationSchema.index(
  { email: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "PENDING" },
    name: "rider_invitation_one_pending_per_email",
  },
);

export const RiderInvitation: Model<IRiderInvitation> =
  model<IRiderInvitation>("RiderInvitation", riderInvitationSchema);
