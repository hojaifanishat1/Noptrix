import { z } from "zod";

const notificationSchema = z.object({
  recipientId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  templateKey: z.string().trim().min(1).max(120),
  channel: z.literal("in-app").default("in-app"),
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
  variables: z.record(z.string(), z.unknown()).optional(),
}).strict();

export const createAutomationScheduleSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).optional(),
  kind: z.enum(["RULE", "NOTIFICATION"]),
  recurrence: z.enum(["ONCE", "DAILY", "WEEKLY"]),
  runAt: z.string().datetime({ offset: true }),
  ruleId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  notification: notificationSchema.optional(),
}).strict().superRefine((value, ctx) => {
  if (value.kind === "RULE" && !value.ruleId) {
    ctx.addIssue({
      code: "custom",
      path: ["ruleId"],
      message: "ruleId is required for RULE schedules.",
    });
  }

  if (value.kind === "NOTIFICATION" && !value.notification) {
    ctx.addIssue({
      code: "custom",
      path: ["notification"],
      message: "notification settings are required for NOTIFICATION schedules.",
    });
  }
});

export const updateAutomationScheduleSchema =
  z.object(createAutomationScheduleSchema.shape).partial().superRefine((value, ctx) => {
    if (value.kind === "RULE" && !value.ruleId) {
      ctx.addIssue({
        code: "custom",
        path: ["ruleId"],
        message: "ruleId is required when changing kind to RULE.",
      });
    }

    if (value.kind === "NOTIFICATION" && !value.notification) {
      ctx.addIssue({
        code: "custom",
        path: ["notification"],
        message: "notification settings are required when changing kind to NOTIFICATION.",
      });
    }
  });

export const listAutomationSchedulesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["ACTIVE", "PAUSED", "COMPLETED"]).optional(),
  kind: z.enum(["RULE", "NOTIFICATION"]).optional(),
}).strict();
