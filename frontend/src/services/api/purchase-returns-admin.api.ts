import apiClient from "@/services/api/client";
import type { ApiResponse, PaginationMeta } from "@/types/api";

import type {
  PurchaseReturn,
  PurchaseReturnFilters,
  PurchaseReturnListResult,
  PurchaseReturnSummary,
  CreatePurchaseReturnInput,
  UpdatePurchaseReturnInput,
  PurchaseReturnActionInput,
  RejectPurchaseReturnInput,
  CreatePurchaseReturnRefundInput,
} from "@/features/purchase-returns/purchase-return.types";

type ListApiResponse = ApiResponse<PurchaseReturn[]> & {
  pagination?: PaginationMeta;
};

const BASE_URL = "/purchase-returns";

function getPagination(
  pagination?: PaginationMeta,
): PurchaseReturnListResult["pagination"] {
  return {
    page: pagination?.page ?? 1,
    limit: pagination?.limit ?? 20,
    total: pagination?.total ?? 0,
    totalPages: pagination?.totalPages ?? 0,
    hasNextPage: pagination?.hasNextPage,
  };
}

export const purchaseReturnsAdminApi = {
  async summary(): Promise<PurchaseReturnSummary> {
    const response = await apiClient.get<ApiResponse<PurchaseReturnSummary>>(
      `${BASE_URL}/summary`,
    );

    return response.data.data;
  },

  async list(
    filters: PurchaseReturnFilters = {},
  ): Promise<PurchaseReturnListResult> {
    const response = await apiClient.get<ListApiResponse>(BASE_URL, {
      params: filters,
    });

    return {
      items: response.data.data ?? [],
      pagination: getPagination(response.data.pagination),
    };
  },

  async getById(id: string): Promise<PurchaseReturn> {
    const response = await apiClient.get<ApiResponse<PurchaseReturn>>(
      `${BASE_URL}/${id}`,
    );

    return response.data.data;
  },

  async getByNumber(returnNumber: string): Promise<PurchaseReturn> {
    const response = await apiClient.get<ApiResponse<PurchaseReturn>>(
      `${BASE_URL}/number/${encodeURIComponent(returnNumber)}`,
    );

    return response.data.data;
  },

  async create(payload: CreatePurchaseReturnInput): Promise<PurchaseReturn> {
    const response = await apiClient.post<ApiResponse<PurchaseReturn>>(
      BASE_URL,
      payload,
    );

    return response.data.data;
  },

  async update(
    id: string,
    payload: UpdatePurchaseReturnInput,
  ): Promise<PurchaseReturn> {
    const response = await apiClient.patch<ApiResponse<PurchaseReturn>>(
      `${BASE_URL}/${id}`,
      payload,
    );

    return response.data.data;
  },

  async approve(
    id: string,
    payload: PurchaseReturnActionInput = {},
  ): Promise<PurchaseReturn> {
    const response = await apiClient.post<ApiResponse<PurchaseReturn>>(
      `${BASE_URL}/${id}/approve`,
      payload,
    );

    return response.data.data;
  },

  async reject(
    id: string,
    payload: RejectPurchaseReturnInput,
  ): Promise<PurchaseReturn> {
    const response = await apiClient.post<ApiResponse<PurchaseReturn>>(
      `${BASE_URL}/${id}/reject`,
      payload,
    );

    return response.data.data;
  },

  async complete(
    id: string,
    payload: PurchaseReturnActionInput = {},
  ): Promise<PurchaseReturn> {
    const response = await apiClient.post<ApiResponse<PurchaseReturn>>(
      `${BASE_URL}/${id}/complete`,
      payload,
    );

    return response.data.data;
  },

  async addRefund(
    id: string,
    payload: CreatePurchaseReturnRefundInput,
  ): Promise<PurchaseReturn> {
    const response = await apiClient.post<ApiResponse<PurchaseReturn>>(
      `${BASE_URL}/${id}/refunds`,
      payload,
    );

    return response.data.data;
  },

  async cancel(
    id: string,
    payload: { reason: string },
  ): Promise<PurchaseReturn> {
    const response = await apiClient.post<ApiResponse<PurchaseReturn>>(
      `${BASE_URL}/${id}/cancel`,
      payload,
    );

    return response.data.data;
  },
};
