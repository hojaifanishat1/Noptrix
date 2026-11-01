import { z } from "zod";

import {
  INVENTORY_POLICIES,
  PRODUCT_STATUSES,
  PRODUCT_TYPES,
  PRODUCT_VISIBILITIES,
} from "./product.types";

const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid MongoDB ObjectId");

const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(200)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Slug may contain lowercase letters, numbers and hyphens",
  );

const seoSchema = z
  .object({
    title: z.string().trim().max(70).optional(),
    description: z.string().trim().max(320).optional(),
    keywords: z.array(z.string().trim().max(80)).max(30).optional(),
    canonicalUrl: z.string().url().max(2048).optional(),
  })
  .strict();

const shippingSchema = z
  .object({
    required: z.boolean().optional(),
    weight: z.number().min(0).optional(),
    weightUnit: z.enum(["g", "kg"]).optional(),
    length: z.number().min(0).optional(),
    width: z.number().min(0).optional(),
    height: z.number().min(0).optional(),
    dimensionUnit: z.enum(["cm", "m"]).optional(),
  })
  .strict();

const productBaseSchema = z
  .object({
    name: z.string().trim().min(2).max(180),
    slug: slugSchema.optional(),

    description: z.string().trim().max(30000).optional(),
    shortDescription: z.string().trim().max(500).optional(),

    type: z.enum(PRODUCT_TYPES).optional(),
    status: z.enum(PRODUCT_STATUSES).optional(),
    visibility: z.enum(PRODUCT_VISIBILITIES).optional(),
    publishAt: z.coerce.date().nullable().optional(),

    sku: z.string().trim().min(1).max(100).optional(),
    barcode: z.string().trim().min(1).max(100).optional(),
    sellerId: objectIdSchema.optional(),

    categoryId: objectIdSchema,
    subcategoryId: objectIdSchema.optional(),
    brandId: objectIdSchema.optional(),
    collectionIds: z.array(objectIdSchema).max(100).optional(),
    tagIds: z.array(objectIdSchema).max(100).optional(),

    price: z.number().finite().min(0),
    compareAtPrice: z.number().finite().min(0).optional(),
    costPrice: z.number().finite().min(0).optional(),
    salePrice: z.number().finite().min(0).nullable().optional(),
    saleStartsAt: z.coerce.date().nullable().optional(),
    saleEndsAt: z.coerce.date().nullable().optional(),

    currency: z.string().trim().length(3).optional(),

    trackInventory: z.boolean().optional(),
    stockQuantity: z.number().int().min(0).optional(),
    lowStockThreshold: z.number().int().min(0).optional(),
    inventoryPolicy: z.enum(INVENTORY_POLICIES).optional(),

    requiresShipping: z.boolean().optional(),
    shipping: shippingSchema.optional(),

    tags: z.array(z.string().trim().min(1).max(50)).max(100).optional(),
    attributes: z.record(z.string(), z.unknown()).optional(),

    seo: seoSchema.optional(),

    featured: z.boolean().optional(),
    sortOrder: z.number().int().min(-100000).max(100000).optional(),
  })
  .strict();

export const createProductSchema = z
  .object({
    body: productBaseSchema
      .extend({
        inventoryWarehouseId: objectIdSchema.optional(),
      })
      .superRefine((data, ctx) => {
        if (
          data.compareAtPrice !== undefined &&
          data.compareAtPrice <= data.price
        ) {
          ctx.addIssue({
            code: "custom",
            path: ["compareAtPrice"],
            message: "compareAtPrice must be greater than price",
          });
        }

        if (data.trackInventory !== false && !data.inventoryWarehouseId) {
          ctx.addIssue({
            code: "custom",
            path: ["inventoryWarehouseId"],
            message: "Select a warehouse for inventory-tracked products.",
          });
        }

        if (
          data.trackInventory === false &&
          data.inventoryWarehouseId !== undefined
        ) {
          ctx.addIssue({
            code: "custom",
            path: ["inventoryWarehouseId"],
            message:
              "An inventory warehouse cannot be selected when inventory tracking is disabled.",
          });
        }

        if (data.type === "DIGITAL" && data.requiresShipping === true) {
          ctx.addIssue({
            code: "custom",
            path: ["requiresShipping"],
            message: "Digital products should not require shipping",
          });
        }

        if (data.publishAt && data.publishAt <= new Date()) {
          ctx.addIssue({
            code: "custom",
            path: ["publishAt"],
            message: "Scheduled publish time must be in the future.",
          });
        }
        if (data.publishAt && data.status === "INACTIVE") {
          ctx.addIssue({
            code: "custom",
            path: ["status"],
            message: "An inactive product cannot be scheduled for publication.",
          });
        }

        if (
          data.salePrice !== undefined &&
          data.salePrice !== null &&
          data.salePrice >= data.price
        ) {
          ctx.addIssue({
            code: "custom",
            path: ["salePrice"],
            message: "Sale price must be less than the regular price.",
          });
        }

        if (
          data.saleStartsAt &&
          data.saleEndsAt &&
          data.saleStartsAt >= data.saleEndsAt
        ) {
          ctx.addIssue({
            code: "custom",
            path: ["saleEndsAt"],
            message: "Sale end time must be later than its start time.",
          });
        }
      }),
  })
  .strict();

