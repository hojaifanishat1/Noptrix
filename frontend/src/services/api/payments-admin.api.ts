import apiClient from "@/services/api/client";
import type { ApiResponse, PaginationMeta } from "@/types/api";

import type {
  AdminPayment,
  AdminPaymentFilters,
  AdminPaymentListResult,
} from "@/features/payments/payment.types";

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

export const paymentsAdminApi = {
  async list(filters: AdminPaymentFilters): Promise<AdminPaymentListResult> {
    const response = await apiClient.get<ListResponse<AdminPayment[]>>(
      "/payments/admin",
      {
        params: {
          ...filters,
          status: filters.status || undefined,
          method: filters.method || undefined,
          provider: filters.provider?.trim() || undefined,
          orderId: filters.orderId?.trim() || undefined,
          customerId: filters.customerId?.trim() || undefined,
          transactionId: filters.transactionId?.trim() || undefined,
          search: filters.search?.trim() || undefined,
          from: filters.from || undefined,
          to: filters.to || undefined,
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

  async get(transactionId: string): Promise<AdminPayment> {
    const response = await apiClient.get<ApiResponse<AdminPayment>>(
      `/payments/admin/${encodeURIComponent(transactionId)}`,
    );

    return response.data.data;
  },
};
