import { Document, Model, Schema, Types, model, models } from "mongoose";

export const SELLER_INVITATION_STATUSES = [
  "PENDING",
  "ACCEPTED",
  "EXPIRED",
  "REVOKED",
] as const;

export type SellerInvitationStatus =
  (typeof SELLER_INVITATION_STATUSES)[number];

export interface ISellerInvitation extends Document {
  applicationId: Types.ObjectId;
  email: string;
  tokenHash: string;
  status: SellerInvitationStatus;
  expiresAt: Date;
  sentAt?: Date;
  acceptedAt?: Date;
  acceptedSellerId?: Types.ObjectId;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const sellerInvitationSchema = new Schema<ISellerInvitation>(
  {
    applicationId: {
      type: Schema.Types.ObjectId,
      ref: "SellerApplication",
      required: true,
      unique: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
    },
    tokenHash: {
      type: String,
      required: true,
      select: false,
    },
    status: {
      type: String,
      enum: SELLER_INVITATION_STATUSES,
      default: "PENDING",
      required: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    sentAt: Date,
    acceptedAt: Date,
    acceptedSellerId: {
      type: Schema.Types.ObjectId,
      ref: "Seller",
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

sellerInvitationSchema.index({ status: 1, expiresAt: 1 });

export const SellerInvitation: Model<ISellerInvitation> =
  (models.SellerInvitation as Model<ISellerInvitation>) ??
  model<ISellerInvitation>("SellerInvitation", sellerInvitationSchema);
