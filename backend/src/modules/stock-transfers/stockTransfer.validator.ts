import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid ObjectId.");

const positiveQuantity = z
  .number()
  .int("Quantity must be an integer.")
  .positive("Quantity must be greater than zero.")
  .safe("Quantity must be a safe integer.");

export const createStockTransferSchema = z
  .object({
    productId: objectId,
    variantId: objectId.optional(),

    sourceWarehouseId: objectId,

    destinationWarehouseId: objectId,

    quantity: positiveQuantity,

    reason: z
      .string()
      .trim()
      .min(3, "Reason must contain at least 3 characters.")
      .max(500, "Reason cannot exceed 500 characters."),

    referenceType: z.string().trim().min(1).max(60).optional(),

    referenceId: objectId.optional(),

    idempotencyKey: z.string().trim().min(8).max(128).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.sourceWarehouseId.toLowerCase() ===
      value.destinationWarehouseId.toLowerCase()
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["destinationWarehouseId"],
        message: "Source and destination warehouses must be different.",
      });
    }
  });

export const stockTransferQuerySchema = z
  .object({
    productId: objectId.optional(),

    sourceWarehouseId: objectId.optional(),

    destinationWarehouseId: objectId.optional(),

    status: z
      .enum([
        "DRAFT",
        "APPROVED",
        "DISPATCHED",
        "RECEIVED",
        "CANCELLED",
        "REJECTED",
      ])
      .optional(),

    referenceType: z.string().trim().min(1).max(60).optional(),

    referenceId: objectId.optional(),

    fromDate: z.string().datetime({ offset: true }).optional(),

    toDate: z.string().datetime({ offset: true }).optional(),

    page: z.coerce.number().int().min(1).default(1),

    limit: z.coerce.number().int().min(1).max(100).default(20),

    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.fromDate &&
      value.toDate &&
      new Date(value.fromDate) > new Date(value.toDate)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["toDate"],
        message: "toDate must be on or after fromDate.",
      });
    }
  });

export const stockTransferParamsSchema = z.object({
  id: objectId,
});

export const stockTransferActionSchema = z
  .object({
    note: z.string().trim().max(500).optional(),
  })
  .strict();

export const stockTransferIdSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid transfer ID."),
});
