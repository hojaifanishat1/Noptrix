import { z } from "zod";

import { VARIANT_STATUSES } from "./variant.types";

const mongoIdSchema = z.string().regex(/^[a-f\d]{24}$/i, {
  message: "Invalid MongoDB ObjectId.",
});

const optionsSchema = z
  .record(z.string().trim().min(1).max(100), z.string().trim().min(1).max(160))
  .refine((options) => Object.keys(options).length > 0, {
    message: "At least one variant option is required.",
  })
  .refine((options) => Object.keys(options).length <= 20, {
    message: "A variant cannot have more than 20 options.",
  });

const variantBodyBaseSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    sku: z.string().trim().max(100).optional(),
    barcode: z.string().trim().max(100).optional(),
    options: optionsSchema,
    price: z.number().finite().min(0).optional(),
    compareAtPrice: z.number().finite().min(0).optional(),
    costPrice: z.number().finite().min(0).optional(),
    trackInventory: z.boolean().optional(),
    lowStockThreshold: z.number().int().min(0).optional(),
    status: z.enum(VARIANT_STATUSES).optional(),
    sortOrder: z.number().int().optional(),
  })
  .strict();

const validatePriceRelationship = (
  data: { price?: number; compareAtPrice?: number },
  ctx: z.RefinementCtx,
) => {
  if (
    data.compareAtPrice !== undefined &&
    data.price !== undefined &&
    data.compareAtPrice < data.price
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["compareAtPrice"],
      message: "compareAtPrice must be greater than or equal to price.",
    });
  }
};

const variantBodySchema = variantBodyBaseSchema.superRefine(
  validatePriceRelationship,
);

const variantUpdateBodySchema = variantBodyBaseSchema
  .partial()
  .strict()
  .superRefine((data, ctx) => {
    if (Object.keys(data).length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "At least one field must be provided.",
      });
    }

    validatePriceRelationship(data, ctx);
  });

export const variantCreateSchema = z.object({
  params: z.object({
    productId: mongoIdSchema,
  }),
  body: variantBodySchema,
});

export const variantUpdateSchema = z.object({
  params: z.object({
    productId: mongoIdSchema,
    id: mongoIdSchema,
  }),
  body: variantUpdateBodySchema,
});

export const productIdParamSchema = z.object({
  params: z.object({
    productId: mongoIdSchema,
  }),
});

export const mongoIdParamSchema = z.object({
  params: z.object({
    id: mongoIdSchema,
  }),
});

export const variantIdParamsSchema = z.object({
  params: z.object({
    productId: mongoIdSchema,
    id: mongoIdSchema,
  }),
});

export const variantListQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(150).optional(),
    status: z.enum(VARIANT_STATUSES).optional(),
    sortBy: z
      .enum(["title", "price", "stockQuantity", "sortOrder", "createdAt"])
      .default("sortOrder"),
    sortOrder: z.enum(["asc", "desc"]).default("asc"),
  }),
});

export type VariantCreateBody = z.infer<typeof variantCreateSchema>["body"];
export type VariantUpdateBody = z.infer<typeof variantUpdateSchema>["body"];
export type VariantListQuery = z.infer<typeof variantListQuerySchema>["query"];
