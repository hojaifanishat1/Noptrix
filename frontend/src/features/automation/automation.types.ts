export const AUTOMATION_TRIGGERS = [
  "ORDER_CREATED",
  "ORDER_CONFIRMED",
  "ORDER_CANCELLED",
  "PAYMENT_COMPLETED",
  "REFUND_REQUESTED",
  "REFUND_COMPLETED",
  "SELLER_APPROVED",
  "SELLER_SUSPENDED",
  "DELIVERY_ASSIGNED",
  "DELIVERY_COMPLETED",
] as const;

export type AutomationTrigger = (typeof AUTOMATION_TRIGGERS)[number];
export type ConditionOperator =
  | "equals" | "not_equals" | "greater_than" | "less_than" | "contains";

export interface AutomationCondition {
  field: string;
  operator: ConditionOperator;
  value: string | number | boolean;
}

export interface AutomationRule {
  _id: string;
  name: string;
  description?: string;
  trigger: AutomationTrigger;
  enabled: boolean;
  conditions: AutomationCondition[];
  action:
    | { type: "LOG_EVENT"; config: Record<string, unknown> }
    | { type: "SEND_NOTIFICATION"; config: Record<string, unknown> };
  createdAt?: string;
  updatedAt?: string;
}

export interface AutomationExecution {
  _id: string;
  ruleId: string;
  ruleName: string;
  trigger: string;
  status: "SUCCESS" | "SKIPPED" | "FAILED" | "TEST";
  eventId?: string;
  message: string;
  payload?: Record<string, unknown>;
  executedAt: string;
}

export interface AutomationPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
}

export interface AutomationList<T> {
  items: T[];
  pagination: AutomationPagination;
}
