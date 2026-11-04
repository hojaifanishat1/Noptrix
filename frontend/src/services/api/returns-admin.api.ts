import apiClient from "@/services/api/client";

import type {
  ReturnAnalytics,
  ReturnFilters,
  ReturnPagination,
  ReturnRequest,
  ReviewReturnInput,
  InspectReturnInput,
} from "@/features/returns/return.types";

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

interface ListResponse {
  success: boolean;
  message: string;
  data: ReturnRequest[];
  pagination: ReturnPagination;
}

export const returnsAdminApi = {
  async list(filters: ReturnFilters = {}) {
    const response = await apiClient.get<ListResponse>(
      "/returns/admin",
      { params: filters },
    );

    return {
      items: response.data.data,
      pagination: response.data.pagination,
    };
  },

  async analytics() {
    const response = await apiClient.get<ApiResponse<ReturnAnalytics>>(
      "/returns/admin/analytics",
    );

    return response.data.data;
  },

  async get(returnId: string) {
    const response = await apiClient.get<ApiResponse<ReturnRequest>>(
      `/returns/admin/${returnId}`,
    );

    return response.data.data;
  },

  async review(returnId: string, input: ReviewReturnInput) {
    const response = await apiClient.patch<ApiResponse<ReturnRequest>>(
      `/returns/admin/${returnId}/review`,
      input,
    );

    return response.data.data;
  },

  async inspect(returnId: string, input: InspectReturnInput) {
    const response = await apiClient.patch<ApiResponse<ReturnRequest>>(
      `/returns/admin/${returnId}/inspection`,
      input,
    );

    return response.data.data;
  },

  async complete(returnId: string) {
    const response = await apiClient.patch<ApiResponse<ReturnRequest>>(
      `/returns/admin/${returnId}/complete`,
    );

    return response.data.data;
  },
};
