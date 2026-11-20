import { z } from "zod";

import {
  SELLER_OPPORTUNITY_FIELD_TYPES,
  SELLER_OPPORTUNITY_STATUSES,
  SELLER_OPPORTUNITY_VISIBILITIES,
} from "./seller-opportunity.model";

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Invalid ObjectId.");

const formFieldSchema = z.object({
  key: z.string().trim().min(2).max(60).regex(/^[a-zA-Z][a-zA-Z0-9_]*$/),
  label: z.string().trim().min(2).max(150),
  type: z.enum(SELLER_OPPORTUNITY_FIELD_TYPES),
  required: z.boolean().default(false),
  placeholder: z.string().trim().max(200).optional(),
  options: z.array(z.string().trim().min(1).max(150)).max(50).optional(),
  maxLength: z.number().int().min(1).max(10000).optional(),
});

const documentRequirementSchema = z.object({
  key: z.string().trim().min(2).max(60).regex(/^[a-zA-Z][a-zA-Z0-9_]*$/),
  label: z.string().trim().min(2).max(150),
  required: z.boolean().default(true),
  acceptedMimeTypes: z.array(z.string().trim().min(1).max(150)).max(30).default([]),
  maxSizeMB: z.number().min(1).max(100).default(10),
});

const opportunityBaseSchema = z.object({
  title: z.string().trim().min(3).max(200),
  slug: z.string().trim().min(3).max(220).optional(),
  summary: z.string().trim().min(10).max(500),
  description: z.string().trim().min(20).max(15000),
  category: z.string().trim().min(2).max(100),
  targetSellerCount: z.number().int().min(1).max(100000),
  eligibility: z.array(z.string().trim().min(2).max(1000)).max(50).default([]),
  requiredDocuments: z.array(documentRequirementSchema).max(30).default([]),
  applicationForm: z.array(formFieldSchema).max(100).default([]),
  applicationDeadline: z.coerce.date().optional(),
  visibility: z.enum([SELLER_OPPORTUNITY_VISIBILITIES.PUBLIC, SELLER_OPPORTUNITY_VISIBILITIES.PRIVATE]).default("PUBLIC"),
});

export const createSellerOpportunitySchema = opportunityBaseSchema;

export const updateSellerOpportunitySchema = opportunityBaseSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required for update.",
  });

export const sellerOpportunityIdParamSchema = z.object({
  opportunityId: objectIdSchema,
});

export const sellerOpportunitySlugParamSchema = z.object({
  slug: z.string().trim().min(2).max(220),
});

export const updateSellerOpportunityStatusSchema = z.object({
  status: z.enum([SELLER_OPPORTUNITY_STATUSES.DRAFT, SELLER_OPPORTUNITY_STATUSES.PUBLISHED, SELLER_OPPORTUNITY_STATUSES.PAUSED, SELLER_OPPORTUNITY_STATUSES.CLOSED]),
});

export const sellerOpportunityQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum([SELLER_OPPORTUNITY_STATUSES.DRAFT, SELLER_OPPORTUNITY_STATUSES.PUBLISHED, SELLER_OPPORTUNITY_STATUSES.PAUSED, SELLER_OPPORTUNITY_STATUSES.CLOSED]).optional(),
  visibility: z.enum([SELLER_OPPORTUNITY_VISIBILITIES.PUBLIC, SELLER_OPPORTUNITY_VISIBILITIES.PRIVATE]).optional(),
  category: z.string().trim().max(100).optional(),
  search: z.string().trim().max(200).optional(),
});

export type CreateSellerOpportunityInput = z.infer<typeof createSellerOpportunitySchema>;
export type UpdateSellerOpportunityInput = z.infer<typeof updateSellerOpportunitySchema>;
export type SellerOpportunityQueryInput = z.infer<typeof sellerOpportunityQuerySchema>;
export type UpdateSellerOpportunityStatusInput = z.infer<typeof updateSellerOpportunityStatusSchema>;
