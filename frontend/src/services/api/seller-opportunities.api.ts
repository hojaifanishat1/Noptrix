
import apiClient from "./client";
import type { ApiResponse } from "@/types/api";

import type {
  CreateSellerOpportunityInput,
  SellerOpportunity,
  SellerOpportunityListResult,
  SellerOpportunityQuery,
  SellerOpportunityStatus,
  UpdateSellerOpportunityInput,
} from "@/features/seller-opportunities/seller-opportunity.types";

export const sellerOpportunitiesApi = {
  // Public: list published opportunities
  async listPublic(
    params: SellerOpportunityQuery = {},
  ): Promise<SellerOpportunityListResult> {
    const response = await apiClient.get<
      ApiResponse<SellerOpportunityListResult>
    >("/seller-opportunities/public", { params });

    return response.data.data;
  },

  // Public: get opportunity by slug
  async getPublicBySlug(slug: string): Promise<SellerOpportunity> {
    const response = await apiClient.get<ApiResponse<SellerOpportunity>>(
      `/seller-opportunities/public/${encodeURIComponent(slug)}`,
    );

    return response.data.data;
  },

  // Admin/Owner: list all opportunities
  async list(
    params: SellerOpportunityQuery = {},
  ): Promise<SellerOpportunityListResult> {
    const response = await apiClient.get<
      ApiResponse<SellerOpportunityListResult>
    >("/seller-opportunities", { params });

    return response.data.data;
  },

  // Admin/Owner: get opportunity details
  async getById(opportunityId: string): Promise<SellerOpportunity> {
    const response = await apiClient.get<ApiResponse<SellerOpportunity>>(
      `/seller-opportunities/${opportunityId}`,
    );

    return response.data.data;
  },

  // Admin/Owner: create
  async create(
    input: CreateSellerOpportunityInput,
  ): Promise<SellerOpportunity> {
    const response = await apiClient.post<ApiResponse<SellerOpportunity>>(
      "/seller-opportunities",
      input,
    );

    return response.data.data;
  },

  // Admin/Owner: update
  async update(
    opportunityId: string,
    input: UpdateSellerOpportunityInput,
  ): Promise<SellerOpportunity> {
    const response = await apiClient.patch<ApiResponse<SellerOpportunity>>(
      `/seller-opportunities/${opportunityId}`,
      input,
    );

    return response.data.data;
  },

  // Admin/Owner: change status
  async updateStatus(
    opportunityId: string,
    status: SellerOpportunityStatus,
  ): Promise<SellerOpportunity> {
    const response = await apiClient.patch<ApiResponse<SellerOpportunity>>(
      `/seller-opportunities/${opportunityId}/status`,
      { status },
    );

    return response.data.data;
  },

  async publish(opportunityId: string): Promise<SellerOpportunity> {
    const response = await apiClient.post<ApiResponse<SellerOpportunity>>(
      `/seller-opportunities/${opportunityId}/publish`,
    );

    return response.data.data;
  },

  async pause(opportunityId: string): Promise<SellerOpportunity> {
    const response = await apiClient.post<ApiResponse<SellerOpportunity>>(
      `/seller-opportunities/${opportunityId}/pause`,
    );

    return response.data.data;
  },

  async close(opportunityId: string): Promise<SellerOpportunity> {
    const response = await apiClient.post<ApiResponse<SellerOpportunity>>(
      `/seller-opportunities/${opportunityId}/close`,
    );

    return response.data.data;
  },

  async delete(opportunityId: string): Promise<void> {
    await apiClient.delete<ApiResponse<unknown>>(
      `/seller-opportunities/${opportunityId}`,
    );
  },
};
