import apiClient from "./client";
import type {
  AutomationExecution,
  AutomationList,
  AutomationRule,
  AutomationTrigger,
  AutomationCondition,
} from "@/features/automation/automation.types";

interface RuleInput {
  name: string;
  description?: string;
  trigger: AutomationTrigger;
  enabled?: boolean;
  conditions: AutomationCondition[];
  action:
    | { type: "LOG_EVENT"; config: Record<string, unknown> }
    | { type: "SEND_NOTIFICATION"; config: Record<string, unknown> };
}

export const automationApi = {
  async getRules(params: {
    page?: number;
    limit?: number;
    search?: string;
    trigger?: AutomationTrigger;
    actionType?: "LOG_EVENT" | "SEND_NOTIFICATION";
    enabled?: boolean;
  } = {}): Promise<AutomationList<AutomationRule>> {
    const response = await apiClient.get("/automation", { params });
    return {
      items: response.data.data ?? [],
      pagination: response.data.pagination ?? {
        page: 1, limit: 20, total: 0, totalPages: 0,
      },
    };
  },

  async create(input: RuleInput): Promise<AutomationRule> {
    const response = await apiClient.post("/automation", input);
    return response.data.data;
  },

  async update(ruleId: string, input: Partial<RuleInput>): Promise<AutomationRule> {
    const response = await apiClient.patch(
      `/automation/${encodeURIComponent(ruleId)}`, input,
    );
    return response.data.data;
  },

  async remove(ruleId: string): Promise<void> {
    await apiClient.delete(`/automation/${encodeURIComponent(ruleId)}`);
  },

  async enable(ruleId: string): Promise<AutomationRule> {
    const response = await apiClient.post(
      `/automation/${encodeURIComponent(ruleId)}/enable`,
    );
    return response.data.data;
  },

  async disable(ruleId: string): Promise<AutomationRule> {
    const response = await apiClient.post(
      `/automation/${encodeURIComponent(ruleId)}/disable`,
    );
    return response.data.data;
  },

  async test(
    ruleId: string,
    payload: Record<string, unknown>,
  ): Promise<{ matched: boolean; execution: AutomationExecution }> {
    const response = await apiClient.post(
      `/automation/${encodeURIComponent(ruleId)}/test`, { payload },
    );
    return response.data.data;
  },

  async getExecutions(params: {
    page?: number;
    limit?: number;
    status?: string;
  } = {}): Promise<AutomationList<AutomationExecution>> {
    const response = await apiClient.get("/automation/executions", { params });
    return {
      items: response.data.data ?? [],
      pagination: response.data.pagination ?? {
        page: 1, limit: 20, total: 0, totalPages: 0,
      },
    };
  },
};
