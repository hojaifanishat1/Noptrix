import apiClient from "@/services/api/client";
import type { ApiResponse } from "@/types/api";

import type {
  CreateStockTransferInput,
  StockTransfer,
  StockTransferAction,
  StockTransferActionInput,
  StockTransferFilters,
  StockTransferListResult,
} from "@/features/stock-transfers/stock-transfer.types";

const emptyPagination = {
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0,
  hasNextPage: false,
  hasPreviousPage: false,
};

export const stockTransfersAdminApi = {
  async list(filters: StockTransferFilters): Promise<StockTransferListResult> {
    const response = await apiClient.get<ApiResponse<StockTransferListResult>>(
      "/stock-transfers",
      { params: filters },
    );

    const payload = response.data.data as StockTransferListResult;

    return {
      items: Array.isArray(payload?.items) ? payload.items : [],
      pagination: payload?.pagination ?? emptyPagination,
    };
  },

  async get(id: string): Promise<StockTransfer> {
    const response = await apiClient.get<ApiResponse<StockTransfer>>(
      `/stock-transfers/${id}`,
    );

    return response.data.data;
  },

  async create(input: CreateStockTransferInput): Promise<StockTransfer> {
    const response = await apiClient.post<ApiResponse<StockTransfer>>(
      "/stock-transfers",
      input,
      {
        headers: {
          "Idempotency-Key":
            input.idempotencyKey ??
            `stock-transfer-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        },
      },
    );

    return response.data.data;
  },

  async action(
    id: string,
    action: StockTransferAction,
    input: StockTransferActionInput = {},
  ): Promise<StockTransfer> {
    const response = await apiClient.post<ApiResponse<StockTransfer>>(
      `/stock-transfers/${id}/${action}`,
      input,
    );

    return response.data.data;
  },
};
