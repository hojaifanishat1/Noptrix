import type { PaginationMeta } from "@/types/api";

export type PurchaseStatus =
  | "DRAFT"
  | "PENDING"
  | "APPROVED"
  | "ORDERED"
  | "PARTIALLY_RECEIVED"
  | "RECEIVED"
  | "CANCELLED";

export type PurchasePaymentStatus =
  | "UNPAID"
  | "PARTIALLY_PAID"
  | "PAID"
  | "REFUNDED";

export type PurchasePaymentMethod =
  | "CASH"
  | "BANK_TRANSFER"
  | "CARD"
  | "CHEQUE"
  | "OTHER";

export interface PurchaseReference {
  _id: string;
  name?: string;
  code?: string;
  email?: string;
  phone?: string;
}

export interface PurchaseItem {
  _id?: string;
  productId?: string | { _id: string; name?: string; sku?: string };
  variantId?: string | { _id: string; title?: string; sku?: string };
  sku?: string;
  productName: string;
  quantity: number;
  receivedQuantity: number;
  unitCost: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  lineSubtotal: number;
  lineTotal: number;
}

export interface PurchasePayment {
  _id?: string;
  amount: number;
  method: PurchasePaymentMethod;
  referenceNumber?: string;
  paidAt: string;
  note?: string;
}

export interface PurchaseReceivingEntry {
  _id?: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  note?: string;
  receivedAt: string;
}

export interface Purchase {
  _id: string;
  purchaseNumber: string;
  supplierId: string | PurchaseReference;
  warehouseId: string | PurchaseReference;
  items: PurchaseItem[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  shippingCost: number;
  grandTotal: number;
  amountPaid: number;
  amountDue: number;
  payments: PurchasePayment[];
  receivingHistory: PurchaseReceivingEntry[];
  paymentStatus: PurchasePaymentStatus;
  status: PurchaseStatus;
  currency: string;
  expectedDeliveryDate?: string;
  orderedAt?: string;
  approvedAt?: string;
  receivedAt?: string;
  cancelledAt?: string;
  notes?: string;
  cancellationReason?: string;
  referenceNumber?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseItemInput {
  productId?: string;
  productName?: string;
  sku?: string;
  productMode?: "catalog" | "new";
  variantId?: string;
  quantity: number;
  unitCost: number;
  discountAmount?: number;
  taxRate?: number;
}

export interface PurchaseInput {
  supplierId: string;
  warehouseId: string;
  items: PurchaseItemInput[];
  discountAmount?: number;
  shippingCost?: number;
  currency?: string;
  expectedDeliveryDate?: string;
  notes?: string;
  referenceNumber?: string;
}

export interface PurchaseFilters {
  page: number;
  limit: number;
  search?: string;
  supplierId?: string;
  warehouseId?: string;
  status?: PurchaseStatus | "";
  paymentStatus?: PurchasePaymentStatus | "";
  startDate?: string;
  endDate?: string;
  sortBy: "purchaseNumber" | "createdAt" | "grandTotal" | "status";
  sortOrder: "asc" | "desc";
}

export interface PurchaseListResult {
  items: Purchase[];
  pagination: PaginationMeta;
}

export interface PurchaseSummary {
  total: number;
  byStatus: Array<{
    _id: PurchaseStatus;
    count: number;
    grandTotal: number;
  }>;
  paymentSummary: Array<{
    _id: PurchasePaymentStatus;
    count: number;
    amountPaid: number;
    amountDue: number;
  }>;
}

export interface SupplierOption {
  _id: string;
  name: string;
  code?: string;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
}
