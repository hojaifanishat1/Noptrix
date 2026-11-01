import {
  Schema,
  Types,
  model,
  models,
  type HydratedDocument,
  type Model,
} from "mongoose";

import {
  INVENTORY_POLICIES,
  PRODUCT_STATUSES,
  PRODUCT_TYPES,
  PRODUCT_VISIBILITIES,
  type InventoryPolicy,
  type ProductSEO,
  type ProductShipping,
  type ProductStatus,
  type ProductType,
  type ProductVisibility,
} from "./product.types";

export interface Product {
  name: string;
  slug: string;

  description?: string;
  shortDescription?: string;

  type: ProductType;
  status: ProductStatus;
  visibility: ProductVisibility;
  publishAt?: Date;
  publishedAt?: Date;

  sku?: string;
  barcode?: string;
  sellerId?: Types.ObjectId;

  categoryId: Types.ObjectId;
  subcategoryId?: Types.ObjectId;
  brandId?: Types.ObjectId;
  collectionIds: Types.ObjectId[];

  price: number;
  compareAtPrice?: number;
  costPrice?: number;
  salePrice?: number;
  saleStartsAt?: Date;
  saleEndsAt?: Date;
  currency: string;

  trackInventory: boolean;
  stockQuantity: number;
  lowStockThreshold: number;
  inventoryPolicy: InventoryPolicy;

  requiresShipping: boolean;
  shipping: ProductShipping;

  tags: string[];
  attributes: Map<string, unknown>;

  seo: ProductSEO;

  featured: boolean;
  sortOrder: number;

  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  archivedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export type ProductDocument = HydratedDocument<Product>;

const productShippingSchema = new Schema<ProductShipping>(
  {
    required: { type: Boolean, default: true },
    weight: { type: Number, min: 0 },
    weightUnit: {
      type: String,
      enum: ["g", "kg"],
      default: "kg",
    },
    length: { type: Number, min: 0 },
    width: { type: Number, min: 0 },
    height: { type: Number, min: 0 },
    dimensionUnit: {
      type: String,
      enum: ["cm", "m"],
      default: "cm",
    },
  },
  { _id: false },
);

const productSEOSchema = new Schema<ProductSEO>(
  {
    title: { type: String, trim: true, maxlength: 70 },
    description: { type: String, trim: true, maxlength: 320 },
    keywords: [{ type: String, trim: true, maxlength: 80 }],
    canonicalUrl: { type: String, trim: true, maxlength: 2048 },
  },
  { _id: false },
);

const productSchema = new Schema<Product>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 180,
    },

    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 200,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 30000,
    },

    shortDescription: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    type: {
      type: String,
      enum: PRODUCT_TYPES,
      default: "SIMPLE",
      required: true,
    },

    status: {
      type: String,
      enum: PRODUCT_STATUSES,
      default: "DRAFT",
      required: true,
    },

    visibility: {
      type: String,
      enum: PRODUCT_VISIBILITIES,
      default: "VISIBLE",
      required: true,
      index: true,
    },

    publishAt: {
      type: Date,
      index: true,
    },

    publishedAt: {
      type: Date,
    },

    sku: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 100,
    },

    barcode: {
      type: String,
      trim: true,
      maxlength: 100,
    },

    sellerId: {
      type: Schema.Types.ObjectId,
      ref: "Seller",
      index: true,
    },

    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
    },

    subcategoryId: {
      type: Schema.Types.ObjectId,
      ref: "Subcategory",
      index: true,
    },

    brandId: {
      type: Schema.Types.ObjectId,
      ref: "Brand",
      index: true,
    },

    collectionIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "Collection",
      },
    ],

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    compareAtPrice: {
      type: Number,
      min: 0,
    },

    salePrice: {
      type: Number,
      min: 0,
    },

    saleStartsAt: {
      type: Date,
    },

    saleEndsAt: {
      type: Date,
    },

    costPrice: {
      type: Number,
      min: 0,
      select: false,
    },

    currency: {
      type: String,
      trim: true,
      uppercase: true,
      minlength: 3,
      maxlength: 3,
      default: "BDT",
    },

    trackInventory: {
      type: Boolean,
      default: true,
    },

    stockQuantity: {
      type: Number,
      min: 0,
      default: 0,
    },

    lowStockThreshold: {
      type: Number,
      min: 0,
      default: 5,
    },

    inventoryPolicy: {
      type: String,
      enum: INVENTORY_POLICIES,
      default: "DENY",
    },

    requiresShipping: {
      type: Boolean,
      default: true,
    },

    shipping: {
      type: productShippingSchema,
      default: () => ({ required: true }),
    },

    tags: {
      type: [{ type: String, trim: true, maxlength: 50 }],
      default: [],
    },

    attributes: {
      type: Map,
      of: Schema.Types.Mixed,
      default: {},
    },

    seo: {
      type: productSEOSchema,
      default: () => ({}),
    },

    featured: {
      type: Boolean,
      default: false,
      index: true,
    },

    sortOrder: {
      type: Number,
      default: 0,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
    },

    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
    },

    archivedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    strict: "throw",
    toJSON: {
      transform(_doc, ret) {
        delete ret.costPrice;
        return ret;
      },
    },
  },
);

productSchema.index({ slug: 1 }, { unique: true, name: "product_slug_unique" });

productSchema.index(
  { sku: 1 },
  {
    unique: true,
    sparse: true,
    name: "product_sku_unique",
  },
);

productSchema.index(
  { barcode: 1 },
  {
    unique: true,
    sparse: true,
    name: "product_barcode_unique",
  },
);

productSchema.index({
  status: 1,
  categoryId: 1,
  createdAt: -1,
});

productSchema.index({
  status: 1,
  brandId: 1,
  price: 1,
});

productSchema.index({
  status: 1,
  featured: 1,
  sortOrder: 1,
});

productSchema.index({ status: 1, publishAt: 1 });

productSchema.index({
  name: "text",
  shortDescription: "text",
  description: "text",
});

export const ProductModel: Model<Product> =
  (models.Product as Model<Product>) ||
  model<Product>("Product", productSchema);

export default ProductModel;
