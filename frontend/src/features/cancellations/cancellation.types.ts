import type { PaginationMeta } from "@/types/api";

export const cancellationStatuses = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "COMPLETED",
  "CANCELLED",
] as const;

export type CancellationStatus =
  (typeof cancellationStatuses)[number];

export type CancellationReason =
  | "CHANGED_MIND"
  | "ORDERED_BY_MISTAKE"
  | "WRONG_ITEM"
  | "WRONG_ADDRESS"
  | "DELIVERY_TOO_LATE"
  | "PAYMENT_ISSUE"
  | "DUPLICATE_ORDER"
  | "OTHER";

export interface CancellationUser {
  _id?: string;
  id?: string;
  name?: string;
  email?: string;
  phone?: string;
  status?: string;
}

export interface CancellationOrder {
  _id?: string;
  orderNumber?: string;
  status?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  createdAt?: string;
  totals?: {
    currency?: string;
    subtotal?: number;
    discountAmount?: number;
    shippingAmount?: number;
    taxAmount?: number;
    totalAmount?: number;
    refundedAmount?: number;
  };
}

export interface CancellationItem {
  _id?: string;
  orderItemId: string;
  productId: string;
  variantId?: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface AdminCancellation {
  _id: string;
  cancellationNumber: string;
  orderId: CancellationOrder | string;
  userId: CancellationUser | string;
  reason: CancellationReason;
  customerNote?: string;
  items: CancellationItem[];
  status: CancellationStatus;
  requestedRefundAmount: number;
  approvedRefundAmount?: number;
  currency: string;
  reviewedBy?: string;
  reviewedByRole?: "OWNER" | "ADMIN";
  reviewedAt?: string;
  reviewNote?: string;
  completedAt?: string;
  rejectedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CancellationFilters {
  page: number;
  limit: number;
  sort: "newest" | "oldest";
  status: CancellationStatus | "";
  search: string;
  from: string;
  to: string;
}

export interface CancellationListResult {
  items: AdminCancellation[];
  pagination: PaginationMeta;
}

export interface CancellationCurrencyTotal {
  _id: string;
  requestedAmount: number;
  approvedAmount: number;
  requestCount: number;
}

export interface CancellationTrendItem {
  _id: {
    year: number;
    month: number;
    day: number;
  };
  count: number;
  requestedAmount: number;
}

export interface CancellationAnalytics {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  completed: number;
  cancelled: number;
  reviewed: number;
  approvalRate: number;
  currencyTotals: CancellationCurrencyTotal[];
  recentTrend: CancellationTrendItem[];
}
