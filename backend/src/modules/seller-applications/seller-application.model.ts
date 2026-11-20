import { Document, Model, Schema, Types, model } from "mongoose";

import {
  SELLER_APPLICATION_STATUSES,
  SellerApplicationStatus,
  SellerType,
  SELLER_TYPES,
} from "./seller-application.types";

/*
|--------------------------------------------------------------------------
| Seller Application Document
|--------------------------------------------------------------------------
*/

export interface ISellerApplication extends Document {
  applicantId: Types.ObjectId;

  opportunityId?: Types.ObjectId;

  formResponses?: Record<string, unknown>;

  documents?: {
    key: string;
    fileName: string;
    fileUrl: string;
    mimeType: string;
    sizeBytes: number;
  }[];

  businessName: string;

  legalName?: string;

  type: SellerType;

  email: string;

  phone?: string;

  taxNumber?: string;

  registrationNumber?: string;

  description?: string;

  logoUrl?: string;

  website?: string;

  address?: string;

  city?: string;

  country?: string;

  status: SellerApplicationStatus;

  reviewedAt?: Date;

  reviewedBy?: Types.ObjectId;

  approvedAt?: Date;

  rejectedAt?: Date;

  withdrawnAt?: Date;

  rejectionReason?: string;

  notes?: string;

  createdAt: Date;

  updatedAt: Date;
}

/*
|--------------------------------------------------------------------------
| Schema
|--------------------------------------------------------------------------
*/

const sellerApplicationSchema = new Schema<ISellerApplication>(
  {
    applicantId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    opportunityId: {
      type: Schema.Types.ObjectId,
      ref: "SellerOpportunity",
      index: true,
    },

    formResponses: {
      type: Schema.Types.Mixed,
      default: {},
    },

    documents: {
      type: [
        new Schema(
          {
            key: { type: String, required: true, trim: true },
            fileName: { type: String, required: true, trim: true, maxlength: 255 },
            fileUrl: { type: String, required: true, trim: true, maxlength: 2000 },
            mimeType: { type: String, required: true, trim: true, maxlength: 150 },
            sizeBytes: { type: Number, required: true, min: 1 },
          },
          { _id: false },
        ),
      ],
      default: [],
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

    type: {
      type: String,
      enum: SELLER_TYPES,
      required: true,
      default: "BUSINESS",
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

    taxNumber: {
      type: String,
      trim: true,
      maxlength: 100,
    },

    registrationNumber: {
      type: String,
      trim: true,
      maxlength: 100,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 5000,
    },

    logoUrl: {
      type: String,
      trim: true,
      maxlength: 2000,
    },

    website: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    address: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    city: {
      type: String,
      trim: true,
      maxlength: 100,
    },

    country: {
      type: String,
      trim: true,
      maxlength: 100,
    },

    status: {
      type: String,
      enum: SELLER_APPLICATION_STATUSES,
      required: true,
      default: "SUBMITTED",
      index: true,
    },

    reviewedAt: {
      type: Date,
    },

    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    approvedAt: {
      type: Date,
    },

    rejectedAt: {
      type: Date,
    },

    withdrawnAt: {
      type: Date,
    },

    rejectionReason: {
      type: String,
      trim: true,
      maxlength: 2000,
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 5000,
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

sellerApplicationSchema.index({
  applicantId: 1,
  createdAt: -1,
});

sellerApplicationSchema.index(
  { applicantId: 1, opportunityId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      opportunityId: { $type: "objectId" },
    },
    name: "seller_application_applicant_opportunity_unique",
  },
);

sellerApplicationSchema.index({
  opportunityId: 1,
  status: 1,
  createdAt: -1,
});

sellerApplicationSchema.index({
  status: 1,
  createdAt: -1,
});

sellerApplicationSchema.index({
  email: 1,
  status: 1,
});

sellerApplicationSchema.index({
  businessName: 1,
  status: 1,
});

/*
|--------------------------------------------------------------------------
| Model
|--------------------------------------------------------------------------
*/

export const SellerApplication: Model<ISellerApplication> =
  model<ISellerApplication>("SellerApplication", sellerApplicationSchema);
