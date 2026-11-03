export type StockMovementType =
  | "IN"
  | "OUT"
  | "ADJUSTMENT"
  | "TRANSFER";

export interface MovementReference {
  _id: string;
  name?: string;
  sku?: string;
  code?: string;
  email?: string;
  title?: string;
}

export interface StockMovement {
  _id: string;
  productId: string | MovementReference;
  variantId?: string | MovementReference;
  warehouseId: string | MovementReference;
  destinationWarehouseId?: string | MovementReference | null;
  type: StockMovementType;
  quantity: number;
  quantityBefore: number;
  quantityAfter: number;
  destinationQuantityBefore?: number;
  destinationQuantityAfter?: number;
  reason: string;
  reference?: string;
  referenceType?: string;
  referenceId?: string;
  createdBy?: string | MovementReference;
  createdAt: string;
  updatedAt?: string;
}

export interface StockMovementPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface StockMovementFilters {
  page: number;
  limit: number;
  productId?: string;
  variantId?: string;
  warehouseId?: string;
  destinationWarehouseId?: string;
  type?: StockMovementType;
  referenceType?: string;
  referenceId?: string;
  fromDate?: string;
  toDate?: string;
  sortOrder: "asc" | "desc";
}

export interface StockMovementListResult {
  items: StockMovement[];
  pagination: StockMovementPagination;
}

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
