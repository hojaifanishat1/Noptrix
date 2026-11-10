import { z } from "zod";

/*
|--------------------------------------------------------------------------
| Reusable Schemas
|--------------------------------------------------------------------------
*/

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Invalid ObjectId.");

const riderTypes = ["INTERNAL", "CONTRACT", "FREELANCE"] as const;

const riderStatuses = [
  "PENDING",
  "ACTIVE",
  "INACTIVE",
  "SUSPENDED",
  "BLOCKED",
  "TERMINATED",
] as const;

const riderVehicleTypes = [
  "MOTORCYCLE",
  "CAR",
  "BICYCLE",
  "VAN",
  "OTHER",
] as const;

/*
|--------------------------------------------------------------------------
| Create Rider
|--------------------------------------------------------------------------
*/

export const createRiderSchema = z.object({
  userId: objectIdSchema,

  riderCode: z
    .string()
    .trim()
    .min(3)
    .max(50)
    .regex(
      /^[A-Za-z0-9_-]+$/,
      "Rider code may contain only letters, numbers, underscores, and hyphens.",
    ),

  type: z.enum(riderTypes).default("INTERNAL"),

  name: z.string().trim().min(2).max(150),

  email: z.string().trim().email().max(254),

  phone: z.string().trim().max(30).optional(),

  vehicleType: z.enum(riderVehicleTypes).optional(),

  vehicleNumber: z.string().trim().max(50).optional(),

  licenseNumber: z.string().trim().max(100).optional(),

  nationalId: z.string().trim().max(100).optional(),

  joinedAt: z.coerce.date().optional(),

  notes: z.string().trim().max(5000).optional(),
});

/*
|--------------------------------------------------------------------------
| Update Rider
|--------------------------------------------------------------------------
*/

export const updateRiderSchema = z
  .object({
    riderCode: z
      .string()
      .trim()
      .min(3)
      .max(50)
      .regex(/^[A-Za-z0-9_-]+$/, "Invalid rider code.")
      .optional(),

    type: z.enum(riderTypes).optional(),

    name: z.string().trim().min(2).max(150).optional(),

    email: z.string().trim().email().max(254).optional(),

    phone: z.string().trim().max(30).optional(),

    vehicleType: z.enum(riderVehicleTypes).optional(),

    vehicleNumber: z.string().trim().max(50).optional(),

    licenseNumber: z.string().trim().max(100).optional(),

    nationalId: z.string().trim().max(100).optional(),

    joinedAt: z.coerce.date().optional(),

    notes: z.string().trim().max(5000).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required.",
  });

/*
|--------------------------------------------------------------------------
| Rider Status Update
|--------------------------------------------------------------------------
*/

export const updateRiderStatusSchema = z.object({
  status: z.enum(riderStatuses),

  reason: z.string().trim().max(2000).optional(),
});

/*
|--------------------------------------------------------------------------
| Rider ID
|--------------------------------------------------------------------------
*/

export const riderIdParamSchema = z.object({
  riderId: objectIdSchema,
});

/*
|--------------------------------------------------------------------------
| Rider Query
|--------------------------------------------------------------------------
*/

export const riderQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),

  limit: z.coerce.number().int().min(1).max(100).default(20),

  status: z.enum(riderStatuses).optional(),

  type: z.enum(riderTypes).optional(),

  vehicleType: z.enum(riderVehicleTypes).optional(),

  userId: objectIdSchema.optional(),

  search: z.string().trim().max(100).optional(),
});

/*
|--------------------------------------------------------------------------
| Inferred Types
|--------------------------------------------------------------------------
*/

export type CreateRiderInput = z.infer<typeof createRiderSchema>;

export type UpdateRiderInput = z.infer<typeof updateRiderSchema>;

export type UpdateRiderStatusInput = z.infer<typeof updateRiderStatusSchema>;

export type RiderIdParam = z.infer<typeof riderIdParamSchema>;

export type RiderQueryInput = z.infer<typeof riderQuerySchema>;
