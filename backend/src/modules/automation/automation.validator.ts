import { z } from "zod";
import { AUTOMATION_TRIGGERS } from "./automation.model";

const conditionSchema = z.object({
  field: z.string().trim().min(1).max(100),
  operator: z.enum(["equals", "not_equals", "greater_than", "less_than", "contains"]),
  value: z.union([z.string().max(500), z.number(), z.boolean()]),
}).strict();

export const createAutomationRuleSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).optional(),
  trigger: z.enum(AUTOMATION_TRIGGERS),
  enabled: z.boolean().optional(),
  conditions: z.array(conditionSchema).max(20).default([]),
  action: z.discriminatedUnion("type", [
    z.object({
      type: z.literal("LOG_EVENT"),
      config: z.record(z.string(), z.unknown()).default({}),
    }).strict(),
    z.object({
      type: z.literal("SEND_NOTIFICATION"),
      config: z.object({
        recipientIdPath: z.string().trim().min(1).max(120),
        notificationType: z.enum([
          "JOB_APPLICATION_STATUS",
          "JOB_APPLICATION_INTERVIEW",
          "ORDER_STATUS",
          "PAYMENT_STATUS",
          "DELIVERY_STATUS",
          "PROMOTION",
          "SYSTEM",
        ]),
        locale: z.string().trim().min(2).max(20).optional(),
      }).strict(),
    }).strict(),
  ]),
}).strict();

export const updateAutomationRuleSchema = createAutomationRuleSchema.partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required.",
  });

export const automationIdParamsSchema = z.object({
  ruleId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid automation rule ID."),
}).strict();

export const automationListQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  trigger: z.enum(AUTOMATION_TRIGGERS).optional(),
  actionType: z.enum(["LOG_EVENT", "SEND_NOTIFICATION"]).optional(),
  enabled: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict();

export const automationTestSchema = z.object({
  payload: z.record(z.string(), z.unknown()).default({}),
}).strict();

export type CreateAutomationRuleInput = z.infer<typeof createAutomationRuleSchema>;
export type UpdateAutomationRuleInput = z.infer<typeof updateAutomationRuleSchema>;
