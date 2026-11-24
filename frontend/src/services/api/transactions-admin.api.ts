import apiClient from "@/services/api/client";
import type { ApiResponse } from "@/types/api";
import type {
  AdminTransaction,
  AdminTransactionListResult,
  TransactionFilters,
} from "@/features/transactions/transaction.types";

type ListResponse<T> = ApiResponse<T> & {
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
};

export const transactionsAdminApi = {
  async list(filters: TransactionFilters): Promise<AdminTransactionListResult> {
    const response = await apiClient.get<ListResponse<AdminTransaction[]>>(
      "/transactions/admin",
      {
        params: {
          page: filters.page,
          limit: filters.limit,
          type: filters.type || undefined,
          status: filters.status || undefined,
          orderId: filters.orderId?.trim() || undefined,
          paymentId: filters.paymentId?.trim() || undefined,
          provider: filters.provider?.trim() || undefined,
          from: filters.from || undefined,
          to: filters.to || undefined,
        },
      },
    );

    const items = response.data.data ?? [];

    return {
      items,
      pagination: response.data.pagination ?? {
        page: filters.page,
        limit: filters.limit,
        total: items.length,
        pages: items.length ? 1 : 0,
      },
    };
  },
};
