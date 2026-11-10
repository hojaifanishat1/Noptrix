
import { z } from "zod";

const text = (max: number) => z.string().trim().min(1).max(max);

const polygonSchema = z
  .object({
    type: z.literal("Polygon"),
    coordinates: z
      .array(z.array(z.array(z.number().finite()).length(2)).min(4))
      .min(1),
  })
  .optional();

const zoneFields = {
  name: text(120),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(150)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must contain lowercase letters, numbers and hyphens",
    ),
  description: z.string().trim().max(500).optional(),

  country: z
    .string()
    .trim()
    .min(2)
    .max(3)
    .transform((value) => value.toUpperCase()),
  state: z.string().trim().max(120).optional(),
  city: text(120),

  postalCodes: z.array(z.string().trim().min(1).max(20)).max(500).default([]),

  boundary: polygonSchema,

  deliveryFee: z.number().finite().min(0),
  freeDeliveryThreshold: z.number().finite().min(0).optional(),
  minimumOrderAmount: z.number().finite().min(0).default(0),

  estimatedDeliveryMinDays: z.number().int().min(0).max(365).default(1),
  estimatedDeliveryMaxDays: z.number().int().min(0).max(365).default(3),

  supportsCOD: z.boolean().default(true),
  priority: z.number().int().min(0).max(100000).default(0),
  status: z.enum(["active", "inactive"]).default("active"),
};

type ZoneRuleInput = {
  estimatedDeliveryMinDays?: number;
  estimatedDeliveryMaxDays?: number;
  boundary?: {
    type: "Polygon";
    coordinates: number[][][];
  };
};

const validateZoneRules = (
  value: ZoneRuleInput,
  context: z.RefinementCtx,
) => {
  if (
    value.estimatedDeliveryMinDays !== undefined &&
    value.estimatedDeliveryMaxDays !== undefined &&
    value.estimatedDeliveryMinDays > value.estimatedDeliveryMaxDays
  ) {
    context.addIssue({
      code: "custom",
      path: ["estimatedDeliveryMaxDays"],
      message: "Maximum days must be greater than or equal to minimum days",
    });
  }

  if (value.boundary) {
    for (const ring of value.boundary.coordinates) {
      const first = ring[0];
      const last = ring[ring.length - 1];

      if (
        !first ||
        !last ||
        first[0] !== last[0] ||
        first[1] !== last[1]
      ) {
        context.addIssue({
          code: "custom",
          path: ["boundary", "coordinates"],
          message: "Each polygon ring must be closed",
        });
      }

      for (const [longitude, latitude] of ring) {
        if (
          longitude < -180 ||
          longitude > 180 ||
          latitude < -90 ||
          latitude > 90
        ) {
          context.addIssue({
            code: "custom",
            path: ["boundary", "coordinates"],
            message: "Invalid longitude or latitude",
          });
          break;
        }
      }
    }
  }
};

const zoneObject = z.object(zoneFields).superRefine(validateZoneRules);

const zoneUpdateObject = z
  .object(zoneFields)
  .partial()
  .superRefine(validateZoneRules)
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one field is required",
  );

export const createDeliveryZoneSchema = z.object({
  body: zoneObject,
});

export const updateDeliveryZoneSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[a-f\d]{24}$/i),
  }),
  body: zoneUpdateObject,
});

export const deliveryZoneIdSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[a-f\d]{24}$/i),
  }),
});

export const deliveryZoneSlugSchema = z.object({
  params: z.object({
    slug: z.string().trim().min(1).max(150),
  }),
});

export const listDeliveryZonesSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    city: z.string().trim().max(120).optional(),
    country: z.string().trim().min(2).max(3).optional(),
    status: z.enum(["active", "inactive"]).optional(),
    search: z.string().trim().max(120).optional(),
    sort: z.enum(["newest", "oldest", "priority"]).default("priority"),
  }),
});

export const checkDeliveryZoneSchema = z.object({
  query: z
    .object({
      city: text(120),
      country: z.string().trim().min(2).max(3).default("BD"),
      postalCode: z.string().trim().max(20).optional(),
      longitude: z.coerce.number().min(-180).max(180).optional(),
      latitude: z.coerce.number().min(-90).max(90).optional(),
      orderAmount: z.coerce.number().finite().min(0).default(0),
      paymentMethod: z.enum(["cod", "online"]).default("online"),
    })
    .refine(
      (value) =>
        (value.longitude === undefined && value.latitude === undefined) ||
        (value.longitude !== undefined && value.latitude !== undefined),
      "Longitude and latitude must be supplied together",
    ),
});
