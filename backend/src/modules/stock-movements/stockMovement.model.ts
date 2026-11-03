import mongoose, {
  Schema,
  model,
  type Model,
  type HydratedDocument,
} from "mongoose";

export const STOCK_MOVEMENT_TYPES = [
  "IN",
  "OUT",
  "ADJUSTMENT",
  "TRANSFER",
] as const;

export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];

export interface StockMovement {
  productId: mongoose.Types.ObjectId;
  variantId?: mongoose.Types.ObjectId;
  warehouseId: mongoose.Types.ObjectId;
  destinationWarehouseId?: mongoose.Types.ObjectId;

  type: StockMovementType;
  quantity: number;

  // For ordinary movements these refer to the affected warehouse.
  // For TRANSFER they refer to the source warehouse.
  quantityBefore: number;
  quantityAfter: number;

  // Populated only for TRANSFER.
  destinationQuantityBefore?: number;
  destinationQuantityAfter?: number;

  reason: string;
  reference?: string;
  referenceType?: string;
  referenceId?: mongoose.Types.ObjectId;
  idempotencyKey?: string;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
}

export type StockMovementDocument = HydratedDocument<StockMovement>;

const stockMovementSchema = new Schema<StockMovement>(
  {
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
    warehouseId: {
      type: Schema.Types.ObjectId,
      ref: "Warehouse",
      required: true,
      immutable: true,
    },
    destinationWarehouseId: {
      type: Schema.Types.ObjectId,
      ref: "Warehouse",
      immutable: true,
    },
    type: {
      type: String,
      enum: STOCK_MOVEMENT_TYPES,
      required: true,
      immutable: true,
    },
    quantity: {
      type: Number,
      required: true,
      validate: {
        validator: Number.isSafeInteger,
        message: "quantity must be a safe integer.",
      },
      immutable: true,
    },
    quantityBefore: {
      type: Number,
      required: true,
      min: 0,
      immutable: true,
    },
    quantityAfter: {
      type: Number,
      required: true,
      min: 0,
      immutable: true,
    },
    destinationQuantityBefore: {
      type: Number,
      min: 0,
      immutable: true,
    },
    destinationQuantityAfter: {
      type: Number,
      min: 0,
      immutable: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 500,
      immutable: true,
    },
    reference: {
      type: String,
      trim: true,
      maxlength: 120,
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
      immutable: true,
    },
  },
  {
    timestamps: {
      createdAt: true,
      updatedAt: false,
    },
    versionKey: false,
    strict: "throw",
  },
);

stockMovementSchema.index(
  { productId: 1, warehouseId: 1, createdAt: -1 },
  { name: "stock_movement_product_warehouse_date" },
);

stockMovementSchema.index(
  { type: 1, createdAt: -1 },
  { name: "stock_movement_type_date" },
);

stockMovementSchema.index(
  { referenceType: 1, referenceId: 1 },
  { name: "stock_movement_reference" },
);

stockMovementSchema.index(
  { idempotencyKey: 1 },
  {
    unique: true,
    sparse: true,
    name: "uniq_stock_movement_idempotency_key",
  },
);

export const StockMovementModel: Model<StockMovement> =
  (mongoose.models.StockMovement as Model<StockMovement> | undefined) ??
  model<StockMovement>("StockMovement", stockMovementSchema);

export default StockMovementModel;
