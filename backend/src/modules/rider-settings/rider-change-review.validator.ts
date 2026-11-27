import { z } from "zod";

export const reviewRiderChangeRequestSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  reviewNote: z.string().trim().max(1000).optional(),
}).strict();
