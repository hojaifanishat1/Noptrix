import mongoose, {
  Schema,
  model,
  type Model,
  type HydratedDocument,
} from "mongoose";

export interface Inventory {
  productId: mongoose.Types.ObjectId;
  variantId?: mongoose.Types.ObjectId;
  warehouseId: mongoose.Types.ObjectId;
  quantity: number;
  reservedQuantity: number;
  lowStockThreshold: number;
  createdAt: Date;
  updatedAt: Date;
}

export type InventoryDocument = HydratedDocument<Inventory>;

const inventorySchema = new Schema<Inventory>(
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
    quantity: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isSafeInteger,
        message: "quantity must be a safe integer.",
      },
    },
    reservedQuantity: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isSafeInteger,
        message: "reservedQuantity must be a safe integer.",
      },
    },
    lowStockThreshold: {
      type: Number,
      required: true,
      default: 5,
      min: 0,
      validate: {
        validator: Number.isSafeInteger,
        message: "lowStockThreshold must be a safe integer.",
      },
    },
  },
  {
    timestamps: true,
    versionKey: false,
    strict: "throw",
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

inventorySchema.index(
  { productId: 1, variantId: 1, warehouseId: 1 },
  { unique: true, name: "uniq_inventory_product_variant_warehouse" },
);
inventorySchema.index(
  { warehouseId: 1, updatedAt: -1 },
  { name: "inventory_warehouse_updated" },
);
inventorySchema.index(
  { productId: 1, updatedAt: -1 },
  { name: "inventory_product_updated" },
);

inventorySchema.virtual("availableQuantity").get(function () {
  return this.quantity - this.reservedQuantity;
});

export const InventoryModel: Model<Inventory> =
  (mongoose.models.Inventory as Model<Inventory> | undefined) ??
  model<Inventory>("Inventory", inventorySchema);

export default InventoryModel;
