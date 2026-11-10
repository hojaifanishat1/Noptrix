import { Types } from "mongoose";
import { z } from "zod";

const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(160)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Slug must contain lowercase letters, numbers and hyphens.",
  );

const postalCodesSchema = z
  .array(z.string().trim().min(1).max(20))
  .max(200)
  .default([]);

const commonFields = {
  name: z.string().trim().min(2).max(120),
  slug: slugSchema,
  description: z.string().trim().max(1000).optional(),

  country: z.string().trim().min(2).max(3).default("BD"),
  state: z.string().trim().max(120).optional(),
  city: z.string().trim().max(120).optional(),

  deliveryZoneId: z
    .string()
    .refine(Types.ObjectId.isValid, "Invalid delivery zone ID.")
    .optional(),

  deliveryMethodId: z
    .string()
    .refine(Types.ObjectId.isValid, "Invalid delivery method ID.")
    .optional(),

  postalCodes: postalCodesSchema,

  method: z.enum(["flat", "weight_based", "order_value_based"]).default("flat"),

  baseFee: z.number().finite().min(0),
  perKgFee: z.number().finite().min(0).default(0),

  freeDeliveryThreshold: z.number().finite().min(0).optional(),
  minimumOrderAmount: z.number().finite().min(0).default(0),

  minimumWeightKg: z.number().finite().min(0).default(0),
  maximumWeightKg: z.number().finite().min(0).optional(),

  supportsCOD: z.boolean().default(true),
  priority: z.number().int().min(0).max(100000).default(0),
  status: z.enum(["active", "inactive"]).default("active"),
};

export const createDeliveryFeeSchema = z
  .object(commonFields)
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.maximumWeightKg !== undefined &&
      value.maximumWeightKg < value.minimumWeightKg
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["maximumWeightKg"],
        message: "Maximum weight cannot be less than minimum weight.",
      });
    }

    if (value.method !== "weight_based" && value.perKgFee !== 0) {
      ctx.addIssue({
        code: "custom",
        path: ["perKgFee"],
        message: "perKgFee must be zero for this fee method.",
      });
    }
  });

export const updateDeliveryFeeSchema = z
  .object({
    name: commonFields.name.optional(),
    slug: commonFields.slug.optional(),
    description: commonFields.description,

    country: z.string().trim().min(2).max(3).optional(),
    state: commonFields.state,
    city: commonFields.city,
    deliveryZoneId: commonFields.deliveryZoneId,
    deliveryMethodId: commonFields.deliveryMethodId,
    postalCodes: z.array(z.string().trim().min(1).max(20)).max(200).optional(),

    method: commonFields.method.optional(),
    baseFee: commonFields.baseFee.optional(),
    perKgFee: commonFields.perKgFee.optional(),
    freeDeliveryThreshold: commonFields.freeDeliveryThreshold,
    minimumOrderAmount: commonFields.minimumOrderAmount.optional(),

    minimumWeightKg: commonFields.minimumWeightKg.optional(),
    maximumWeightKg: commonFields.maximumWeightKg,

    supportsCOD: commonFields.supportsCOD.optional(),
    priority: commonFields.priority.optional(),
    status: commonFields.status.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.minimumWeightKg !== undefined &&
      value.maximumWeightKg !== undefined &&
      value.maximumWeightKg < value.minimumWeightKg
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["maximumWeightKg"],
        message: "Maximum weight cannot be less than minimum weight.",
      });
    }

    if (
      value.method !== undefined &&
      value.method !== "weight_based" &&
      (value.perKgFee ?? 0) !== 0
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["perKgFee"],
        message: "perKgFee must be zero unless method is weight_based.",
      });
    }
  });

export const deliveryFeeIdSchema = z.object({
  id: z.string().refine(Types.ObjectId.isValid, "Invalid delivery fee ID."),
});

export const deliveryFeeSlugSchema = z.object({
  slug: slugSchema,
});

export const listDeliveryFeesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).optional(),
  country: z.string().trim().min(2).max(3).optional(),
  city: z.string().trim().max(120).optional(),
  status: z.enum(["active", "inactive"]).optional(),
  method: z.enum(["flat", "weight_based", "order_value_based"]).optional(),
  deliveryZoneId: z
    .string()
    .refine(Types.ObjectId.isValid, "Invalid delivery zone ID.")
    .optional(),
  deliveryMethodId: commonFields.deliveryMethodId,
  sort: z.enum(["newest", "oldest", "priority", "name"]).default("priority"),
});

export const calculateDeliveryFeeSchema = z
  .object({
    country: z.string().trim().min(2).max(3).default("BD"),
    state: z.string().trim().max(120).optional(),
    city: z.string().trim().min(1).max(120),
    postalCode: z.string().trim().min(1).max(20).optional(),

    deliveryZoneId: z
      .string()
      .refine(Types.ObjectId.isValid, "Invalid delivery zone ID.")
      .optional(),

    deliveryMethodId: commonFields.deliveryMethodId,

    orderAmount: z.number().finite().min(0),
    weightKg: z.number().finite().min(0).default(0),
    paymentMethod: z.enum(["cod", "online"]).default("online"),
  })
  .strict();

export type CreateDeliveryFeeInput = z.infer<typeof createDeliveryFeeSchema>;

export type UpdateDeliveryFeeInput = z.infer<typeof updateDeliveryFeeSchema>;

export type ListDeliveryFeesInput = z.infer<typeof listDeliveryFeesSchema>;

export type CalculateDeliveryFeeInput = z.infer<
  typeof calculateDeliveryFeeSchema
>;
