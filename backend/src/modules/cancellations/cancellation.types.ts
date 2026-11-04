import type { Types } from "mongoose";

export const CANCELLATION_STATUSES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "COMPLETED",
  "CANCELLED",
] as const;

export type CancellationStatus = (typeof CANCELLATION_STATUSES)[number];

export const CANCELLATION_REASONS = [
  "CHANGED_MIND",
  "ORDERED_BY_MISTAKE",
  "WRONG_ITEM",
  "WRONG_ADDRESS",
  "DELIVERY_TOO_LATE",
  "PAYMENT_ISSUE",
  "DUPLICATE_ORDER",
  "OTHER",
] as const;

export type CancellationReason = (typeof CANCELLATION_REASONS)[number];

export interface CancellationItem {
  orderItemId: Types.ObjectId;
  productId: Types.ObjectId;
  variantId?: Types.ObjectId;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface Cancellation {
  _id?: Types.ObjectId;

  cancellationNumber: string;

  orderId: Types.ObjectId;
  userId: Types.ObjectId;

  reason: CancellationReason;
  customerNote?: string;

  items: CancellationItem[];

  status: CancellationStatus;

  requestedRefundAmount: number;
  approvedRefundAmount?: number;
  currency: string;

  reviewedBy?: Types.ObjectId;
  reviewedByRole?: "OWNER" | "ADMIN";
  reviewedAt?: Date;
  reviewNote?: string;

  completedAt?: Date;
  rejectedAt?: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateCancellationInput {
  orderId: string;
  reason: CancellationReason;
  customerNote?: string;
  itemIds?: string[];
}

export interface ReviewCancellationInput {
  status: "APPROVED" | "REJECTED";
  approvedRefundAmount?: number;
  reviewNote?: string;
}

export interface CancellationListFilters {
  status?: CancellationStatus;
  orderId?: string;
  page?: number;
  limit?: number;
  sort?: "newest" | "oldest";
}
