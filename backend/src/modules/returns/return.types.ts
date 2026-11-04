import type { Types } from "mongoose";

export const RETURN_STATUSES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "RECEIVED",
  "INSPECTING",
  "COMPLETED",
  "CANCELLED",
] as const;

export type ReturnStatus = (typeof RETURN_STATUSES)[number];

export const RETURN_REASONS = [
  "DAMAGED",
  "DEFECTIVE",
  "WRONG_ITEM",
  "MISSING_PARTS",
  "NOT_AS_DESCRIBED",
  "WRONG_SIZE",
  "CHANGED_MIND",
  "OTHER",
] as const;

export type ReturnReason = (typeof RETURN_REASONS)[number];

export const RETURN_RESOLUTIONS = [
  "REFUND",
  "REPLACEMENT",
  "STORE_CREDIT",
] as const;

export type ReturnResolution = (typeof RETURN_RESOLUTIONS)[number];

export interface ReturnItem {
  orderItemId: Types.ObjectId;
  productId: Types.ObjectId;
  variantId?: Types.ObjectId;
  productName: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  reason: ReturnReason;
  customerNote?: string;
  evidenceUrls: string[];
  receivedQuantity: number;
  acceptedQuantity: number;
  inspectionNote?: string;
}

export interface ReturnRequest {
  _id?: Types.ObjectId;

  returnNumber: string;

  orderId: Types.ObjectId;
  userId: Types.ObjectId;

  items: ReturnItem[];

  status: ReturnStatus;
  resolution: ReturnResolution;

  requestedRefundAmount: number;
  approvedRefundAmount?: number;
  currency: string;

  customerNote?: string;

  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  reviewNote?: string;
  inspectionNote?: string;

  receivedAt?: Date;
  inspectedAt?: Date;
  completedAt?: Date;
  rejectedAt?: Date;
  cancelledAt?: Date;

  refundId?: Types.ObjectId;

  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateReturnInput {
  orderId: string;
  resolution: ReturnResolution;
  customerNote?: string;
  items: Array<{
    orderItemId: string;
    quantity: number;
    reason: ReturnReason;
    customerNote?: string;
    evidenceUrls?: string[];
  }>;
}

export interface ReviewReturnInput {
  status: "APPROVED" | "REJECTED";
  approvedRefundAmount?: number;
  reviewNote?: string;
}

export interface InspectReturnInput {
  items: Array<{
    orderItemId: string;
    receivedQuantity: number;
    acceptedQuantity: number;
    inspectionNote?: string;
  }>;
  inspectionNote?: string;
}

export interface ReturnListFilters {
  status?: ReturnStatus;
  orderId?: string;
  page?: number;
  limit?: number;
  sort?: "newest" | "oldest";
}
