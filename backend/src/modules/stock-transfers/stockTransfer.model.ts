import mongoose, {
  Schema,
  model,
  type Model,
  type HydratedDocument,
} from "mongoose";

import {
  STOCK_TRANSFER_STATUSES,
  type StockTransferAuditEntry,
  type StockTransferStatus,
} from "./stockTransfer.types";

export interface StockTransfer {
  transferNumber: string;

  productId: mongoose.Types.ObjectId;
  variantId?: mongoose.Types.ObjectId;

  sourceWarehouseId: mongoose.Types.ObjectId;

  destinationWarehouseId: mongoose.Types.ObjectId;

  quantity: number;

  status: StockTransferStatus;

  reason: string;

  referenceType?: string;

  referenceId?: mongoose.Types.ObjectId;

  idempotencyKey?: string;

  createdBy: mongoose.Types.ObjectId;

  approvedBy?: mongoose.Types.ObjectId;

  approvedAt?: Date;

  dispatchedBy?: mongoose.Types.ObjectId;

  dispatchedAt?: Date;

  receivedBy?: mongoose.Types.ObjectId;

  receivedAt?: Date;

  cancelledBy?: mongoose.Types.ObjectId;

  cancelledAt?: Date;

  rejectedBy?: mongoose.Types.ObjectId;

  rejectedAt?: Date;

  cancellationReason?: string;

  rejectionReason?: string;

  dispatchNote?: string;

  receiveNote?: string;

  auditTrail: StockTransferAuditEntry[];

  createdAt: Date;

  updatedAt: Date;
}

export type StockTransferDocument = HydratedDocument<StockTransfer>;

const auditEntrySchema = new Schema<StockTransferAuditEntry>(
  {
    action: {
      type: String,
      enum: [
        "CREATED",
        "APPROVED",
        "DISPATCHED",
        "RECEIVED",
        "CANCELLED",
        "REJECTED",
      ],
      required: true,
      immutable: true,
    },

    performedBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
      immutable: true,
    },

    note: {
      type: String,
      trim: true,
      maxlength: 500,
      immutable: true,
    },

    performedAt: {
      type: Date,
      required: true,
      default: Date.now,
      immutable: true,
    },
  },
  {
    _id: false,
    versionKey: false,
    strict: "throw",
  },
);

const stockTransferSchema = new Schema<StockTransfer>(
  {
    transferNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      immutable: true,
      maxlength: 50,
    },

    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      immutable: true,
    },
    variantId: {
      type: Schema.Types.ObjectId,
      ref: "ProductVariant",
      immutable: true,
    },

    sourceWarehouseId: {
      type: Schema.Types.ObjectId,
      ref: "Warehouse",
      required: true,
      immutable: true,
    },

    destinationWarehouseId: {
      type: Schema.Types.ObjectId,
      ref: "Warehouse",
      required: true,
      immutable: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
      immutable: true,
      validate: {
        validator: Number.isSafeInteger,
        message: "Quantity must be a safe integer.",
      },
    },

    status: {
      type: String,
      enum: STOCK_TRANSFER_STATUSES,
      required: true,
      default: "DRAFT",
    },

    reason: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 500,
      immutable: true,
    },

    referenceType: {
      type: String,
      trim: true,
      maxlength: 60,
      immutable: true,
    },

    referenceId: {
      type: Schema.Types.ObjectId,
      immutable: true,
    },

    idempotencyKey: {
      type: String,
      trim: true,
      maxlength: 128,
      immutable: true,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
      immutable: true,
    },

    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
    },

    approvedAt: Date,

    dispatchedBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
    },

    dispatchedAt: Date,

    receivedBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
    },

    receivedAt: Date,

    cancelledBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
    },

    cancelledAt: Date,

    rejectedBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
    },

    rejectedAt: Date,

    cancellationReason: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    rejectionReason: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    dispatchNote: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    receiveNote: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    auditTrail: {
      type: [auditEntrySchema],
      default: [],
    },
  },
  {
    timestamps: true,
    versionKey: false,
    strict: "throw",
  },
);

stockTransferSchema.index(
  { sourceWarehouseId: 1, status: 1, createdAt: -1 },
  { name: "stock_transfer_source_status_date" },
);

stockTransferSchema.index(
  { destinationWarehouseId: 1, status: 1, createdAt: -1 },
  { name: "stock_transfer_destination_status_date" },
);

stockTransferSchema.index(
  { productId: 1, createdAt: -1 },
  { name: "stock_transfer_product_date" },
);

stockTransferSchema.index(
  { idempotencyKey: 1 },
  {
    unique: true,
    sparse: true,
    name: "uniq_stock_transfer_idempotency_key",
  },
);

export const StockTransferModel: Model<StockTransfer> =
  (mongoose.models.StockTransfer as Model<StockTransfer> | undefined) ??
  model<StockTransfer>("StockTransfer", stockTransferSchema);

export default StockTransferModel;
