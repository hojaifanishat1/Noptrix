import { z } from "zod";

import { ORDER_PAYMENT_STATUSES, ORDER_STATUSES } from "./order.types";

export const adminOrderQuerySchema = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  paymentStatus: z.enum(ORDER_PAYMENT_STATUSES).optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(["newest", "oldest"]).default("newest"),
});

export const adminOrderParamsSchema = z.object({
  orderId: z
    .string()
    .trim()
    .regex(/^[a-f\d]{24}$/i, "Invalid order ID."),
});

export const adminUpdateOrderStatusSchema = z.object({
  status: z.enum([
    "CONFIRMED",
    "PROCESSING",
    "READY_TO_SHIP",
    "SHIPPED",
    "DELIVERED",
    "CANCELLED",
  ]),
  internalNote: z.string().trim().max(2000).optional(),
});

export type AdminOrderQuery = z.infer<typeof adminOrderQuerySchema>;
