import { describe, expect, it } from "vitest";

import {
  variantCreateSchema,
  variantUpdateSchema,
} from "../../src/modules/product-variants/variant.validator";

const params = {
  productId: "507f1f77bcf86cd799439011",
  id: "507f1f77bcf86cd799439012",
};

const variant = {
  title: "Black / Large",
  options: { Color: "Black", Size: "Large" },
};

describe("variant inventory validation", () => {
  it("does not allow stock quantity when creating a variant", () => {
    const result = variantCreateSchema.safeParse({
      params: { productId: params.productId },
      body: { ...variant, stockQuantity: 100 },
    });

    expect(result.success).toBe(false);
  });

  it("does not allow stock quantity when updating a variant", () => {
    const result = variantUpdateSchema.safeParse({
      params,
      body: { stockQuantity: 100 },
    });

    expect(result.success).toBe(false);
  });

  it("accepts variant details without a stock quantity", () => {
    const result = variantCreateSchema.safeParse({
      params: { productId: params.productId },
      body: variant,
    });

    expect(result.success).toBe(true);
  });
});
