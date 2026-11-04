import type { Types } from "mongoose";

export const REFUND_STATUSES = [
  "PENDING",
  "PROCESSING",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
] as const;

export type RefundStatus = (typeof REFUND_STATUSES)[number];

export const REFUND_REASONS = [
  "ORDER_CANCELLED",
  "RETURN_APPROVED",
  "PAYMENT_DUPLICATE",
  "OVERCHARGE",
  "DAMAGED_ITEM",
  "DEFECTIVE_ITEM",
  "CUSTOMER_REQUEST",
  "OTHER",
] as const;

export type RefundReason = (typeof REFUND_REASONS)[number];

export interface RefundTransaction {
  provider: string;
  providerRefundId?: string;
  status: RefundStatus;
  responseCode?: string;
  responseMessage?: string;
  processedAt?: Date;
  manualReference?: string;
}

export interface Refund {
  _id?: Types.ObjectId;
  refundNumber: string;
  orderId: Types.ObjectId;
  userId: Types.ObjectId;
  paymentId?: Types.ObjectId;
  cancellationId?: Types.ObjectId;
  returnId?: Types.ObjectId;
  amount: number;
  currency: string;
  reason: RefundReason;
  customerNote?: string;
  internalNote?: string;
  status: RefundStatus;
  requestedBy?: Types.ObjectId;
  processedBy?: Types.ObjectId;
  transaction?: RefundTransaction;
  idempotencyKey: string;
  requestedAt: Date;
  processedAt?: Date;
  failedAt?: Date;
  cancelledAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateRefundInput {
  orderId: string;
  paymentId?: string;
  cancellationId?: string;
  returnId?: string;
  amount: number;
  reason: RefundReason;
  customerNote?: string;
  idempotencyKey: string;
}

export interface ProcessRefundInput {
  internalNote?: string;
}

export interface ManualRefundInput {
  internalNote?: string;
  manualReference: string;
}

export interface RefundListFilters {
  status?: RefundStatus;
  orderId?: string;
  userId?: string;
  page?: number;
  limit?: number;
  sort?: "newest" | "oldest";
}
