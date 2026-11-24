import apiClient from "@/services/api/client";
import type { ApiResponse } from "@/types/api";

import type {
  AdminCOD,
  CODFilters,
  CODListResult,
} from "@/features/cod/cod.types";

export const codAdminApi = {
  async list(filters: CODFilters): Promise<CODListResult> {
    const response = await apiClient.get<ApiResponse<CODListResult>>(
      "/cod",
      {
        params: {
          ...filters,
          status: filters.status || undefined,
          riderId: filters.riderId?.trim() || undefined,
          orderId: filters.orderId?.trim() || undefined,
        },
      },
    );

    return response.data.data;
  },

  async remit(codId: string): Promise<AdminCOD> {
    const response = await apiClient.patch<ApiResponse<AdminCOD>>(
      `/cod/${encodeURIComponent(codId)}/remit`,
      {},
    );

    return response.data.data;
  },

  async reverse(codId: string, notes: string): Promise<AdminCOD> {
    const response = await apiClient.patch<ApiResponse<AdminCOD>>(
      `/cod/${encodeURIComponent(codId)}/reverse`,
      { notes },
    );

    return response.data.data;
  },
};
