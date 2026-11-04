export type ReturnStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "RECEIVED"
  | "INSPECTING"
  | "COMPLETED"
  | "CANCELLED";

export type ReturnReason =
  | "DAMAGED"
  | "DEFECTIVE"
  | "WRONG_ITEM"
  | "MISSING_PARTS"
  | "NOT_AS_DESCRIBED"
  | "WRONG_SIZE"
  | "CHANGED_MIND"
  | "OTHER";

export type ReturnResolution = "REFUND" | "REPLACEMENT" | "STORE_CREDIT";

export interface ReturnRelation {
  _id?: string;
  name?: string;
  email?: string;
  phone?: string;
  orderNumber?: string;
  status?: string;
  paymentStatus?: string;
}

export interface ReturnItem {
  orderItemId: string;
  productId: string;
  variantId?: string;
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
  _id: string;
  returnNumber: string;
  orderId: string | ReturnRelation;
  userId: string | ReturnRelation;
  items: ReturnItem[];
  status: ReturnStatus;
  resolution: ReturnResolution;
  requestedRefundAmount: number;
  approvedRefundAmount?: number;
  currency: string;
  customerNote?: string;
  reviewedBy?: string | ReturnRelation;
  reviewedAt?: string;
  reviewNote?: string;
  inspectionNote?: string;
  receivedAt?: string;
  inspectedAt?: string;
  completedAt?: string;
  rejectedAt?: string;
  cancelledAt?: string;
  refundId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ReturnFilters {
  status?: ReturnStatus;
  orderId?: string;
  search?: string;
  page?: number;
  limit?: number;
  sort?: "newest" | "oldest";
}

export interface ReturnPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ReturnListResult {
  items: ReturnRequest[];
  pagination: ReturnPagination;
}

export interface ReturnAnalytics {
  total: number;
  statusCounts: Record<ReturnStatus, number>;
  financials: Array<{
    _id: string;
    requests: number;
    requestedRefundAmount: number;
    approvedRefundAmount: number;
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
