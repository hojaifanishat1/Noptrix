import apiClient from "@/services/api/client";
import type { ApiResponse } from "@/types/api";

import type {
  CreateStockMovementInput,
  StockMovement,
  StockMovementFilters,
  StockMovementListResult,
} from "@/features/stock-movements/stock-movement.types";

const emptyPagination = {
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0,
  hasNextPage: false,
  hasPreviousPage: false,
};

export const stockMovementsAdminApi = {
  async list(
    filters: StockMovementFilters,
  ): Promise<StockMovementListResult> {
    const response = await apiClient.get<
      ApiResponse<StockMovementListResult>
    >("/stock-movements", {
      params: filters,
    });

    const payload = response.data.data as unknown as
      | StockMovementListResult
      | StockMovement[];

    const items = Array.isArray(payload)
      ? payload
      : payload?.items ?? [];

    const pagination =
      (!Array.isArray(payload) ? payload?.pagination : undefined) ??
      emptyPagination;

    return {
      items,
      pagination,
    };
  },

  async get(id: string): Promise<StockMovement> {
    const response = await apiClient.get<ApiResponse<StockMovement>>(
      `/stock-movements/${id}`,
    );

    return response.data.data;
  },

  async create(
    input: CreateStockMovementInput,
  ): Promise<StockMovement> {
    const response = await apiClient.post<ApiResponse<StockMovement>>(
      "/stock-movements",
      input,
      input.idempotencyKey
        ? {
            headers: {
              "Idempotency-Key": input.idempotencyKey,
            },
          }
        : undefined,
    );

    return response.data.data;
  },
};
