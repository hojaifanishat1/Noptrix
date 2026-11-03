import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid MongoDB ID.");

export const inventoryIdParamsSchema = z.object({
  id: objectId,
});

export const inventoryProductParamsSchema = z.object({
  productId: objectId,
});

export const inventoryListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).optional(),
  warehouseId: objectId.optional(),
  productId: objectId.optional(),
  variantId: objectId.optional(),
  stockStatus: z.enum(["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"]).optional(),
  sortBy: z.enum(["quantity", "createdAt", "updatedAt"]).default("updatedAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const setLowStockThresholdSchema = z.object({
  lowStockThreshold: z.number().finite().min(0).max(1_000_000),
});

export const inventoryAdjustmentSchema = z.object({
  quantityChange: z
    .number()
    .finite()
    .int()
    .refine((n) => n !== 0, {
      message: "quantityChange must not be zero.",
    }),
  reason: z.string().trim().min(3).max(300),
  reference: z.string().trim().max(120).optional(),
});

export type InventoryListQuery = z.infer<typeof inventoryListQuerySchema>;
export type SetLowStockThresholdBody = z.infer<
  typeof setLowStockThresholdSchema
>;
export type InventoryAdjustmentBody = z.infer<typeof inventoryAdjustmentSchema>;
