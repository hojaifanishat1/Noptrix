import type { Types } from "mongoose";

export const PRODUCT_TYPES = [
  "SIMPLE",
  "VARIABLE",
  "DIGITAL",
  "SERVICE",
] as const;

export type ProductType = (typeof PRODUCT_TYPES)[number];

export const PRODUCT_STATUSES = [
  "DRAFT",
  "ACTIVE",
  "INACTIVE",
  "ARCHIVED",
] as const;

export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const PRODUCT_VISIBILITIES = ["VISIBLE", "HIDDEN"] as const;
export type ProductVisibility = (typeof PRODUCT_VISIBILITIES)[number];

export const INVENTORY_POLICIES = ["DENY", "CONTINUE"] as const;

export type InventoryPolicy = (typeof INVENTORY_POLICIES)[number];

export interface ProductSEO {
  title?: string;
  description?: string;
  keywords?: string[];
  canonicalUrl?: string;
}

export interface ProductShipping {
  required: boolean;
  weight?: number;
  weightUnit?: "g" | "kg";
  length?: number;
  width?: number;
  height?: number;
  dimensionUnit?: "cm" | "m";
}

export interface ProductInput {
  name: string;
  slug?: string;
  description?: string;
  shortDescription?: string;

  type?: ProductType;
  status?: ProductStatus;
  visibility?: ProductVisibility;
  publishAt?: Date | null;

  sku?: string;
  barcode?: string;
  sellerId?: string;

  categoryId: string;
  subcategoryId?: string;
  brandId?: string;
  collectionIds?: string[];

  price: number;
  compareAtPrice?: number;
  costPrice?: number;
  salePrice?: number | null;
  saleStartsAt?: Date | null;
  saleEndsAt?: Date | null;

  currency?: string;
  tagIds?: string[];

  trackInventory?: boolean;
  stockQuantity?: number;
  lowStockThreshold?: number;
  inventoryPolicy?: InventoryPolicy;
  inventoryWarehouseId?: string;

  requiresShipping?: boolean;
  shipping?: ProductShipping;

  tags?: string[];
  attributes?: Record<string, unknown>;

  seo?: ProductSEO;

  featured?: boolean;
  sortOrder?: number;
}

export type ProductUpdateInput = Partial<
  Omit<ProductInput, "stockQuantity" | "inventoryWarehouseId">
>;

export interface ProductListQuery {
  page?: number;
  limit?: number;
  search?: string;

  status?: ProductStatus;
  type?: ProductType;

  categoryId?: string;
  subcategoryId?: string;
  brandId?: string;

  minPrice?: number;
  maxPrice?: number;

  featured?: boolean;
  inStock?: boolean;

  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface ProductActor {
  userId: string;
  role?: string;
}

export interface ProductDocumentFields {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  sku?: string;
  status: ProductStatus;
}
