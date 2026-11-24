import { z } from "zod";

const objectId = z
  .string()
  .trim()
  .regex(/^[a-f\d]{24}$/i, "Invalid MongoDB ObjectId.");

export const riderPayoutQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["PENDING", "APPROVED", "PAID", "CANCELLED"]).optional(),
  riderId: objectId.optional(),
  currency: z.string().trim().toUpperCase().length(3).optional(),
});

export const generateRiderPayoutSchema = z.object({
  riderId: objectId.optional(),
});

export const updateRiderPayoutStatusSchema = z.object({
  status: z.enum(["APPROVED", "PAID", "CANCELLED"]),
  paymentReference: z.string().trim().min(1).max(200).optional(),
  notes: z.string().trim().max(2000).optional(),
}).superRefine((value, ctx) => {
  if (value.status === "PAID" && !value.paymentReference) {
    ctx.addIssue({
      code: "custom",
      path: ["paymentReference"],
      message: "Payment reference is required when marking a payout paid.",
    });
  }
});

export const riderPayoutIdParamsSchema = z.object({
  payoutId: objectId,
});

export type RiderPayoutQueryInput = z.infer<
  typeof riderPayoutQuerySchema
>;

export type GenerateRiderPayoutInput = z.infer<
  typeof generateRiderPayoutSchema
>;

export type UpdateRiderPayoutStatusInput = z.infer<
  typeof updateRiderPayoutStatusSchema
>;
