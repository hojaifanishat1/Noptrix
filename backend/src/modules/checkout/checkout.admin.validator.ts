import { z } from "zod";

import {
  CHECKOUT_PAYMENT_STATUSES,
  CHECKOUT_STATUSES,
} from "./checkout.types";

export const adminCheckoutQuerySchema = z.object({
  status: z.enum(CHECKOUT_STATUSES).optional(),
  paymentStatus: z.enum(CHECKOUT_PAYMENT_STATUSES).optional(),
  search: z.string().trim().max(100).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(["newest", "oldest"]).default("newest"),
}).refine(
  (value) => !value.from || !value.to || new Date(value.from) <= new Date(value.to),
  { message: "The from date must be before the to date.", path: ["from"] },
);

export const adminCheckoutParamsSchema = z.object({
  checkoutId: z.string().trim().regex(/^[a-f\d]{24}$/i, "Invalid checkout ID."),
});

export type AdminCheckoutQuery = z.infer<typeof adminCheckoutQuerySchema>;
