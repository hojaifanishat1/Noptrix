import apiClient from "@/services/api/client";
import type { ApiResponse, PaginationMeta } from "@/types/api";

import type {
  LowStockFilters,
  LowStockItem,
  LowStockListResult,
  LowStockSummary,
} from "@/features/low-stock/low-stock.types";

const emptyPagination: PaginationMeta = {
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0,
  hasNextPage: false,
  hasPreviousPage: false,
};

type PaginatedResponse<T> = ApiResponse<T> & {
  pagination?: PaginationMeta;
};

export const lowStockAdminApi = {
  async list(filters: LowStockFilters): Promise<LowStockListResult> {
    const response = await apiClient.get<PaginatedResponse<LowStockItem[]>>(
      "/low-stock",
      {
        params: {
          ...filters,
          search: filters.search?.trim() || undefined,
          warehouseId: filters.warehouseId || undefined,
          productId: filters.productId || undefined,
        },
      },
    );

    const items = response.data.data ?? [];

    return {
      items,
      pagination: response.data.pagination
        ? { ...emptyPagination, ...response.data.pagination }
        : {
            ...emptyPagination,
            page: filters.page,
            limit: filters.limit,
            total: items.length,
            totalPages: items.length ? 1 : 0,
          },
    };
  },

  async summary(
    filters: Pick<LowStockFilters, "search" | "warehouseId" | "productId">,
  ): Promise<LowStockSummary> {
    const response = await apiClient.get<ApiResponse<LowStockSummary>>(
      "/low-stock/summary",
      {
        params: {
          search: filters.search?.trim() || undefined,
          warehouseId: filters.warehouseId || undefined,
          productId: filters.productId || undefined,
        },
      },
    );

    return response.data.data;
  },
};
