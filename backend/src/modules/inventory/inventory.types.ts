import type { Types } from "mongoose";

export type InventoryStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";

export interface Inventory {
  productId: Types.ObjectId;
  variantId?: Types.ObjectId;
  warehouseId: Types.ObjectId;
  quantity: number;
  reservedQuantity: number;
  lowStockThreshold: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface InventoryListFilters {
  page: number;
  limit: number;
  search?: string;
  warehouseId?: string;
  productId?: string;
  variantId?: string;
  stockStatus?: InventoryStatus;
  sortBy: "quantity" | "createdAt" | "updatedAt";
  sortOrder: "asc" | "desc";
}

export interface InventoryAdjustmentInput {
  quantityChange: number;
  reason: string;
  reference?: string;
}

export interface InventoryListItem {
  _id: string;
  productId: Types.ObjectId;
  variantId?: Types.ObjectId;
  warehouseId: Types.ObjectId;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  lowStockThreshold: number;
  stockStatus: InventoryStatus;
  createdAt: Date;
  updatedAt: Date;
}
