import { describe, expect, it } from "vitest";

import {
  createStockMovementSchema,
  stockMovementQuerySchema,
} from "../../src/modules/stock-movements/stockMovement.validator";

const productId = "507f1f77bcf86cd799439011";
const variantId = "507f1f77bcf86cd799439012";
const warehouseId = "507f1f77bcf86cd799439013";

describe("stock movement product variant validation", () => {
  it("accepts a variant when creating a stock movement", () => {
    const result = createStockMovementSchema.safeParse({
      productId,
      variantId,
      warehouseId,
      type: "IN",
      quantity: 3,
      reason: "Received variant stock",
    });

    expect(result.success).toBe(true);
  });

  it("accepts a variant filter when listing stock movements", () => {
    const result = stockMovementQuerySchema.safeParse({ variantId });

    expect(result.success).toBe(true);
  });

  it("rejects malformed variant IDs", () => {
    const result = stockMovementQuerySchema.safeParse({
      variantId: "not-an-object-id",
    });

    expect(result.success).toBe(false);
  });
});
