import apiClient from "@/services/api/client";
import type { ApiResponse } from "@/types/api";

import type {
  AbandonedCartAnalytics,
  AbandonedCartFilters,
  AbandonedCartListResult,
} from "@/features/abandoned-carts/abandoned-cart.types";

export const abandonedCartsAdminApi = {
  async list(
    filters: AbandonedCartFilters,
  ): Promise<AbandonedCartListResult> {
    const response = await apiClient.get<
      ApiResponse<AbandonedCartListResult>
    >("/abandoned-carts/admin", {
      params: {
        page: filters.page,
        limit: filters.limit,
        status: filters.status || undefined,
        userId: filters.userId?.trim() || undefined,
        from: filters.from || undefined,
        to: filters.to || undefined,
      },
    });

    return response.data.data;
  },

  async analytics(): Promise<AbandonedCartAnalytics> {
    const response = await apiClient.get<
      ApiResponse<AbandonedCartAnalytics>
    >("/abandoned-carts/admin/analytics");

    return response.data.data;
  },
};
