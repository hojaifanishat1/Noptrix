import apiClient from "./client";

export interface SystemLog {
  _id: string;
  level: string;
  source: string;
  message: string;
  requestId?: string;
  correlationId?: string;
  errorCode?: string;
  path?: string;
  method?: string;
  createdAt: string;
}

export const systemLogsApi = {
  async getAll(filters: { page?: number; limit?: number; source?: string; level?: string } = {}) {
    const response = await apiClient.get("/system-logs", { params: filters });
    if (response.data?.success === false) {
      throw new Error(response.data.message || "Unable to load system logs.");
    }
    return {
      items: response.data?.data ?? [],
      pagination: response.data?.pagination,
    };
  },
};
