import type { PaginationMeta } from "@/types/api";

export type PaymentStatus =
  | "created"
  | "pending"
  | "processing"
  | "success"
  | "failed"
  | "cancelled"
  | "refunded"
  | "partially_refunded"
  | "expired";

export type PaymentMethod = "cod" | "online";

export interface AdminPayment {
  _id: string;
  transactionId: string;
  referenceId: string;
  orderId: string;
  customerId?: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  provider: string;
  status: PaymentStatus;
  providerTransactionId?: string;
  failureCode?: string;
  failureMessage?: string;
  paidAt?: string;
  expiresAt?: string;
  metadata?: Record<string, string | number | boolean | null>;
  createdAt: string;
  updatedAt: string;
}

export interface AdminPaymentFilters {
  page: number;
  limit: number;
  sort: "newest" | "oldest";
  status?: PaymentStatus | "";
  method?: PaymentMethod | "";
  provider?: string;
  orderId?: string;
  customerId?: string;
  transactionId?: string;
  search?: string;
  from?: string;
  to?: string;
}

export interface AdminPaymentListResult {
  items: AdminPayment[];
  pagination: PaginationMeta;
}
