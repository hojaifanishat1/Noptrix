import apiClient from "@/services/api/client";

import type {
  ManualRefundInput,
  RefundActionInput,
  RefundAnalyticsResponse,
  RefundDetailsResponse,
  RefundListResponse,
  RefundQuery,
} from "@/features/refunds/refund.types";

const BASE_URL = "/refunds/admin";

export const refundsAdminApi = {
  async getRefunds(params: RefundQuery = {}) {
    const response = await apiClient.get<RefundListResponse>(BASE_URL, {
      params,
    });

    return response.data;
  },

  async getAnalytics() {
    const response = await apiClient.get<RefundAnalyticsResponse>(
      `${BASE_URL}/analytics`,
    );

    return response.data;
  },

  async getRefundDetails(refundId: string) {
    const response = await apiClient.get<RefundDetailsResponse>(
      `${BASE_URL}/${refundId}`,
    );

    return response.data;
  },

  async processRefund(refundId: string, input: RefundActionInput = {}) {
    const response = await apiClient.post(
      `${BASE_URL}/${refundId}/process`,
      input,
    );

    return response.data;
  },

  async cancelRefund(refundId: string, input: RefundActionInput = {}) {
    const response = await apiClient.post(
      `${BASE_URL}/${refundId}/cancel`,
      input,
    );

    return response.data;
  },

  async confirmManualRefund(refundId: string, input: ManualRefundInput) {
    const response = await apiClient.post(
      `${BASE_URL}/${refundId}/confirm-manual`,
      input,
    );

    return response.data;
  },
};
