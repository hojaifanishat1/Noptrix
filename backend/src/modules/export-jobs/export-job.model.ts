import { Schema, model, models, type Model, type Document } from "mongoose";

export const EXPORT_JOB_STATUSES = [
  "PENDING",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
] as const;

export type ExportJobStatus = (typeof EXPORT_JOB_STATUSES)[number];

export interface IExportJob {
  jobId: string;
  dataset: string;
  format: "csv" | "xlsx" | "json";
  status: ExportJobStatus;
  progress: number;
  requestedBy: string;
  filters: {
    from?: Date;
    to?: Date;
  };
  rowCount: number;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  checksum?: string;
  cloudinaryPublicId?: string;
  cloudinaryFormat?: string;
  errorMessage?: string;
  attemptsMade: number;
  startedAt?: Date;
  completedAt?: Date;
  expiresAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IExportJobDocument extends IExportJob, Document {}

const exportJobSchema = new Schema<IExportJobDocument>(
  {
    jobId: { type: String, required: true, unique: true, index: true },
    dataset: { type: String, required: true, index: true },
    format: {
      type: String,
      enum: ["csv", "xlsx", "json"],
      required: true,
    },
    status: {
      type: String,
      enum: EXPORT_JOB_STATUSES,
      default: "PENDING",
      index: true,
    },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    requestedBy: { type: String, required: true, index: true },
    filters: {
      from: Date,
      to: Date,
    },
    rowCount: { type: Number, default: 0 },
    fileName: String,
    mimeType: String,
    fileSize: Number,
    checksum: String,
    cloudinaryPublicId: String,
    cloudinaryFormat: String,
    errorMessage: String,
    attemptsMade: { type: Number, default: 0 },
    startedAt: Date,
    completedAt: Date,
    expiresAt: { type: Date, index: true },
  },
  {
    timestamps: true,
    strict: true,
    versionKey: false,
  },
);

export const ExportJob: Model<IExportJobDocument> =
  (models.ExportJob as Model<IExportJobDocument>) ||
  model<IExportJobDocument>("ExportJob", exportJobSchema);
