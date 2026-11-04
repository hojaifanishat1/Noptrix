export type RefundStatus =
  "PENDING" | "PROCESSING" | "SUCCEEDED" | "FAILED" | "CANCELLED";

export type RefundReason =
  | "ORDER_CANCELLED"
  | "RETURN_APPROVED"
  | "PAYMENT_DUPLICATE"
  | "OVERCHARGE"
  | "DAMAGED_ITEM"
  | "DEFECTIVE_ITEM"
  | "CUSTOMER_REQUEST"
  | "OTHER";

export interface RefundTransaction {
  provider?: string;
  providerRefundId?: string;
  status?: RefundStatus;
  responseCode?: string;
  responseMessage?: string;
  processedAt?: string;
  manualReference?: string;
}

export interface RefundOrder {
  _id?: string;
  orderNumber?: string;
  status?: string;
  paymentStatus?: string;
  totals?: {
    currency?: string;
    totalAmount?: number;
    refundedAmount?: number;
  };
}

export interface RefundUser {
  _id?: string;
  name?: string;
  email?: string;
  phone?: string;
}

export interface RefundPayment {
  _id?: string;
  transactionId?: string;
  method?: "cod" | "online";
  provider?: string;
  status?: string;
  amount?: number;
  currency?: string;
}

export interface Refund {
  _id: string;
  refundNumber: string;
  orderId: string | RefundOrder;
  userId: string | RefundUser;
  paymentId?: string | RefundPayment;
  cancellationId?: string | Record<string, unknown>;
  returnId?: string | Record<string, unknown>;
  amount: number;
  currency: string;
  reason: RefundReason;
  customerNote?: string;
  internalNote?: string;
  status: RefundStatus;
  requestedAt?: string;
  processedAt?: string;
  failedAt?: string;
  cancelledAt?: string;
  createdAt?: string;
  updatedAt?: string;
  transaction?: RefundTransaction;
}

export interface RefundPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface RefundListResponse {
  success: boolean;
  message: string;
  data: Refund[];
  pagination: RefundPagination;
}

export interface RefundDetailsResponse {
  success: boolean;
  message: string;
  data: Refund;
}

export interface RefundStatusSummary {
  _id: RefundStatus;
  count: number;
  amount: number;
}

export interface RefundReasonSummary {
  _id: RefundReason;
  count: number;
  amount: number;
}

export interface RefundAnalytics {
  summary: {
    totalRequests: number;
    totalRequestedAmount: number;
    succeededAmount: number;
    processingAmount: number;
    failedAmount: number;
  };
  byStatus: RefundStatusSummary[];
  byReason: RefundReasonSummary[];
}

export interface RefundAnalyticsResponse {
  success: boolean;
  message: string;
  data: RefundAnalytics;
}

export interface RefundQuery {
  page?: number;
  limit?: number;
  status?: RefundStatus;
  orderId?: string;
  userId?: string;
  sort?: "newest" | "oldest";
}

export interface RefundActionInput {
  internalNote?: string;
}

export interface ManualRefundInput {
  manualReference: string;
  internalNote?: string;
}
