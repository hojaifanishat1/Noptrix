import { z } from "zod";

/*
|--------------------------------------------------------------------------
| Reusable Schemas
|--------------------------------------------------------------------------
*/

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Invalid ObjectId.");

const sellerTypes = ["INDIVIDUAL", "BUSINESS"] as const;

const sellerApplicationStatuses = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
  "WITHDRAWN",
] as const;

/*
|--------------------------------------------------------------------------
| Create Seller Application
|--------------------------------------------------------------------------
*/

const sellerApplicationDocumentSchema = z.object({
  key: z.string().trim().min(2).max(60),
  fileName: z.string().trim().min(1).max(255),
  fileUrl: z.string().trim().url().max(2000),
  mimeType: z.string().trim().min(1).max(150),
  sizeBytes: z.number().int().min(1),
});

export const createSellerApplicationSchema = z.object({
  opportunityId: objectIdSchema.optional(),

  formResponses: z.record(z.string(), z.unknown()).optional(),

  documents: z.array(sellerApplicationDocumentSchema).max(30).optional(),

  businessName: z.string().trim().min(2).max(200),

  legalName: z.string().trim().max(200).optional(),

  type: z.enum(sellerTypes).default("BUSINESS"),

  email: z.string().trim().email().max(254),

  phone: z.string().trim().max(30).optional(),

  taxNumber: z.string().trim().max(100).optional(),

  registrationNumber: z.string().trim().max(100).optional(),

  description: z.string().trim().max(5000).optional(),

  logoUrl: z.string().trim().url().max(2000).optional(),

  website: z.string().trim().url().max(500).optional(),

  address: z.string().trim().max(500).optional(),

  city: z.string().trim().max(100).optional(),

  country: z.string().trim().max(100).optional(),
});

/*
|--------------------------------------------------------------------------
| Update Seller Application
|--------------------------------------------------------------------------
*/

export const updateSellerApplicationSchema = z
  .object({
    businessName: z.string().trim().min(2).max(200).optional(),

    legalName: z.string().trim().max(200).optional(),

    type: z.enum(sellerTypes).optional(),

    email: z.string().trim().email().max(254).optional(),

    phone: z.string().trim().max(30).optional(),

    taxNumber: z.string().trim().max(100).optional(),

    registrationNumber: z.string().trim().max(100).optional(),

    description: z.string().trim().max(5000).optional(),

    logoUrl: z.string().trim().url().max(2000).optional(),

    website: z.string().trim().url().max(500).optional(),

    address: z.string().trim().max(500).optional(),

    city: z.string().trim().max(100).optional(),

    country: z.string().trim().max(100).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required.",
  });

/*
|--------------------------------------------------------------------------
| Application ID
|--------------------------------------------------------------------------
*/

export const sellerApplicationIdParamSchema = z.object({
  applicationId: objectIdSchema,
});

/*
|--------------------------------------------------------------------------
| Status Update
|--------------------------------------------------------------------------
*/

export const updateSellerApplicationStatusSchema = z.object({
  status: z.enum(sellerApplicationStatuses),

  rejectionReason: z.string().trim().max(2000).optional(),

  notes: z.string().trim().max(5000).optional(),
});

/*
|--------------------------------------------------------------------------
| Query
|--------------------------------------------------------------------------
*/

export const sellerApplicationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),

  limit: z.coerce.number().int().min(1).max(100).default(20),

  status: z.enum(sellerApplicationStatuses).optional(),

  type: z.enum(sellerTypes).optional(),

  applicantId: objectIdSchema.optional(),

  opportunityId: objectIdSchema.optional(),

  search: z.string().trim().max(100).optional(),
});

/*
|--------------------------------------------------------------------------
| Inferred Types
|--------------------------------------------------------------------------
*/

export type CreateSellerApplicationInput = z.infer<
  typeof createSellerApplicationSchema
>;

export type UpdateSellerApplicationInput = z.infer<
  typeof updateSellerApplicationSchema
>;

export type SellerApplicationIdParam = z.infer<
  typeof sellerApplicationIdParamSchema
>;

export type UpdateSellerApplicationStatusInput = z.infer<
  typeof updateSellerApplicationStatusSchema
>;

export type SellerApplicationQueryInput = z.infer<
  typeof sellerApplicationQuerySchema
>;
