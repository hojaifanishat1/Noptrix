import { z } from "zod";

import { CANCELLATION_STATUSES } from "./cancellation.types";

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i);

export const adminCancellationParamsSchema = z.object({
  cancellationId: objectIdSchema,
});

export const adminCancellationQuerySchema = z.object({
  status: z.enum(CANCELLATION_STATUSES).optional(),
  search: z.string().trim().max(150).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(["newest", "oldest"]).default("newest"),
}).strict().superRefine((value, ctx) => {
  if (value.from && value.to && new Date(value.from) > new Date(value.to)) {
    ctx.addIssue({
      code: "custom",
      path: ["to"],
      message: "The end date must be after the start date.",
    });
  }
});

export type AdminCancellationQuery = z.infer<
  typeof adminCancellationQuerySchema
>;
