import { Types } from "mongoose";
import { z } from "zod";

const slug = z.string().trim().min(2).max(150)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const boundary = z.object({
  type: z.literal("Polygon"),
  coordinates: z.array(
    z.array(
      z.tuple([
        z.number().min(-180).max(180),
        z.number().min(-90).max(90),
      ]),
    ).min(4),
  ).min(1),
}).optional();

const center = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
}).optional();

export const createDeliveryAreaSchema = z.object({
  zoneId: z.string().refine(Types.ObjectId.isValid),
  name: z.string().trim().min(2).max(120),
  slug,
  description: z.string().trim().max(500).optional(),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().max(100).optional(),
  postalCodes: z.array(z.string().trim().min(1).max(20)).max(200).default([]),
  boundary,
  center,
  priority: z.number().int().min(0).max(100000).default(0),
}).strict();

export const updateDeliveryAreaSchema = createDeliveryAreaSchema
  .omit({ zoneId: true })
  .partial()
  .strict();

export const deliveryAreaIdSchema = z.object({
  id: z.string().refine(Types.ObjectId.isValid),
});

export const listDeliveryAreasSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).optional(),
  zoneId: z.string().refine(Types.ObjectId.isValid).optional(),
  city: z.string().trim().max(100).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  sort: z.enum(["newest", "oldest", "priority", "name"]).default("priority"),
});

export type CreateDeliveryAreaInput = z.infer<typeof createDeliveryAreaSchema>;
export type UpdateDeliveryAreaInput = z.infer<typeof updateDeliveryAreaSchema>;
export type ListDeliveryAreasInput = z.infer<typeof listDeliveryAreasSchema>;


export const deliveryEligibilitySchema = z.object({
  country: z.string().trim().min(2).max(3),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().max(100).optional(),
  postalCode: z.string().trim().max(20).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  orderAmount: z.number().finite().min(0),
  paymentMethod: z.enum(["cod", "online"]),
  methodCode: z.string().trim().min(1).max(40).optional(),
}).strict().refine(
  (value) => (value.latitude === undefined) === (value.longitude === undefined),
  { message: "Latitude and longitude must be provided together." }
);
