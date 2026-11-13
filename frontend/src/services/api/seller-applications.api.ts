import apiClient from "./client";
import type { ApiResponse } from "@/types/api";

export type SellerApplicationStatus =
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "WITHDRAWN";

export type SellerApplicationType = "INDIVIDUAL" | "BUSINESS";

export interface SellerApplicant {
  _id: string;
  name?: string;
  email?: string;
  phone?: string;
}

export interface SellerApplication {
  _id: string;
  applicantId: string | SellerApplicant;
  businessName: string;
  legalName?: string;
  type: SellerApplicationType;
  email: string;
  phone?: string;
  taxNumber?: string;
  registrationNumber?: string;
  description?: string;
  logoUrl?: string;
  website?: string;
  address?: string;
  city?: string;
  country?: string;
  status: SellerApplicationStatus;
  reviewedAt?: string;
  reviewedBy?: SellerApplicant;
  approvedAt?: string;
  rejectedAt?: string;
  withdrawnAt?: string;
  rejectionReason?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SellerApplicationPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface SellerApplicationListResult {
  applications: SellerApplication[];
  pagination: SellerApplicationPagination;
}

export interface SellerApplicationListParams {
  page: number;
  limit: number;
  search?: string;
  status?: SellerApplicationStatus;
  type?: SellerApplicationType;
}

export interface CreateSellerApplicationInput {
  businessName: string;
  legalName?: string;
  type: SellerApplicationType;
  email: string;
  phone?: string;
  taxNumber?: string;
  registrationNumber?: string;
  description?: string;
  logoUrl?: string;
  website?: string;
  address?: string;
  city?: string;
  country?: string;
}

export interface UpdateSellerApplicationStatusInput {
  status: SellerApplicationStatus;
  rejectionReason?: string;
  notes?: string;
}

export const sellerApplicationsApi = {
  // Customer: submit a new application
  async create(
    input: CreateSellerApplicationInput,
  ): Promise<SellerApplication> {
    const response = await apiClient.post<ApiResponse<SellerApplication>>(
      "/seller-applications",
      input,
    );

    return response.data.data;
  },

  // Customer: get own applications
  async listMine(
    params: { page: number; limit: number },
  ): Promise<SellerApplicationListResult> {
    const response = await apiClient.get<
      ApiResponse<SellerApplicationListResult>
    >("/seller-applications/me", { params });

    return response.data.data;
  },

  // Customer: get own application details
  async getMine(applicationId: string): Promise<SellerApplication> {
    const response = await apiClient.get<ApiResponse<SellerApplication>>(
      `/seller-applications/me/${applicationId}`,
    );

    return response.data.data;
  },

  // Customer: update own application
  async updateMine(
    applicationId: string,
    input: Partial<CreateSellerApplicationInput>,
  ): Promise<SellerApplication> {
    const response = await apiClient.patch<ApiResponse<SellerApplication>>(
      `/seller-applications/me/${applicationId}`,
      input,
    );

    return response.data.data;
  },

  // Customer: withdraw own application
  async withdrawMine(applicationId: string): Promise<SellerApplication> {
    const response = await apiClient.post<ApiResponse<SellerApplication>>(
      `/seller-applications/me/${applicationId}/withdraw`,
    );

    return response.data.data;
  },

  // Admin/Owner: list applications
  async list(
    params: SellerApplicationListParams,
  ): Promise<SellerApplicationListResult> {
    const response = await apiClient.get<
      ApiResponse<SellerApplicationListResult>
    >("/seller-applications", { params });

    return response.data.data;
  },

  async getById(applicationId: string): Promise<SellerApplication> {
    const response = await apiClient.get<ApiResponse<SellerApplication>>(
      `/seller-applications/${applicationId}`,
    );

    return response.data.data;
  },

  async updateStatus(
    applicationId: string,
    input: UpdateSellerApplicationStatusInput,
  ): Promise<SellerApplication> {
    const response = await apiClient.patch<ApiResponse<SellerApplication>>(
      `/seller-applications/${applicationId}/status`,
      input,
    );

    return response.data.data;
  },

  async resendInvitation(applicationId: string): Promise<void> {
    await apiClient.post<ApiResponse<unknown>>(
      `/seller-applications/${applicationId}/resend-invitation`,
    );
  },
};
