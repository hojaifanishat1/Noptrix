import apiClient from "@/services/api/client";
import type { ApiResponse, PaginationMeta } from "@/types/api";

import type {
  AdminOrder,
  AdminOrderFilters,
  AdminOrderListResult,
  UpdateAdminOrderStatusInput,
} from "@/features/orders/order.types";

type ListResponse<T> = ApiResponse<T> & {
  pagination?: PaginationMeta;
};

const emptyPagination: PaginationMeta = {
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0,
  hasNextPage: false,
  hasPreviousPage: false,
};

export const ordersAdminApi = {
  async list(filters: AdminOrderFilters): Promise<AdminOrderListResult> {
    const response = await apiClient.get<ListResponse<AdminOrder[]>>(
      "/orders/admin",
      {
        params: {
          ...filters,
          status: filters.status || undefined,
          paymentStatus: filters.paymentStatus || undefined,
          search: filters.search?.trim() || undefined,
        },
      },
    );

    const items = response.data.data ?? [];

    return {
      items,
      pagination: response.data.pagination ?? {
        ...emptyPagination,
        page: filters.page,
        limit: filters.limit,
        total: items.length,
        totalPages: items.length ? 1 : 0,
      },
    };
  },

  async get(orderId: string): Promise<AdminOrder> {
    const response = await apiClient.get<ApiResponse<AdminOrder>>(
      `/orders/admin/${encodeURIComponent(orderId)}`,
    );

    return response.data.data;
  },

  async updateStatus(
    orderId: string,
    input: UpdateAdminOrderStatusInput,
  ): Promise<AdminOrder> {
    const response = await apiClient.patch<ApiResponse<AdminOrder>>(
      `/orders/admin/${encodeURIComponent(orderId)}/status`,
      input,
    );

    return response.data.data;
  },
};
