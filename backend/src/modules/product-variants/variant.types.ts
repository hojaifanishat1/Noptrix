import type { Types } from "mongoose";

export const VARIANT_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type VariantStatus = (typeof VARIANT_STATUSES)[number];

export interface VariantInput {
  title: string;
  sku?: string;
  barcode?: string;
  options: Record<string, string>;
  price?: number;
  compareAtPrice?: number;
  costPrice?: number;
  trackInventory?: boolean;
  lowStockThreshold?: number;
  status?: VariantStatus;
  sortOrder?: number;
}

export interface VariantActor {
  userId: string;
}

export interface ProductVariantRecord {
  _id: Types.ObjectId;
  productId: Types.ObjectId;
  title: string;
  sku?: string;
  barcode?: string;
  options: Map<string, string>;
  price?: number;
  compareAtPrice?: number;
  costPrice?: number;
  trackInventory: boolean;
  stockQuantity: number;
  lowStockThreshold: number;
  status: VariantStatus;
  sortOrder: number;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
