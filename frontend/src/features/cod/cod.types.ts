import type { PaginationMeta } from "@/types/api";

export type CODStatus = "PENDING" | "COLLECTED" | "REMITTED" | "REVERSED";

export type CODReference =
  | string
  | {
      _id?: string;
      name?: string;
      firstName?: string;
      lastName?: string;
      email?: string;
    }
  | null;

export interface AdminCOD {
  _id: string;
  orderId: CODReference;
  riderId: CODReference;
  amount: number;
  currency: string;
  status: CODStatus;
  collectedAt?: string;
  remittedAt?: string;
  reversedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CODFilters {
  page: number;
  limit: number;
  status?: CODStatus | "";
  riderId?: string;
  orderId?: string;
}

export interface CODListResult {
  items: AdminCOD[];
  pagination: PaginationMeta;
}
