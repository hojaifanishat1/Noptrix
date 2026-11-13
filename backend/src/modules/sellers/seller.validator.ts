import { z } from "zod";

/*
|--------------------------------------------------------------------------
| Constants
|--------------------------------------------------------------------------
*/

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Invalid ObjectId.");

const sellerTypes = ["INDIVIDUAL", "BUSINESS"] as const;

const sellerStatuses = [
  "PENDING",
  "ACTIVE",
  "INACTIVE",
  "SUSPENDED",
  "REJECTED",
] as const;

/*
|--------------------------------------------------------------------------
| Common Fields
|--------------------------------------------------------------------------
*/

const sellerTypeSchema = z.enum(sellerTypes);

const businessNameSchema = z.string().trim().min(2).max(200);

const emailSchema = z.string().trim().email().max(254);

const phoneSchema = z.string().trim().max(30);

const urlSchema = z.string().trim().url().max(2000);

/*
|--------------------------------------------------------------------------
| Create Seller
|--------------------------------------------------------------------------
*/

export const createSellerSchema = z.object({
  password: z.string().min(8).max(128),

  sellerCode: z
    .string()
    .trim()
    .min(3)
    .max(50)
    .regex(
      /^[A-Za-z0-9_-]+$/,
      "Seller code can contain only letters, numbers, underscores, and hyphens.",
    ),

  type: sellerTypeSchema.default("BUSINESS"),

  businessName: businessNameSchema,

  legalName: z.string().trim().max(200).optional(),

  email: emailSchema,

  phone: phoneSchema.optional(),

  taxNumber: z.string().trim().max(100).optional(),

  registrationNumber: z.string().trim().max(100).optional(),

  description: z.string().trim().max(5000).optional(),

  logoUrl: urlSchema.optional(),

  website: z.string().trim().url().max(500).optional(),

  notes: z.string().trim().max(5000).optional(),
});

/*
|--------------------------------------------------------------------------
| Update Seller
|--------------------------------------------------------------------------
*/

export const updateSellerSchema = z
  .object({
    sellerCode: z
      .string()
      .trim()
      .min(3)
      .max(50)
      .regex(
        /^[A-Za-z0-9_-]+$/,
        "Seller code can contain only letters, numbers, underscores, and hyphens.",
      )
      .optional(),

    type: sellerTypeSchema.optional(),

    businessName: businessNameSchema.optional(),

    legalName: z.string().trim().max(200).optional(),

    email: emailSchema.optional(),

    phone: phoneSchema.optional(),

    taxNumber: z.string().trim().max(100).optional(),

    registrationNumber: z.string().trim().max(100).optional(),

    description: z.string().trim().max(5000).optional(),

    logoUrl: urlSchema.optional(),

    website: z.string().trim().url().max(500).optional(),

    notes: z.string().trim().max(5000).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required.",
  });

/*
|--------------------------------------------------------------------------
| Seller Status
|--------------------------------------------------------------------------
*/

export const updateSellerStatusSchema = z.object({
  status: z.enum(sellerStatuses),

  reason: z.string().trim().max(2000).optional(),
});

/*
|--------------------------------------------------------------------------
| Seller ID
|--------------------------------------------------------------------------
*/

export const sellerIdParamSchema = z.object({
  sellerId: objectIdSchema,
});

/*
|--------------------------------------------------------------------------
| Seller Query
|--------------------------------------------------------------------------
*/

export const sellerQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),

  limit: z.coerce.number().int().min(1).max(100).default(20),

  status: z.enum(sellerStatuses).optional(),

  type: sellerTypeSchema.optional(),

  search: z.string().trim().max(100).optional(),
});

/*
|--------------------------------------------------------------------------
| Inferred Types
|--------------------------------------------------------------------------
*/

export type CreateSellerInput = z.infer<typeof createSellerSchema>;

export type UpdateSellerInput = z.infer<typeof updateSellerSchema>;

export type UpdateSellerStatusInput = z.infer<typeof updateSellerStatusSchema>;

export type SellerIdParam = z.infer<typeof sellerIdParamSchema>;

export type SellerQueryInput = z.infer<typeof sellerQuerySchema>;
