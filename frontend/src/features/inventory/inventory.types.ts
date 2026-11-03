import type { PaginationMeta } from "@/types/api";

export type InventoryStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";

export interface InventoryReference {
  _id: string;
  name?: string;
  sku?: string;
  code?: string;
  imageUrl?: string;
  title?: string;
}

export interface Inventory {
  _id: string;
  id?: string;
  productId: string | InventoryReference;
  variantId?: string | InventoryReference;
  warehouseId: string | InventoryReference;
  quantity: number;
  reservedQuantity: number;
  availableQuantity?: number;
  lowStockThreshold: number;
  stockStatus?: InventoryStatus;
  createdAt: string;
  updatedAt: string;
}

export interface WarehouseOption {
  _id: string;
  id?: string;
  name: string;
  code: string;
  status: "ACTIVE" | "INACTIVE";
  isDefault?: boolean;
}

export interface InventoryFilters {
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

export interface InventoryListResult {
  items: Inventory[];
  pagination: PaginationMeta;
}

export interface ProductStockCapacity {
  totalStockLimit: number;
  allocatedQuantity: number;
  availableToAllocate: number;
}

export interface InventoryAdjustmentInput {
  quantityChange: number;
  reason: string;
  reference?: string;
}
