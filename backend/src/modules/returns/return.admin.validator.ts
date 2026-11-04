import { z } from "zod";

import {
  RETURN_STATUSES,
} from "./return.types";

const objectIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "Invalid MongoDB ObjectId.");

export const adminReturnQuerySchema = z.object({
  status: z.enum(RETURN_STATUSES).optional(),
  orderId: objectIdSchema.optional(),
  search: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(["newest", "oldest"]).default("newest"),
}).strict();
