import apiClient from "@/services/api/client";

import type {
  Receipt,
  ReceiptListQuery,
  ReceiptListResult,
} from "@/features/receipts/receipt.types";

const BASE_URL = "/receipts";

interface ApiEnvelope<T> {
  success?: boolean;
  message?: string;
  data?: T;
  pagination?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

function normalizeList(
  payload: ApiEnvelope<unknown>,
  query: ReceiptListQuery,
): ReceiptListResult {
  const raw = payload.data as
    | {
        items?: Receipt[];
        pagination?: ReceiptListResult["pagination"];
      }
    | Receipt[]
    | undefined;

  const items = Array.isArray(raw)
    ? raw
    : raw?.items ?? [];

  const pagination =
    !Array.isArray(raw) && raw?.pagination
      ? raw.pagination
      : payload.pagination;

  const page = pagination?.page ?? query.page ?? 1;
  const limit = pagination?.limit ?? query.limit ?? 20;
  const total = pagination?.total ?? items.length;

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages:
        pagination?.totalPages ??
        Math.max(1, Math.ceil(total / Math.max(1, limit))),
    },
  };
}

export const receiptsApi = {
  async getReceipts(
    params: ReceiptListQuery = {},
  ): Promise<ReceiptListResult> {
    const response = await apiClient.get<ApiEnvelope<unknown>>(
      BASE_URL,
      { params },
    );

    return normalizeList(response.data, params);
  },

  async getReceipt(receiptId: string): Promise<Receipt> {
    const response = await apiClient.get<ApiEnvelope<Receipt>>(
      `${BASE_URL}/${receiptId}`,
    );

    const receipt = response.data.data;

    if (!receipt?._id) {
      throw new Error("Receipt details were not returned by the API.");
    }

    return receipt;
  },

  async getReceiptByOrder(orderId: string): Promise<Receipt> {
    const response = await apiClient.get<ApiEnvelope<Receipt>>(
      `${BASE_URL}/orders/${orderId}`,
    );

    const receipt = response.data.data;

    if (!receipt?._id) {
      throw new Error("Receipt was not found for this order.");
    }

    return receipt;
  },
};
