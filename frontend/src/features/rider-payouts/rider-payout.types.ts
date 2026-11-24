export type RiderPayoutStatus =
  | "PENDING"
  | "APPROVED"
  | "PAID"
  | "CANCELLED";

export interface RiderPayoutRider {
  _id: string;
  riderCode?: string;
  name?: string;
  phone?: string;
  email?: string;
}

export interface RiderPayout {
  _id: string;
  riderId: RiderPayoutRider | string;
  earningIds: string[];
  currency: string;
  amount: number;
  status: RiderPayoutStatus;
  approvedAt?: string;
  approvedBy?: string;
  paidAt?: string;
  paidBy?: string;
  paymentReference?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RiderPayoutFilters {
  page: number;
  limit: number;
  status?: RiderPayoutStatus | "";
  riderId?: string;
  currency?: string;
}

export interface RiderPayoutSummaryItem {
  _id: RiderPayoutStatus;
  count: number;
  amount: number;
}

export interface RiderPayoutListResult {
  items: RiderPayout[];
  summary: RiderPayoutSummaryItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface GenerateRiderPayoutResult {
  created: number;
  skipped: number;
}
