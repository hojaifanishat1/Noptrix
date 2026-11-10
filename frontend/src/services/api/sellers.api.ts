
import apiClient from "./client";
import type { ApiResponse } from "@/types/api";

export type SellerStatus =
  | "PENDING"
  | "ACTIVE"
  | "INACTIVE"
  | "SUSPENDED"
  | "REJECTED";

export type SellerType = "INDIVIDUAL" | "BUSINESS";

export interface SellerActor {
  _id: string;
  name?: string;
  email?: string;
}

export interface SellerUser {
  _id: string;
  name?: string;
  email?: string;
  phone?: string;
  status?: string;
}

export interface Seller {
  _id: string;
  userId: string | SellerUser;
  sellerCode: string;
  type: SellerType;
  businessName: string;
  legalName?: string;
  email: string;
  phone?: string;
  taxNumber?: string;
  registrationNumber?: string;
  description?: string;
  logoUrl?: string;
  website?: string;
  status: SellerStatus;
  verifiedAt?: string;
  verifiedBy?: SellerActor;
  suspendedAt?: string;
  suspendedBy?: SellerActor;
  suspensionReason?: string;
  rejectionReason?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SellerPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface SellerListResult {
  sellers: Seller[];
  pagination: SellerPagination;
}

export interface SellerListParams {
  page: number;
  limit: number;
  search?: string;
  status?: SellerStatus;
  type?: SellerType;
}

export const sellersApi = {
  async list(params: SellerListParams): Promise<SellerListResult> {
    const response = await apiClient.get<ApiResponse<SellerListResult>>(
      "/sellers",
      { params },
    );

    return response.data.data;
  },

  async getById(sellerId: string): Promise<Seller> {
    const response = await apiClient.get<ApiResponse<Seller>>(
      `/sellers/${sellerId}`,
    );

    return response.data.data;
  },

  async updateStatus(
    sellerId: string,
    status: SellerStatus,
    reason?: string,
  ): Promise<Seller> {
    const response = await apiClient.patch<ApiResponse<Seller>>(
      `/sellers/${sellerId}/status`,
      {
        status,
        ...(reason ? { reason } : {}),
      },
    );

    return response.data.data;
  },
};
