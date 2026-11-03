import type { StockMovementType } from "./stockMovement.model";

export interface CreateStockMovementInput {
  productId: string;
  variantId?: string;
  warehouseId: string;
  destinationWarehouseId?: string;
  type: StockMovementType;
  quantity: number;
  reason: string;
  reference?: string;
  referenceType?: string;
  referenceId?: string;
  idempotencyKey?: string;
}

export interface StockMovementFilters {
  productId?: string;
  variantId?: string;
  warehouseId?: string;
  destinationWarehouseId?: string;
  type?: StockMovementType;
  referenceType?: string;
  referenceId?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
  sortOrder?: "asc" | "desc";
}
