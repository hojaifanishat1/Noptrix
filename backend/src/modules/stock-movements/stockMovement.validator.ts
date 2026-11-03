import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid ObjectId.");

const quantity = z
  .number()
  .int("Quantity must be an integer.")
  .safe("Quantity must be a safe integer.")
  .refine((value) => value !== 0, "Quantity cannot be zero.");

export const createStockMovementSchema = z
  .object({
    productId: objectId,
    variantId: objectId.optional(),
    warehouseId: objectId,
    destinationWarehouseId: objectId.optional(),
    type: z.enum(["IN", "OUT", "ADJUSTMENT", "TRANSFER"]),
    quantity,
    reason: z.string().trim().min(3).max(500),
    reference: z.string().trim().max(120).optional(),
    referenceType: z.string().trim().min(1).max(60).optional(),
    referenceId: objectId.optional(),
    idempotencyKey: z.string().trim().min(8).max(128).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.type !== "ADJUSTMENT" && value.quantity < 0) {
      ctx.addIssue({
        code: "custom",
        path: ["quantity"],
        message: "Quantity must be positive for this movement type.",
      });
    }

    if (value.type === "TRANSFER") {
      if (!value.destinationWarehouseId) {
        ctx.addIssue({
          code: "custom",
          path: ["destinationWarehouseId"],
          message: "Destination warehouse is required for a transfer.",
        });
      } else if (value.destinationWarehouseId === value.warehouseId) {
        ctx.addIssue({
          code: "custom",
          path: ["destinationWarehouseId"],
          message: "Source and destination warehouses must be different.",
        });
      }
    } else if (value.destinationWarehouseId) {
      ctx.addIssue({
        code: "custom",
        path: ["destinationWarehouseId"],
        message: "Destination warehouse is only allowed for TRANSFER.",
      });
    }
  });

export const stockMovementQuerySchema = z.object({
  productId: objectId.optional(),
  variantId: objectId.optional(),
  warehouseId: objectId.optional(),
  destinationWarehouseId: objectId.optional(),
  type: z.enum(["IN", "OUT", "ADJUSTMENT", "TRANSFER"]).optional(),
  referenceType: z.string().trim().min(1).max(60).optional(),
  referenceId: objectId.optional(),
  fromDate: z.string().datetime({ offset: true }).optional(),
  toDate: z.string().datetime({ offset: true }).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const stockMovementParamsSchema = z.object({
  id: objectId,
});