export const updateProductSchema = z
  .object({
    params: z
      .object({
        id: objectIdSchema,
      })
      .strict(),

    body: productBaseSchema.partial().superRefine((data, ctx) => {
      if (
        data.compareAtPrice !== undefined &&
        data.price !== undefined &&
        data.compareAtPrice <= data.price
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["compareAtPrice"],
          message: "compareAtPrice must be greater than price",
        });
      }

      if (
        data.salePrice !== undefined &&
        data.salePrice !== null &&
        data.price !== undefined &&
        data.salePrice >= data.price
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["salePrice"],
          message: "Sale price must be less than the regular price.",
        });
      }

      if (
        data.saleStartsAt &&
        data.saleEndsAt &&
        data.saleStartsAt >= data.saleEndsAt
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["saleEndsAt"],
          message: "Sale end time must be later than its start time.",
        });
      }

      if (data.publishAt && data.publishAt <= new Date()) {
        ctx.addIssue({
          code: "custom",
          path: ["publishAt"],
          message: "Scheduled publish time must be in the future.",
        });
      }

      if (data.publishAt && data.status === "INACTIVE") {
        ctx.addIssue({
          code: "custom",
          path: ["status"],
          message: "An inactive product cannot be scheduled for publication.",
        });
      }
    }),
  })
  .strict();

export const productIdParamsSchema = z
  .object({
    params: z
      .object({
        id: objectIdSchema,
      })
      .strict(),
  })
  .strict();

export const productSlugParamsSchema = z
  .object({
    params: z
      .object({
        slug: slugSchema,
      })
      .strict(),
  })
  .strict();

export const listProductsSchema = z
  .object({
    query: z
      .object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),

        search: z.string().trim().max(150).optional(),

        status: z.enum(PRODUCT_STATUSES).optional(),
        type: z.enum(PRODUCT_TYPES).optional(),

        categoryId: objectIdSchema.optional(),
        subcategoryId: objectIdSchema.optional(),
        brandId: objectIdSchema.optional(),

        minPrice: z.coerce.number().min(0).optional(),
        maxPrice: z.coerce.number().min(0).optional(),

        featured: z.enum(["true", "false"]).optional(),
        inStock: z.enum(["true", "false"]).optional(),

        sortBy: z
          .enum(["createdAt", "updatedAt", "name", "price", "sortOrder"])
          .default("createdAt"),

        sortOrder: z.enum(["asc", "desc"]).default("desc"),
      })
      .strict()
      .superRefine((query, ctx) => {
        if (
          query.minPrice !== undefined &&
          query.maxPrice !== undefined &&
          query.minPrice > query.maxPrice
        ) {
          ctx.addIssue({
            code: "custom",
            path: ["minPrice"],
            message: "minPrice cannot exceed maxPrice",
          });
        }
      }),
  })
  .strict();

export const updateProductStatusSchema = z
  .object({
    params: z
      .object({
        id: objectIdSchema,
      })
      .strict(),
    body: z
      .object({
        status: z.enum(PRODUCT_STATUSES),
      })
      .strict(),
  })
  .strict();

export type CreateProductBody = z.infer<typeof createProductSchema>["body"];

export type UpdateProductBody = z.infer<typeof updateProductSchema>["body"];

export type ListProductsQuery = z.infer<typeof listProductsSchema>["query"];
