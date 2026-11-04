import apiClient from "@/services/api/client";

import type {
  AdminCheckout,
  CheckoutAnalytics,
  CheckoutFilters,
  CheckoutListResult,
} from "@/features/checkout/checkout.types";

interface CheckoutListApiResponse {
  success: boolean;
  message: string;
  data: AdminCheckout[];
  pagination: CheckoutListResult["pagination"];
}

interface CheckoutDataApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export const checkoutAdminApi = {
  async list(filters: CheckoutFilters): Promise<CheckoutListResult> {
    const response = await apiClient.get<CheckoutListApiResponse>(
      "/checkout/admin",
      {
        params: {
          page: filters.page,
          limit: filters.limit,
          sort: filters.sort,
          status: filters.status || undefined,
          paymentStatus: filters.paymentStatus || undefined,
          search: filters.search.trim() || undefined,
          from: filters.from
            ? new Date(`${filters.from}T00:00:00`).toISOString()
            : undefined,
          to: filters.to
            ? new Date(`${filters.to}T23:59:59.999`).toISOString()
            : undefined,
        },
      },
    );

    return {
      items: response.data.data,
      pagination: response.data.pagination,
    };
  },

  async get(checkoutId: string): Promise<AdminCheckout> {
    const response = await apiClient.get<
      CheckoutDataApiResponse<AdminCheckout>
    >(`/checkout/admin/${checkoutId}`);

    return response.data.data;
  },

  async analytics(): Promise<CheckoutAnalytics> {
    const response = await apiClient.get<
      CheckoutDataApiResponse<CheckoutAnalytics>
    >("/checkout/admin/analytics");

    return response.data.data;
  },
};
