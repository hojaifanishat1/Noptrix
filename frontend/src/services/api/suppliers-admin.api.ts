import apiClient from "@/services/api/client";
import type {
  Supplier,
  SupplierFilters,
  SupplierInput,
  SupplierListResult,
  SupplierStatus,
  SupplierSummary,
  SupplierUpdateInput,
} from "@/features/suppliers/supplier.types";

interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data: T;
}

function unwrap<T>(response: { data: ApiEnvelope<T> | T }): T {
  const body = response.data;

  if (
    body &&
    typeof body === "object" &&
    "data" in body
  ) {
    return (body as ApiEnvelope<T>).data;
  }

  return body as T;
}

export const suppliersAdminApi = {
  async summary(): Promise<SupplierSummary> {
    const response = await apiClient.get<
      ApiEnvelope<SupplierSummary> | SupplierSummary
    >("/suppliers/summary");

    return unwrap(response);
  },

  async list(filters: SupplierFilters = {}): Promise<SupplierListResult> {
    const params = Object.fromEntries(
      Object.entries(filters).filter(
        ([, value]) => value !== undefined && value !== "",
      ),
    );

    const response = await apiClient.get<
      ApiEnvelope<SupplierListResult> | SupplierListResult
    >("/suppliers/", { params });

    return unwrap(response);
  },

  async getById(id: string): Promise<Supplier> {
    const response = await apiClient.get<ApiEnvelope<Supplier> | Supplier>(
      `/suppliers/${id}`,
    );

    return unwrap(response);
  },

  async getByCode(code: string): Promise<Supplier> {
    const response = await apiClient.get<ApiEnvelope<Supplier> | Supplier>(
      `/suppliers/code/${encodeURIComponent(code)}`,
    );

    return unwrap(response);
  },

  async create(payload: SupplierInput): Promise<Supplier> {
    const response = await apiClient.post<ApiEnvelope<Supplier> | Supplier>(
      "/suppliers/",
      { ...payload, currency: "BDT" },
    );

    return unwrap(response);
  },

  async update(
    id: string,
    payload: SupplierUpdateInput,
  ): Promise<Supplier> {
    const response = await apiClient.patch<ApiEnvelope<Supplier> | Supplier>(
      `/suppliers/${id}`,
      { ...payload, currency: "BDT" },
    );

    return unwrap(response);
  },

  async updateStatus(
    id: string,
    status: SupplierStatus,
    reason?: string,
  ): Promise<Supplier> {
    const response = await apiClient.patch<ApiEnvelope<Supplier> | Supplier>(
      `/suppliers/${id}/status`,
      { status, reason },
    );

    return unwrap(response);
  },

  async deactivate(id: string): Promise<Supplier> {
    const response = await apiClient.delete<ApiEnvelope<Supplier> | Supplier>(
      `/suppliers/${id}`,
    );

    return unwrap(response);
  },
};
