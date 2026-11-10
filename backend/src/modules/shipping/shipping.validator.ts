import { z } from "zod";

import { SHIPPING_STATUSES } from "./shipping.types";

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, {
  message: "Invalid MongoDB ObjectId",
});

const nonEmptyString = (max: number) => z.string().trim().min(1).max(max);

export const shippingAddressSchema = z.object({
  recipientName: nonEmptyString(120),
  phone: nonEmptyString(30),
  addressLine1: nonEmptyString(250),
  addressLine2: z.string().trim().max(250).optional(),
  city: nonEmptyString(100),
  state: z.string().trim().max(100).optional(),
  postalCode: z.string().trim().max(30).optional(),
  country: nonEmptyString(100),
});

export const createShippingSchema = z.object({
  body: z.object({
    orderId: objectIdSchema,
    customerId: objectIdSchema.optional(),
    riderId: objectIdSchema.optional(),

    provider: z.string().trim().min(1).max(80).default("internal"),
    providerShipmentId: z.string().trim().max(150).optional(),

    address: shippingAddressSchema,

    shippingFee: z.number().finite().min(0),
    currency: z.string().trim().length(3).default("SAR"),

    estimatedDeliveryAt: z.coerce.date().optional(),
    idempotencyKey: z.string().trim().min(8).max(200).optional(),
  }),
});

export const updateShippingStatusSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    status: z.enum(SHIPPING_STATUSES),
    eventId: z.string().trim().min(1).max(150),
    description: z.string().trim().min(1).max(500),
    location: z.string().trim().max(200).optional(),
    occurredAt: z.coerce.date().optional(),
    failureReason: z.string().trim().max(500).optional(),
  }),
});

export const assignShippingRiderSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    riderId: objectIdSchema,
  }),
});

export const shippingIdSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});

export const trackingNumberSchema = z.object({
  params: z.object({
    trackingNumber: z.string().trim().min(1).max(100),
  }),
});

export const listShippingSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(SHIPPING_STATUSES).optional(),
    search: z.string().trim().max(120).optional(),
    orderId: objectIdSchema.optional(),
    customerId: objectIdSchema.optional(),
    riderId: objectIdSchema.optional(),
    provider: z.string().trim().min(1).max(80).optional(),
    sort: z.enum(["newest", "oldest"]).default("newest"),
  }),
});
