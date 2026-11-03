import { z } from "zod";

import { PAYMENT_METHODS } from "./payment.types";
import { PAYMENT_TRANSACTION_STATUSES } from "../../services/payment.service";

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-f\d]{24}$/i, "Invalid MongoDB ObjectId.");

const dateSchema = z.string().datetime({ offset: true });

export const adminPaymentQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(1_000_000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),

    sort: z.enum(["newest", "oldest"]).default("newest"),

    status: z
      .enum(
        Object.values(PAYMENT_TRANSACTION_STATUSES) as [
          string,
          ...string[],
        ],
      )
      .optional(),

    method: z.enum(PAYMENT_METHODS).optional(),

    provider: z.string().trim().min(1).max(80).optional(),

    orderId: z.string().trim().min(1).max(200).optional(),

    customerId: objectIdSchema.optional(),

    transactionId: z.string().trim().min(1).max(200).optional(),

    search: z.string().trim().min(1).max(200).optional(),

    from: dateSchema.optional(),
    to: dateSchema.optional(),
  })
  .strict()
  .refine(
    (value) =>
      !value.from ||
      !value.to ||
      new Date(value.from).getTime() <= new Date(value.to).getTime(),
    {
      message: "'from' must be earlier than or equal to 'to'.",
      path: ["from"],
    },
  );

export const adminPaymentParamsSchema = z
  .object({
    transactionId: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .regex(/^[a-zA-Z0-9_-]+$/, "Invalid payment transaction ID."),
  })
  .strict();

export type AdminPaymentQuery = z.infer<
  typeof adminPaymentQuerySchema
>;
