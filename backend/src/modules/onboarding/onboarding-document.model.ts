import { Document, Model, Schema, Types, model, models } from "mongoose";

export const ONBOARDING_SUBJECT_TYPES = ["SELLER", "RIDER"] as const;
export const ONBOARDING_DOCUMENT_STATUSES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
] as const;

export const SELLER_DOCUMENT_TYPES = [
  "IDENTITY_PROOF",
  "BUSINESS_REGISTRATION",
  "TAX_CERTIFICATE",
  "BANK_PROOF",
] as const;

export const RIDER_DOCUMENT_TYPES = [
  "NATIONAL_ID",
  "DRIVING_LICENSE",
  "VEHICLE_REGISTRATION",
  "VEHICLE_INSURANCE",
] as const;

export type OnboardingSubjectType =
  (typeof ONBOARDING_SUBJECT_TYPES)[number];

export type OnboardingDocumentStatus =
  (typeof ONBOARDING_DOCUMENT_STATUSES)[number];

export type SellerDocumentType = (typeof SELLER_DOCUMENT_TYPES)[number];
export type RiderDocumentType = (typeof RIDER_DOCUMENT_TYPES)[number];

export interface IOnboardingDocument extends Document {
  subjectType: OnboardingSubjectType;
  subjectId: Types.ObjectId;
  documentType: string;

  publicId: string;
  secureUrl: string;
  resourceType: string;
  format: string;
  originalFilename: string;
  mimeType: string;
  bytes: number;

  status: OnboardingDocumentStatus;
  rejectionReason?: string;

  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

const onboardingDocumentSchema = new Schema<IOnboardingDocument>(
  {
    subjectType: {
      type: String,
      enum: ONBOARDING_SUBJECT_TYPES,
      required: true,
      index: true,
    },

    subjectId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    documentType: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    publicId: {
      type: String,
      required: true,
    },

    secureUrl: {
      type: String,
      required: true,
    },

    resourceType: {
      type: String,
      required: true,
    },

    format: {
      type: String,
      required: true,
    },

    originalFilename: {
      type: String,
      required: true,
      maxlength: 255,
    },

    mimeType: {
      type: String,
      required: true,
      maxlength: 100,
    },

    bytes: {
      type: Number,
      required: true,
      min: 1,
    },

    status: {
      type: String,
      enum: ONBOARDING_DOCUMENT_STATUSES,
      default: "PENDING",
      required: true,
      index: true,
    },

    rejectionReason: {
      type: String,
      trim: true,
      maxlength: 2000,
    },

    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    reviewedAt: Date,
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

onboardingDocumentSchema.index(
  {
    subjectType: 1,
    subjectId: 1,
    documentType: 1,
  },
  {
    unique: true,
    name: "unique_onboarding_subject_document",
  },
);

onboardingDocumentSchema.index({
  subjectType: 1,
  subjectId: 1,
  status: 1,
});

export const OnboardingDocument: Model<IOnboardingDocument> =
  (models.OnboardingDocument as Model<IOnboardingDocument>) ||
  model<IOnboardingDocument>(
    "OnboardingDocument",
    onboardingDocumentSchema,
  );
