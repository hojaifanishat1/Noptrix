import { Document, Model, Schema, Types, model } from "mongoose";

export const SELLER_OPPORTUNITY_STATUSES = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  PAUSED: "PAUSED",
  CLOSED: "CLOSED",
} as const;

export type SellerOpportunityStatus =
  (typeof SELLER_OPPORTUNITY_STATUSES)[keyof typeof SELLER_OPPORTUNITY_STATUSES];

export const SELLER_OPPORTUNITY_VISIBILITIES = {
  PUBLIC: "PUBLIC",
  PRIVATE: "PRIVATE",
} as const;

export type SellerOpportunityVisibility =
  (typeof SELLER_OPPORTUNITY_VISIBILITIES)[keyof typeof SELLER_OPPORTUNITY_VISIBILITIES];

export const SELLER_OPPORTUNITY_FIELD_TYPES = [
  "TEXT",
  "TEXTAREA",
  "NUMBER",
  "EMAIL",
  "PHONE",
  "URL",
  "DATE",
  "SELECT",
  "MULTI_SELECT",
  "CHECKBOX",
] as const;

export interface ISellerOpportunityField {
  key: string;
  label: string;
  type: (typeof SELLER_OPPORTUNITY_FIELD_TYPES)[number];
  required: boolean;
  placeholder?: string;
  options?: string[];
  maxLength?: number;
}

export interface ISellerOpportunityDocumentRequirement {
  key: string;
  label: string;
  required: boolean;
  acceptedMimeTypes: string[];
  maxSizeMB: number;
}

export interface ISellerOpportunity extends Document {
  title: string;
  slug: string;
  summary: string;
  description: string;
  category: string;
  targetSellerCount: number;
  eligibility: string[];
  requiredDocuments: ISellerOpportunityDocumentRequirement[];
  applicationForm: ISellerOpportunityField[];
  applicationDeadline?: Date;
  visibility: SellerOpportunityVisibility;
  status: SellerOpportunityStatus;
  publishedAt?: Date;
  closedAt?: Date;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const fieldSchema = new Schema<ISellerOpportunityField>(
  {
    key: { type: String, required: true, trim: true, lowercase: true },
    label: { type: String, required: true, trim: true, maxlength: 150 },
    type: {
      type: String,
      enum: SELLER_OPPORTUNITY_FIELD_TYPES,
      required: true,
    },
    required: { type: Boolean, default: false },
    placeholder: { type: String, trim: true, maxlength: 200 },
    options: [{ type: String, trim: true, maxlength: 150 }],
    maxLength: { type: Number, min: 1, max: 10000 },
  },
  { _id: false },
);

const documentRequirementSchema =
  new Schema<ISellerOpportunityDocumentRequirement>(
    {
      key: { type: String, required: true, trim: true, lowercase: true },
      label: { type: String, required: true, trim: true, maxlength: 150 },
      required: { type: Boolean, default: true },
      acceptedMimeTypes: [{ type: String, trim: true, maxlength: 150 }],
      maxSizeMB: { type: Number, min: 1, max: 100, default: 10 },
    },
    { _id: false },
  );

const sellerOpportunitySchema = new Schema<ISellerOpportunity>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 200,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 220,
      unique: true,
      index: true,
    },
    summary: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 500,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      minlength: 20,
      maxlength: 15000,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
      index: true,
    },
    targetSellerCount: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    eligibility: {
      type: [{ type: String, trim: true, maxlength: 1000 }],
      default: [],
    },
    requiredDocuments: {
      type: [documentRequirementSchema],
      default: [],
    },
    applicationForm: {
      type: [fieldSchema],
      default: [],
    },
    applicationDeadline: {
      type: Date,
      index: true,
    },
    visibility: {
      type: String,
      enum: Object.values(SELLER_OPPORTUNITY_VISIBILITIES),
      default: SELLER_OPPORTUNITY_VISIBILITIES.PUBLIC,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(SELLER_OPPORTUNITY_STATUSES),
      default: SELLER_OPPORTUNITY_STATUSES.DRAFT,
      required: true,
      index: true,
    },
    publishedAt: Date,
    closedAt: Date,
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

sellerOpportunitySchema.index({
  status: 1,
  visibility: 1,
  applicationDeadline: 1,
  publishedAt: -1,
});

sellerOpportunitySchema.index({
  category: 1,
  status: 1,
});

sellerOpportunitySchema.index({
  createdBy: 1,
  createdAt: -1,
});

sellerOpportunitySchema.pre("validate", function () {
  const fieldKeys = this.applicationForm.map((field) => field.key);
  if (new Set(fieldKeys).size !== fieldKeys.length) {
    this.invalidate("applicationForm", "Application form keys must be unique.");
  }

  const documentKeys = this.requiredDocuments.map((item) => item.key);
  if (new Set(documentKeys).size !== documentKeys.length) {
    this.invalidate(
      "requiredDocuments",
      "Document requirement keys must be unique.",
    );
  }

  for (const field of this.applicationForm) {
    if (
      ["SELECT", "MULTI_SELECT"].includes(field.type) &&
      (!field.options || field.options.length === 0)
    ) {
      this.invalidate(
        "applicationForm",
        `Options are required for ${field.type} field "${field.key}".`,
      );
    }
  }
});

export const SellerOpportunity: Model<ISellerOpportunity> =
  model<ISellerOpportunity>("SellerOpportunity", sellerOpportunitySchema);
