import { Document, Model, Schema, Types, model } from "mongoose";

/*
|--------------------------------------------------------------------------
| Status
|--------------------------------------------------------------------------
*/

export const JOB_APPLICATION_STATUSES = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "SHORTLISTED",
  "INTERVIEW",
  "SELECTED",
  "REJECTED",
  "WITHDRAWN",
] as const;

export type JobApplicationStatus = (typeof JOB_APPLICATION_STATUSES)[number];

/*
|--------------------------------------------------------------------------
| Interface
|--------------------------------------------------------------------------
*/

export interface IJobApplication extends Document {
  vacancyId: Types.ObjectId;
  applicantId: Types.ObjectId;

  name: string;
  email: string;
  phone?: string;

  resumeUrl?: string;
  coverLetter?: string;

  status: JobApplicationStatus;

  appliedAt: Date;

  reviewedAt?: Date;
  reviewedBy?: Types.ObjectId;

  interviewAt?: Date;

  selectedAt?: Date;
  rejectedAt?: Date;
  withdrawnAt?: Date;

  rejectionReason?: string;

  notes?: string;
  riderId?: Types.ObjectId;
  convertedToRiderAt?: Date;
  convertedToRiderBy?: Types.ObjectId;
  riderConversionRequestedAt?: Date;
  riderConversionRequestedBy?: Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

/*
|--------------------------------------------------------------------------
| Schema
|--------------------------------------------------------------------------
*/

const jobApplicationSchema = new Schema<IJobApplication>(
  {
    vacancyId: {
      type: Schema.Types.ObjectId,
      ref: "Vacancy",
      required: true,
      index: true,
    },

    applicantId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
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

    resumeUrl: {
      type: String,
      trim: true,
      maxlength: 2000,
    },

    coverLetter: {
      type: String,
      trim: true,
      maxlength: 10000,
    },

    status: {
      type: String,
      enum: JOB_APPLICATION_STATUSES,
      default: "SUBMITTED",
      required: true,
      index: true,
    },

    appliedAt: {
      type: Date,
      default: Date.now,
      required: true,
      index: true,
    },

    reviewedAt: {
      type: Date,
    },

    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    interviewAt: {
      type: Date,
    },

    selectedAt: {
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

    riderId: {
      type: Schema.Types.ObjectId,
      ref: "Rider",
    },
    convertedToRiderAt: {
      type: Date,
    },
    convertedToRiderBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    riderConversionRequestedAt: {
      type: Date,
    },
    riderConversionRequestedBy: {
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

// One applicant can apply to a vacancy only once.
jobApplicationSchema.index(
  {
    vacancyId: 1,
    applicantId: 1,
  },
  {
    unique: true,
  },
);

jobApplicationSchema.index({
  vacancyId: 1,
  status: 1,
  createdAt: -1,
});

jobApplicationSchema.index({
  applicantId: 1,
  createdAt: -1,
});

jobApplicationSchema.index({
  status: 1,
  createdAt: -1,
});

/*
|--------------------------------------------------------------------------
| Model
|--------------------------------------------------------------------------
*/

jobApplicationSchema.index({ riderId: 1 }, { sparse: true });
jobApplicationSchema.index({
  status: 1,
  riderConversionRequestedAt: 1,
  createdAt: -1,
});

export const JobApplication: Model<IJobApplication> = model<IJobApplication>(
  "JobApplication",
  jobApplicationSchema,
);
