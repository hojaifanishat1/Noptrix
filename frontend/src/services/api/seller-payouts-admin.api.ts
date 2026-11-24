import apiClient from "@/services/api/client";
import type { ApiResponse } from "@/types/api";

import type {
  GenerateSellerPayoutResult,
  SellerPayout,
  SellerPayoutFilters,
  SellerPayoutListResult,
  SellerPayoutStatus,
} from "@/features/seller-payouts/seller-payout.types";

export const sellerPayoutsAdminApi = {
  async list(filters: SellerPayoutFilters): Promise<SellerPayoutListResult> {
    const response = await apiClient.get<ApiResponse<SellerPayoutListResult>>(
      "/seller-payouts/admin",
      {
        params: {
          ...filters,
          status: filters.status || undefined,
          sellerId: filters.sellerId?.trim() || undefined,
          currency: filters.currency?.trim().toUpperCase() || undefined,
        },
      },
    );

    return response.data.data;
  },

  async generate(sellerId?: string): Promise<GenerateSellerPayoutResult> {
    const response = await apiClient.post<ApiResponse<GenerateSellerPayoutResult>>(
      "/seller-payouts/admin/generate",
      sellerId ? { sellerId: sellerId.trim() } : {},
    );

    return response.data.data;
  },

  async updateStatus(
    payoutId: string,
    input: {
      status: Exclude<SellerPayoutStatus, "PENDING">;
      paymentReference?: string;
      notes?: string;
    },
  ): Promise<SellerPayout> {
    const response = await apiClient.patch<ApiResponse<SellerPayout>>(
      `/seller-payouts/admin/${encodeURIComponent(payoutId)}/status`,
      input,
    );

    return response.data.data;
  },
};
