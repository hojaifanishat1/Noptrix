import apiClient from "@/services/api/client";
import type { ApiResponse } from "@/types/api";

export type ScheduleKind = "RULE" | "NOTIFICATION";
export type ScheduleRecurrence = "ONCE" | "DAILY" | "WEEKLY";
export type ScheduleStatus = "ACTIVE" | "PAUSED" | "COMPLETED";

export interface AutomationSchedule {
  _id: string;
  name: string;
  description?: string;
  kind: ScheduleKind;
  recurrence: ScheduleRecurrence;
  runAt: string;
  nextRunAt: string | null;
  lastRunAt?: string;
  lastError?: string;
  runCount: number;
  status: ScheduleStatus;
  ruleId?: string;
  payload?: Record<string, unknown>;
  notification?: {
    recipientId: string;
    templateKey: string;
    channel: "in-app";
    notificationType: string;
    locale?: string;
    variables?: Record<string, unknown>;
  };
  createdAt?: string;
}

export interface ScheduleInput {
  name: string;
  description?: string;
  kind: ScheduleKind;
  recurrence: ScheduleRecurrence;
  runAt: string;
  ruleId?: string;
  payload?: Record<string, unknown>;
  notification?: {
    recipientId: string;
    templateKey: string;
    channel: "in-app";
    notificationType: string;
    locale?: string;
  };
}

interface ScheduleListResult {
  items: AutomationSchedule[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export const automationScheduleApi = {
  async list(params: {
    page?: number;
    limit?: number;
    status?: ScheduleStatus;
    kind?: ScheduleKind;
  } = {}) {
    const response = await apiClient.get<ApiResponse<ScheduleListResult>>(
      "/automation/schedules",
      { params },
    );
    return response.data.data;
  },

  async create(input: ScheduleInput) {
    const response = await apiClient.post<ApiResponse<AutomationSchedule>>(
      "/automation/schedules",
      input,
    );
    return response.data.data;
  },

  async update(id: string, input: Partial<ScheduleInput>) {
    const response = await apiClient.patch<ApiResponse<AutomationSchedule>>(
      `/automation/schedules/${id}`,
      input,
    );
    return response.data.data;
  },

  async pause(id: string) {
    const response = await apiClient.patch<ApiResponse<AutomationSchedule>>(
      `/automation/schedules/${id}/pause`,
    );
    return response.data.data;
  },

  async resume(id: string) {
    const response = await apiClient.patch<ApiResponse<AutomationSchedule>>(
      `/automation/schedules/${id}/resume`,
    );
    return response.data.data;
  },

  async remove(id: string) {
    await apiClient.delete(`/automation/schedules/${id}`);
  },
};
