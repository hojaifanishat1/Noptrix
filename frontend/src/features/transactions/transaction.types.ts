export const TRANSACTION_TYPES = [
  "PAYMENT_CREATED",
  "PAYMENT_PENDING",
  "PAYMENT_PROCESSING",
  "PAYMENT_SUCCEEDED",
  "PAYMENT_FAILED",
  "PAYMENT_CANCELLED",
  "PAYMENT_EXPIRED",
  "REFUND_REQUESTED",
  "REFUND_SUCCEEDED",
  "REFUND_FAILED",
  "WEBHOOK_RECEIVED",
] as const;

export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const TRANSACTION_STATUSES = [
  "created",
  "pending",
  "processing",
  "success",
  "failed",
  "cancelled",
  "refunded",
  "partially_refunded",
  "expired",
] as const;

export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

export interface AdminTransaction {
  _id: string;
  paymentId: string;
  transactionId: string;
  orderId: string;
  type: TransactionType;
  previousStatus?: string;
  status: TransactionStatus;
  amount: number;
  currency: string;
  provider?: string;
  createdAt: string;
}

export interface TransactionFilters {
  page: number;
  limit: number;
  type?: TransactionType | "";
  status?: TransactionStatus | "";
  orderId?: string;
  paymentId?: string;
  provider?: string;
  from?: string;
  to?: string;
}

export interface TransactionPagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface AdminTransactionListResult {
  items: AdminTransaction[];
  pagination: TransactionPagination;
}
