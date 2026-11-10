import { z } from "zod";

const fields = {
  code: z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9_-]+$/),
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).optional(),
  estimatedMinMinutes: z.number().int().min(1).max(10080),
  estimatedMaxMinutes: z.number().int().min(1).max(10080),
  maximumDistanceKm: z.number().finite().min(0).optional(),
  requiresLiveRider: z.boolean().default(false),
  requiresAreaCoverage: z.boolean().default(true),
  priority: z.number().int().min(0).max(100000).default(0),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
};

export const createDeliveryMethodSchema = z.object(fields).strict()
  .superRefine((value, ctx) => {
    if (value.estimatedMaxMinutes < value.estimatedMinMinutes) {
      ctx.addIssue({
        code: "custom", path: ["estimatedMaxMinutes"],
        message: "Maximum estimate must be greater than minimum estimate.",
      });
    }
  });

export const updateDeliveryMethodSchema = z.object({
  code: fields.code.optional(),
  name: fields.name.optional(),
  description: fields.description,
  estimatedMinMinutes: fields.estimatedMinMinutes.optional(),
  estimatedMaxMinutes: fields.estimatedMaxMinutes.optional(),
  maximumDistanceKm: fields.maximumDistanceKm,
  requiresLiveRider: fields.requiresLiveRider.optional(),
  requiresAreaCoverage: fields.requiresAreaCoverage.optional(),
  priority: fields.priority.optional(),
  status: fields.status.optional(),
}).strict().superRefine((value, ctx) => {
  if (
    value.estimatedMinMinutes !== undefined &&
    value.estimatedMaxMinutes !== undefined &&
    value.estimatedMaxMinutes < value.estimatedMinMinutes
  ) {
    ctx.addIssue({
      code: "custom", path: ["estimatedMaxMinutes"],
      message: "Maximum estimate must be greater than minimum estimate.",
    });
  }
});

export const deliveryMethodIdSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i),
});

export const listDeliveryMethodsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  sort: z.enum(["newest", "oldest", "priority", "name"]).default("priority"),
});
