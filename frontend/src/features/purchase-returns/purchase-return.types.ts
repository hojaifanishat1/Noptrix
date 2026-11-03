export type PurchaseReturnStatus =
  "REQUESTED" | "APPROVED" | "REJECTED" | "COMPLETED" | "CANCELLED";

export type PurchaseReturnRefundStatus =
  "NOT_APPLICABLE" | "PENDING" | "PARTIALLY_REFUNDED" | "REFUNDED";

export type PurchaseReturnItemCondition =
  "UNOPENED" | "DAMAGED" | "DEFECTIVE" | "OTHER";

export type PurchaseReturnReason =
  | "DAMAGED"
  | "DEFECTIVE"
  | "EXPIRED"
  | "WRONG_ITEM"
  | "EXCESS_QUANTITY"
  | "QUALITY_ISSUE"
  | "SUPPLIER_ERROR"
  | "OTHER";

export interface PurchaseReturnItem {
  _id?: string;
  productId: string;
  variantId?: string | null;
  sku?: string;
  productName: string;
  quantity: number;
  unitCost: number;
  discountAmount: number;
  taxAmount: number;
  lineTotal: number;
  reason: PurchaseReturnReason;
  condition: PurchaseReturnItemCondition;
  restock: boolean;
  note?: string;
}

export interface PurchaseReturnRefund {
  _id?: string;
  amount: number;
  method:
    "CASH" | "BANK_TRANSFER" | "CARD" | "CHEQUE" | "CREDIT_NOTE" | "OTHER";
  referenceNumber?: string;
  refundedAt?: string;
  note?: string;
  processedBy?: {
    _id: string;
    name: string;
    email?: string;
  };
}

export interface PurchaseReturnAuditEntry {
  action: string;
  performedBy?: {
    _id: string;
    name: string;
  };
  note?: string;
  createdAt: string;
}

export interface PurchaseReturn {
  _id: string;
  returnNumber: string;
  purchaseId:
    | string
    | {
        _id: string;
        purchaseNumber: string;
        status?: string;
      };
  supplierId:
    | string
    | {
        _id: string;
        name: string;
        code?: string;
      };
  warehouseId:
    | string
    | {
        _id: string;
        name: string;
        code?: string;
      };
  items: PurchaseReturnItem[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  currency: "BDT";
  status: PurchaseReturnStatus;
  refundStatus: PurchaseReturnRefundStatus;
  refunds: PurchaseReturnRefund[];
  refundedAmount: number;
  reason: PurchaseReturnReason;
  reasonDetails?: string;
  supplierReference?: string;
  referenceNumber?: string;
  notes?: string;
  rejectionReason?: string;
  completedAt?: string;
  requestedAt?: string;
  createdAt: string;
  updatedAt: string;
  auditTrail?: PurchaseReturnAuditEntry[];
}

export interface PurchaseReturnFilters {
  search?: string;
  purchaseId?: string;
  supplierId?: string;
  warehouseId?: string;
  status?: PurchaseReturnStatus;
  refundStatus?: PurchaseReturnRefundStatus;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  sortBy?: "returnNumber" | "createdAt" | "grandTotal" | "status";
  sortOrder?: "asc" | "desc";
}

export interface CreatePurchaseReturnItemInput {
  productId: string;
  variantId?: string;
  quantity: number;
  reason: PurchaseReturnReason;
  condition: PurchaseReturnItemCondition;
  restock: boolean;
  note?: string;
}

export interface CreatePurchaseReturnInput {
  purchaseId: string;
  items: CreatePurchaseReturnItemInput[];
  reason: PurchaseReturnReason;
  reasonDetails?: string;
  supplierReference?: string;
  referenceNumber?: string;
  notes?: string;
}

export interface UpdatePurchaseReturnInput {
  items?: CreatePurchaseReturnItemInput[];
  reason?: string;
  note?: string;
}

export interface PurchaseReturnActionInput {
  note?: string;
}

export interface RejectPurchaseReturnInput {
  reason: string;
}

export interface CreatePurchaseReturnRefundInput {
  amount: number;
  method:
    "CASH" | "BANK_TRANSFER" | "CARD" | "CHEQUE" | "CREDIT_NOTE" | "OTHER";
  referenceNumber?: string;
  refundedAt?: string;
  note?: string;
}

export interface PurchaseReturnSummary {
  totalReturns: number;
  totalReturnValue: number;
  totalRefunded: number;
  requestedCount: number;
  approvedCount: number;
  rejectedCount: number;
  completedCount: number;
  cancelledCount: number;
  pendingRefundCount: number;
}

export interface PurchaseReturnListResult {
  items: PurchaseReturn[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage?: boolean;
    hasPrevPage?: boolean;
  };
}
