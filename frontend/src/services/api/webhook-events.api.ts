import apiClient from "./client";

export type WebhookEventStatus =
  | "received"
  | "processing"
  | "processed"
  | "failed";

export interface WebhookEvent {
  _id: string;
  provider: string;
  eventId: string;
  eventType: string;
  status: WebhookEventStatus;
  transactionId?: string;
  failureCode?: string;
  processedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookEventsFilters {
  page?: number;
  limit?: number;
  provider?: string;
  status?: WebhookEventStatus;
  from?: string;
  to?: string;
}

export interface WebhookEventsResponse {
  items: WebhookEvent[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export const webhookEventsApi = {
  async getAll(filters: WebhookEventsFilters = {}): Promise<WebhookEventsResponse> {
    const response = await apiClient.get("/webhooks/events", {
      params: filters,
    });

    return {
      items: response.data.data ?? [],
      pagination: response.data.pagination,
    };
  },
};
