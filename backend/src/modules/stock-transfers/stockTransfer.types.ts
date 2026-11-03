import type { Types } from "mongoose";

export const STOCK_TRANSFER_STATUSES = [
  "DRAFT",
  "APPROVED",
  "DISPATCHED",
  "RECEIVED",
  "CANCELLED",
  "REJECTED",
] as const;

export type StockTransferStatus = (typeof STOCK_TRANSFER_STATUSES)[number];

export interface CreateStockTransferInput {
  productId: string;
  variantId?: string;
  sourceWarehouseId: string;
  destinationWarehouseId: string;
  quantity: number;
  reason: string;
  referenceType?: string;
  referenceId?: string;
  idempotencyKey?: string;
}

export interface StockTransferFilters {
  productId?: string;
  sourceWarehouseId?: string;
  destinationWarehouseId?: string;
  status?: StockTransferStatus;
  referenceType?: string;
  referenceId?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
  sortOrder?: "asc" | "desc";
}

export interface StockTransferAuditEntry {
  action:
    | "CREATED"
    | "APPROVED"
    | "DISPATCHED"
    | "RECEIVED"
    | "CANCELLED"
    | "REJECTED";
  performedBy: Types.ObjectId;
  note?: string;
  performedAt: Date;
}
