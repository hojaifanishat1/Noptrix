import apiClient from "@/services/api/client";

import type {
  AdminCancellation,
  CancellationAnalytics,
  CancellationFilters,
  CancellationListResult,
} from "@/features/cancellations/cancellation.types";

interface CancellationListApiResponse {
  success: boolean;
  message: string;
  data: AdminCancellation[];
  pagination: CancellationListResult["pagination"];
}

interface CancellationDataApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface ReviewCancellationPayload {
  status: "APPROVED" | "REJECTED";
  approvedRefundAmount?: number;
  reviewNote?: string;
}

export const cancellationsAdminApi = {
  async list(
    filters: CancellationFilters,
  ): Promise<CancellationListResult> {
    const response =
      await apiClient.get<CancellationListApiResponse>(
        "/cancellations/admin",
        {
          params: {
            page: filters.page,
            limit: filters.limit,
            sort: filters.sort,
            status: filters.status || undefined,
            search: filters.search.trim() || undefined,
            from: filters.from
              ? new Date(
                  `${filters.from}T00:00:00`,
                ).toISOString()
              : undefined,
            to: filters.to
              ? new Date(
                  `${filters.to}T23:59:59.999`,
                ).toISOString()
              : undefined,
          },
        },
      );

    return {
      items: response.data.data,
      pagination: response.data.pagination,
    };
  },

  async get(id: string): Promise<AdminCancellation> {
    const response =
      await apiClient.get<
        CancellationDataApiResponse<AdminCancellation>
      >(`/cancellations/admin/${id}`);

    return response.data.data;
  },

  async analytics(): Promise<CancellationAnalytics> {
    const response =
      await apiClient.get<
        CancellationDataApiResponse<CancellationAnalytics>
      >("/cancellations/admin/analytics");

    return response.data.data;
  },

  async review(
    id: string,
    payload: ReviewCancellationPayload,
  ): Promise<AdminCancellation> {
    const response =
      await apiClient.patch<
        CancellationDataApiResponse<AdminCancellation>
      >(`/cancellations/admin/${id}/review`, payload);

    return response.data.data;
  },
};
