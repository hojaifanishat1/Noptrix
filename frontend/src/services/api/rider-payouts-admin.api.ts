import apiClient from "@/services/api/client";
import type { ApiResponse } from "@/types/api";
import type {
  GenerateRiderPayoutResult,
  RiderPayout,
  RiderPayoutFilters,
  RiderPayoutListResult,
  RiderPayoutStatus,
} from "@/features/rider-payouts/rider-payout.types";

export const riderPayoutsAdminApi = {
  async list(filters: RiderPayoutFilters): Promise<RiderPayoutListResult> {
    const response = await apiClient.get<
      ApiResponse<RiderPayoutListResult>
    >("/rider-payouts/admin", {
      params: {
        ...filters,
        status: filters.status || undefined,
        riderId: filters.riderId?.trim() || undefined,
        currency: filters.currency?.trim().toUpperCase() || undefined,
      },
    });

    return response.data.data;
  },

  async generate(riderId?: string): Promise<GenerateRiderPayoutResult> {
    const response = await apiClient.post<
      ApiResponse<GenerateRiderPayoutResult>
    >(
      "/rider-payouts/admin/generate",
      riderId?.trim() ? { riderId: riderId.trim() } : {},
    );

    return response.data.data;
  },

  async updateStatus(
    payoutId: string,
    input: {
      status: Exclude<RiderPayoutStatus, "PENDING">;
      paymentReference?: string;
      notes?: string;
    },
  ): Promise<RiderPayout> {
    const response = await apiClient.patch<ApiResponse<RiderPayout>>(
      `/rider-payouts/admin/${encodeURIComponent(payoutId)}/status`,
      input,
    );

    return response.data.data;
  },
};
