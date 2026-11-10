import { z } from "zod";

import { DELIVERY_STATUSES } from "./delivery.types";

const objectId = z.string().regex(/^[a-f\d]{24}$/i);

const text = (max: number) => z.string().trim().min(1).max(max);

export const createDeliverySchema = z.object({
  body: z.object({
    orderId: objectId,
    shipmentId: objectId.optional(),
    customerId: objectId.optional(),

    recipientName: text(120),
    recipientPhone: text(30),
    address: text(500),
    city: text(100),

    deliveryFee: z.number().finite().min(0),
    currency: z.string().trim().length(3).default("SAR"),

    idempotencyKey: z.string().trim().min(8).max(200).optional(),
  }),
});

export const assignRiderSchema = z.object({
  params: z.object({ id: objectId }),
  body: z.object({ riderId: objectId }),
});

export const updateDeliveryStatusSchema = z.object({
  params: z.object({ id: objectId }),
  body: z.object({
    status: z.enum(DELIVERY_STATUSES),
    eventId: text(150),
    description: text(500),
    location: z.string().trim().max(200).optional(),
    occurredAt: z.coerce.date().optional(),
    failureReason: z.string().trim().max(500).optional(),
    proofOfDeliveryUrl: z.string().url().max(2048).optional(),
    recipientSignatureUrl: z.string().url().max(2048).optional(),
  }),
});

export const deliveryIdSchema = z.object({
  params: z.object({ id: objectId }),
});

export const listDeliveriesSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(DELIVERY_STATUSES).optional(),
    search: z.string().trim().max(120).optional(),
    orderId: objectId.optional(),
    riderId: objectId.optional(),
    customerId: objectId.optional(),
    sort: z.enum(["newest", "oldest"]).default("newest"),
  }),
});
