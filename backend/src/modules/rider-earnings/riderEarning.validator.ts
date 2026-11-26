import { z } from "zod";

/*
|--------------------------------------------------------------------------
| Constants
|--------------------------------------------------------------------------
*/

const riderEarningStatuses = [
  "PENDING",
  "APPROVED",
  "PAID",
  "CANCELLED",
] as const;

const riderEarningTypes = [
  "DELIVERY",
  "BONUS",
  "INCENTIVE",
  "ADJUSTMENT",
  "PENALTY",
] as const;

/*
|--------------------------------------------------------------------------
| Common Schemas
|--------------------------------------------------------------------------
*/

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-f\d]{24}$/i, "Invalid ObjectId.");

const currencySchema = z
  .string()
  .trim()
  .toUpperCase()
  .length(3, "Currency must be exactly 3 characters.");

/*
|--------------------------------------------------------------------------
| Create
|--------------------------------------------------------------------------
*/

export const createRiderEarningSchema = z.object({
  riderId: objectIdSchema,

  orderId: objectIdSchema.optional(),

  type: z.enum(riderEarningTypes),

  amount: z.number().nonnegative(),

  currency: currencySchema.default("BDT"),

  description: z.string().trim().max(500).optional(),

  earningDate: z.coerce.date().optional(),

  notes: z.string().trim().max(2000).optional(),
});

/*
|--------------------------------------------------------------------------
| Update
|--------------------------------------------------------------------------
*/

export const updateRiderEarningSchema = z
  .object({
    type: z.enum(riderEarningTypes).optional(),

    amount: z.number().nonnegative().optional(),

    currency: currencySchema.optional(),

    description: z.string().trim().max(500).optional(),

    earningDate: z.coerce.date().optional(),

    notes: z.string().trim().max(2000).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required.",
  });

/*
|--------------------------------------------------------------------------
| Status
|--------------------------------------------------------------------------
*/

export const updateRiderEarningStatusSchema = z.object({
  status: z.enum(riderEarningStatuses),

  reason: z.string().trim().max(1000).optional(),

  notes: z.string().trim().max(2000).optional(),
});

/*
|--------------------------------------------------------------------------
| ID Params
|--------------------------------------------------------------------------
*/

export const riderEarningIdParamSchema = z.object({
  earningId: objectIdSchema,
});

/*
|--------------------------------------------------------------------------
| Rider Params
|--------------------------------------------------------------------------
*/

export const riderEarningRiderIdParamSchema = z.object({
  riderId: objectIdSchema,
});

/*
|--------------------------------------------------------------------------
| Query
|--------------------------------------------------------------------------
*/

export const riderEarningQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),

  limit: z.coerce.number().int().min(1).max(100).default(20),

  status: z.enum(riderEarningStatuses).optional(),

  type: z.enum(riderEarningTypes).optional(),

  riderId: objectIdSchema.optional(),

  orderId: objectIdSchema.optional(),

  currency: currencySchema.optional(),

  from: z.coerce.date().optional(),

  to: z.coerce.date().optional(),
});

/*
|--------------------------------------------------------------------------
| Inferred Types
|--------------------------------------------------------------------------
*/

export type CreateRiderEarningInput = z.infer<typeof createRiderEarningSchema>;

export type UpdateRiderEarningInput = z.infer<typeof updateRiderEarningSchema>;

export type UpdateRiderEarningStatusInput = z.infer<
  typeof updateRiderEarningStatusSchema
>;

export type RiderEarningIdParam = z.infer<typeof riderEarningIdParamSchema>;

export type RiderEarningRiderIdParam = z.infer<
  typeof riderEarningRiderIdParamSchema
>;

export type RiderEarningQueryInput = z.infer<typeof riderEarningQuerySchema>;
