export type StockTransferStatus =
  | "DRAFT"
  | "APPROVED"
  | "DISPATCHED"
  | "RECEIVED"
  | "CANCELLED"
  | "REJECTED";

export type StockTransferAction =
  | "approve"
  | "reject"
  | "dispatch"
  | "receive"
  | "cancel";

export interface TransferReference {
  _id: string;
  name?: string;
  sku?: string;
  code?: string;
  email?: string;
  title?: string;
}

export interface StockTransferAuditEntry {
  action:
    | "CREATED"
    | "APPROVED"
    | "DISPATCHED"
    | "RECEIVED"
    | "CANCELLED"
    | "REJECTED";
  performedBy: string | TransferReference;
  note?: string;
  performedAt: string;
}

export interface StockTransfer {
  _id: string;
  transferNumber: string;
  productId: string | TransferReference;
  variantId?: string | TransferReference;
  sourceWarehouseId: string | TransferReference;
  destinationWarehouseId: string | TransferReference;
  quantity: number;
  status: StockTransferStatus;
  reason: string;
  referenceType?: string;
  referenceId?: string;
  createdBy: string | TransferReference;
  approvedBy?: string | TransferReference;
  approvedAt?: string;
  dispatchedBy?: string | TransferReference;
  dispatchedAt?: string;
  receivedBy?: string | TransferReference;
  receivedAt?: string;
  cancelledBy?: string | TransferReference;
  cancelledAt?: string;
  rejectedBy?: string | TransferReference;
  rejectedAt?: string;
  cancellationReason?: string;
  rejectionReason?: string;
  dispatchNote?: string;
  receiveNote?: string;
  auditTrail: StockTransferAuditEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface StockTransferPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface StockTransferFilters {
  page: number;
  limit: number;
  productId?: string;
  sourceWarehouseId?: string;
  destinationWarehouseId?: string;
  status?: StockTransferStatus;
  referenceType?: string;
  referenceId?: string;
  fromDate?: string;
  toDate?: string;
  sortOrder: "asc" | "desc";
}

export interface StockTransferListResult {
  items: StockTransfer[];
  pagination: StockTransferPagination;
}

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

export interface StockTransferActionInput {
  note?: string;
}
