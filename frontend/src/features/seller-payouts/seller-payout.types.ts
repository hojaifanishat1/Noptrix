export type SellerPayoutStatus =
  | "PENDING"
  | "APPROVED"
  | "PAID"
  | "CANCELLED";

export interface SellerPayoutSeller {
  _id: string;
  sellerCode?: string;
  businessName?: string;
  email?: string;
}

export interface SellerPayout {
  _id: string;
  sellerId: SellerPayoutSeller | string;
  orderId: string;
  orderNumber: string;
  currency: string;
  grossAmount: number;
  commissionRate: number;
  commissionAmount: number;
  netAmount: number;
  status: SellerPayoutStatus;
  approvedAt?: string;
  paidAt?: string;
  paymentReference?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SellerPayoutSummary {
  _id: SellerPayoutStatus;
  count: number;
  grossAmount: number;
  commissionAmount: number;
  netAmount: number;
}

export interface SellerPayoutFilters {
  page: number;
  limit: number;
  status?: SellerPayoutStatus | "";
  sellerId?: string;
  currency?: string;
}

export interface SellerPayoutListResult {
  items: SellerPayout[];
  summary: SellerPayoutSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface GenerateSellerPayoutResult {
  created: number;
  skipped: number;
}
