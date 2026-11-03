import apiClient from "@/services/api/client";
import type { ApiResponse, PaginationMeta } from "@/types/api";

import type {
  Inventory,
  InventoryAdjustmentInput,
  InventoryFilters,
  InventoryListResult,
  ProductStockCapacity,
  WarehouseOption,
} from "@/features/inventory/inventory.types";

const emptyPagination: PaginationMeta = {
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0,
  hasNextPage: false,
  hasPreviousPage: false,
};

function getPayload<T>(response: { data: ApiResponse<T> }): T {
  return response.data.data;
}

function getPagination(
  response: unknown,
  fallback: PaginationMeta,
): PaginationMeta {
  if (!response || typeof response !== "object") return fallback;

  const root = response as Record<string, unknown>;
  const meta =
    (root.pagination as Record<string, unknown> | undefined) ??
    (root.meta as Record<string, unknown> | undefined);

  if (!meta) return fallback;

  return {
    page: Number(meta.page ?? fallback.page),
    limit: Number(meta.limit ?? fallback.limit),
    total: Number(meta.total ?? fallback.total),
    totalPages: Number(meta.totalPages ?? fallback.totalPages),
    hasNextPage: Boolean(meta.hasNextPage ?? fallback.hasNextPage),
    hasPreviousPage: Boolean(meta.hasPreviousPage ?? fallback.hasPreviousPage),
  };
}

export const inventoryAdminApi = {
  async list(filters: InventoryFilters): Promise<InventoryListResult> {
    const params = {
      ...filters,
      search: filters.search?.trim() || undefined,
      warehouseId: filters.warehouseId || undefined,
      productId: filters.productId || undefined,
      stockStatus: filters.stockStatus || undefined,
    };
    const response = await apiClient.get<
      ApiResponse<
        | Inventory[]
        | {
            items: Inventory[];
            pagination?: PaginationMeta;
          }
      >
    >("/inventory", { params });

    const payload = getPayload(response);
    const items = Array.isArray(payload) ? payload : (payload?.items ?? []);
    const embeddedPagination = Array.isArray(payload)
      ? undefined
      : payload?.pagination;

    return {
      items,
      pagination: embeddedPagination
        ? {
            ...emptyPagination,
            ...embeddedPagination,
          }
        : getPagination(response.data, {
            ...emptyPagination,
            page: filters.page,
            limit: filters.limit,
            total: items.length,
            totalPages: items.length ? 1 : 0,
          }),
    };
  },

  async get(id: string): Promise<Inventory> {
    const response = await apiClient.get<ApiResponse<Inventory>>(
      `/inventory/${id}`,
    );
    return getPayload(response);
  },

  async getProductStockCapacity(
    productId: string,
  ): Promise<ProductStockCapacity> {
    const response = await apiClient.get<ApiResponse<ProductStockCapacity>>(
      `/inventory/products/${productId}/stock-capacity`,
    );
    return getPayload(response);
  },

  async updateThreshold(
    id: string,
    lowStockThreshold: number,
  ): Promise<Inventory> {
    const response = await apiClient.patch<ApiResponse<Inventory>>(
      `/inventory/${id}/low-stock-threshold`,
      { lowStockThreshold },
    );
    return getPayload(response);
  },

  async adjust(
    id: string,
    input: InventoryAdjustmentInput,
  ): Promise<Inventory> {
    const response = await apiClient.post<ApiResponse<Inventory>>(
      `/inventory/${id}/adjustments`,
      input,
    );
    return getPayload(response);
  },

  async warehouses(): Promise<WarehouseOption[]> {
    const response = await apiClient.get<
      ApiResponse<
        | WarehouseOption[]
        | {
            items: WarehouseOption[];
          }
      >
    >("/warehouses", {
      params: { page: 1, limit: 100, status: "ACTIVE" },
    });

    const payload = getPayload(response);
    return Array.isArray(payload) ? payload : (payload?.items ?? []);
  },
};
