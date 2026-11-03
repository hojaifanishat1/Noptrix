import type { Types } from "mongoose";

export const PURCHASE_STATUSES = [
  "DRAFT",
  "PENDING",
  "APPROVED",
  "ORDERED",
  "PARTIALLY_RECEIVED",
  "RECEIVED",
  "CANCELLED",
] as const;

export type PurchaseStatus = (typeof PURCHASE_STATUSES)[number];

export const PURCHASE_PAYMENT_STATUSES = [
  "UNPAID",
  "PARTIALLY_PAID",
  "PAID",
  "REFUNDED",
] as const;

export type PurchasePaymentStatus = (typeof PURCHASE_PAYMENT_STATUSES)[number];

export interface PurchaseItem {
  _id?: Types.ObjectId;
  productId?: Types.ObjectId;
  variantId?: Types.ObjectId;
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
  _id?: Types.ObjectId;
  amount: number;
  method: "CASH" | "BANK_TRANSFER" | "CARD" | "CHEQUE" | "OTHER";
  referenceNumber?: string;
  paidAt: Date;
  note?: string;
  recordedBy: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PurchaseReceivingEntry {
  _id?: Types.ObjectId;
  items: Array<{
    productId: Types.ObjectId;
    variantId?: Types.ObjectId;
    quantity: number;
  }>;
  note?: string;
  receivedBy: Types.ObjectId;
  receivedAt: Date;
}

export interface Purchase {
  purchaseNumber: string;
  supplierId: Types.ObjectId;
  warehouseId: Types.ObjectId;
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
  auditTrail: PurchaseAuditEntry[];
  paymentStatus: PurchasePaymentStatus;

  status: PurchaseStatus;
  currency: string;
  expectedDeliveryDate?: Date;
  orderedAt?: Date;
  approvedAt?: Date;
  receivedAt?: Date;
  cancelledAt?: Date;

  notes?: string;
  cancellationReason?: string;
  referenceNumber?: string;

  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  approvedBy?: Types.ObjectId;
  receivedBy?: Types.ObjectId;
  cancelledBy?: Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePurchaseItemInput {
  productId?: string;
  productName?: string;
  sku?: string;
  variantId?: string;
  quantity: number;
  unitCost: number;
  discountAmount?: number;
  taxRate?: number;
}

export interface CreatePurchaseInput {
  supplierId: string;
  warehouseId: string;
  items: CreatePurchaseItemInput[];
  discountAmount?: number;
  shippingCost?: number;
  currency?: string;
  expectedDeliveryDate?: string;
  notes?: string;
  referenceNumber?: string;
}

export interface UpdatePurchaseInput {
  supplierId?: string;
  warehouseId?: string;
  items?: CreatePurchaseItemInput[];
  discountAmount?: number;
  shippingCost?: number;
  currency?: string;
  expectedDeliveryDate?: string;
  notes?: string;
  referenceNumber?: string;
}

export interface PurchaseFilters {
  search?: string;
  supplierId?: string;
  warehouseId?: string;
  status?: PurchaseStatus;
  paymentStatus?: PurchasePaymentStatus;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
  sortBy?: "purchaseNumber" | "createdAt" | "grandTotal" | "status";
  sortOrder?: "asc" | "desc";
}

export interface ReceivePurchaseItemInput {
  productId: string;
  variantId?: string;
  quantity: number;
}

export interface ReceivePurchaseInput {
  items: ReceivePurchaseItemInput[];
  note?: string;
}

export interface PurchaseAuditEntry {
  action:
    | "CREATED"
    | "UPDATED"
    | "APPROVED"
    | "ORDERED"
    | "RECEIVED"
    | "PAYMENT_RECORDED"
    | "CANCELLED";
  performedBy: Types.ObjectId;
  performedAt: Date;
  note?: string;
  metadata?: Record<string, unknown>;
}
