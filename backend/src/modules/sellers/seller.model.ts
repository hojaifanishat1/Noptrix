import { Document, Model, Schema, Types, model, models } from "mongoose";

import {
  SELLER_STATUSES,
  SELLER_TYPES,
  SellerStatus,
  SellerType,
} from "./seller.types";

export interface ISeller extends Document {
  sourceApplicationId?: Types.ObjectId;

  sellerCode: string;
  type: SellerType;
  businessName: string;
  legalName?: string;
  email: string;
  phone?: string;
  commissionRate?: number;

  password: string;
  failedLoginAttempts: number;
  lockUntil?: Date;
  passwordChangedAt?: Date;
  lastLoginAt?: Date;

  taxNumber?: string;
  registrationNumber?: string;
  description?: string;
  logoUrl?: string;
  website?: string;

  status: SellerStatus;
  onboardingStatus: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
  onboardingCompletedAt?: Date;

  verifiedAt?: Date;
  verifiedBy?: Types.ObjectId;

  suspendedAt?: Date;
  suspendedBy?: Types.ObjectId;
  suspensionReason?: string;
  rejectionReason?: string;

  notes?: string;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

const sellerSchema = new Schema<ISeller>(
  {
    sourceApplicationId: {
      type: Schema.Types.ObjectId,
      ref: "SellerApplication",
      unique: true,
      sparse: true,
      index: true,
    },

    sellerCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: 50,
    },

    type: {
      type: String,
      enum: SELLER_TYPES,
      required: true,
      default: "BUSINESS",
    },

    businessName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    legalName: {
      type: String,
      trim: true,
      maxlength: 200,
    },

    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
    },

    phone: {
      type: String,
      trim: true,
      maxlength: 30,
    },

    commissionRate: {
      type: Number,
      min: 0,
      max: 100,
      default: undefined,
    },

    password: {
      type: String,
      required: true,
      select: false,
      minlength: 8,
    },

    failedLoginAttempts: {
      type: Number,
      default: 0,
      min: 0,
    },

    lockUntil: Date,

    passwordChangedAt: Date,

    lastLoginAt: Date,

    taxNumber: String,
    registrationNumber: String,
    description: String,
    logoUrl: String,
    website: String,

    status: {
      type: String,
      enum: SELLER_STATUSES,
      required: true,
      default: "PENDING",
      index: true,
    },

    onboardingStatus: {
      type: String,
      enum: ["NOT_STARTED", "IN_PROGRESS", "COMPLETED"],
      default: "NOT_STARTED",
      required: true,
      index: true,
    },

    onboardingCompletedAt: Date,

    verifiedAt: Date,

    verifiedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    suspendedAt: Date,

    suspendedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    suspensionReason: String,
    rejectionReason: String,
    notes: String,

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

sellerSchema.index({ email: 1 }, { unique: true });

sellerSchema.index({ status: 1, createdAt: -1 });

sellerSchema.index({ type: 1, status: 1 });

sellerSchema.index({ businessName: 1, status: 1 });

sellerSchema.index({ phone: 1 });

export const Seller: Model<ISeller> =
  (models.Seller as Model<ISeller>) ??
  model<ISeller>("Seller", sellerSchema);