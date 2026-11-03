import type { Inventory, WarehouseOption } from "@/features/inventory/inventory.types";
import type { PaginationMeta } from "@/types/api";

export type LowStockStatus = "ALL" | "LOW_STOCK" | "OUT_OF_STOCK";

export interface LowStockFilters {
  page: number;
  limit: number;
  search?: string;
  warehouseId?: string;
  productId?: string;
  status: LowStockStatus;
  sortBy: "quantity" | "createdAt" | "updatedAt";
  sortOrder: "asc" | "desc";
}

export interface LowStockItem extends Inventory {
  availableQuantity: number;
  stockStatus: "LOW_STOCK" | "OUT_OF_STOCK";
}

export interface LowStockSummary {
  lowStock: number;
  outOfStock: number;
  totalAlerts: number;
}

export interface LowStockListResult {
  items: LowStockItem[];
  pagination: PaginationMeta;
}

export type { WarehouseOption };
