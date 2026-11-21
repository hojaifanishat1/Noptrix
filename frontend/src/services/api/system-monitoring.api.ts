import apiClient from "./client";
import type { ApiResponse } from "@/types/api";

export type SystemMonitoringEndpoint =
  | "overview"
  | "api"
  | "database"
  | "redis"
  | "queues"
  | "workers"
  | "email"
  | "sms"
  | "push"
  | "sockets"
  | "errors"
  | "diagnostics";

export interface SystemMonitoringResult {
  success: boolean;
  [key: string]: unknown;
}

export const systemMonitoringApi = {
  async get(
    endpoint: SystemMonitoringEndpoint,
  ): Promise<unknown> {
    const response = await apiClient.get<ApiResponse<unknown>>(
      `/system-monitoring/${endpoint}`,
    );

    return response.data.data;
  },
};
