import apiClient from "@/services/api/client";
import type { ApiResponse, PaginationMeta } from "@/types/api";

import type {
  Purchase,
  PurchaseFilters,
  PurchaseInput,
  PurchaseListResult,
  PurchaseSummary,
  SupplierOption,
} from "@/features/purchases/purchase.types";

import type { Warehouse } from "@/features/warehouses/warehouse.types";
import type {
  Product,
  ProductStatus,
} from "@/features/products/product.types";

const emptyPagination: PaginationMeta = {
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0,
  hasNextPage: false,
  hasPreviousPage: false,
};

type ListResponse<T> = ApiResponse<T> & {
  pagination?: PaginationMeta;
};

export const purchasesAdminApi = {
  async list(filters: PurchaseFilters): Promise<PurchaseListResult> {
    const response = await apiClient.get<ListResponse<Purchase[]>>(
      "/purchases",
      {
        params: {
          ...filters,
          search: filters.search?.trim() || undefined,
          supplierId: filters.supplierId || undefined,
          warehouseId: filters.warehouseId || undefined,
          status: filters.status || undefined,
          paymentStatus: filters.paymentStatus || undefined,
          startDate: filters.startDate || undefined,
          endDate: filters.endDate || undefined,
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

  async summary(): Promise<PurchaseSummary> {
    const response = await apiClient.get<ApiResponse<PurchaseSummary>>(
      "/purchases/summary",
    );

    return response.data.data;
  },

  async get(id: string): Promise<Purchase> {
    const response = await apiClient.get<ApiResponse<Purchase>>(
      `/purchases/${id}`,
    );

    return response.data.data;
  },

  async create(input: PurchaseInput): Promise<Purchase> {
    const response = await apiClient.post<ApiResponse<Purchase>>(
      "/purchases",
      input,
    );

    return response.data.data;
  },

  async update(
    id: string,
    input: Partial<PurchaseInput>,
  ): Promise<Purchase> {
    const response = await apiClient.patch<ApiResponse<Purchase>>(
      `/purchases/${id}`,
      input,
    );

    return response.data.data;
  },

  async linkItemProduct(
    purchaseId: string,
    itemId: string,
    productId: string,
    variantId?: string,
  ): Promise<Purchase> {
    const response = await apiClient.patch<ApiResponse<Purchase>>(
      `/purchases/${purchaseId}/items/${itemId}/product`,
      { productId, ...(variantId ? { variantId } : {}) },
    );

    return response.data.data;
  },

  async approve(id: string, note?: string): Promise<Purchase> {
    const response = await apiClient.post<ApiResponse<Purchase>>(
      `/purchases/${id}/approve`,
      { note },
    );

    return response.data.data;
  },

  async order(
    id: string,
    input: {
      note?: string;
      expectedDeliveryDate?: string;
    },
  ): Promise<Purchase> {
    const response = await apiClient.post<ApiResponse<Purchase>>(
      `/purchases/${id}/order`,
      input,
    );

    return response.data.data;
  },

  async receive(
    id: string,
    input: {
      items: Array<{
        productId: string;
        variantId?: string;
        quantity: number;
      }>;
      note?: string;
    },
  ): Promise<Purchase> {
    const response = await apiClient.post<ApiResponse<Purchase>>(
      `/purchases/${id}/receive`,
      input,
    );

    return response.data.data;
  },

  async recordPayment(
    id: string,
    input: {
      amount: number;
      method: string;
      referenceNumber?: string;
      paidAt?: string;
      note?: string;
    },
  ): Promise<Purchase> {
    const response = await apiClient.post<ApiResponse<Purchase>>(
      `/purchases/${id}/payments`,
      input,
    );

    return response.data.data;
  },

  async cancel(id: string, reason: string): Promise<Purchase> {
    const response = await apiClient.post<ApiResponse<Purchase>>(
      `/purchases/${id}/cancel`,
      { reason },
    );

    return response.data.data;
  },

  async suppliers(): Promise<SupplierOption[]> {
    const response = await apiClient.get<
      ApiResponse<{ items: SupplierOption[] }>
    >("/suppliers", {
      params: {
        page: 1,
        limit: 100,
        status: "ACTIVE",
        sortBy: "name",
      },
    });

    return response.data.data?.items ?? [];
  },

  async warehouses(): Promise<Warehouse[]> {
    const response = await apiClient.get<
      ApiResponse<{ items?: Warehouse[] } | Warehouse[]>
    >("/warehouses", {
      params: {
        page: 1,
        limit: 100,
        status: "ACTIVE",
      },
    });

    const data = response.data.data;

    return Array.isArray(data) ? data : data?.items ?? [];
  },

  async products(status?: ProductStatus): Promise<Product[]> {
    const response = await apiClient.get<
      ApiResponse<{ items?: Product[] } | Product[]>
    >("/products", {
      params: {
        page: 1,
        limit: 100,
        ...(status ? { status } : {}),
      },
    });

    const data = response.data.data;

    return Array.isArray(data) ? data : data?.items ?? [];
  },
};
