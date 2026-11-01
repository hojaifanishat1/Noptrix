import { describe, expect, it } from "vitest";

import {
  createProductSchema,
  updateProductSchema,
} from "../../src/modules/products/product.validator";

const productBody = {
  name: "Test product",
  categoryId: "507f1f77bcf86cd799439011",
  price: 100,
};

describe("create product inventory validation", () => {
  it("requires a warehouse for inventory-tracked products", () => {
    const result = createProductSchema.shape.body.safeParse(productBody);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({
          path: ["inventoryWarehouseId"],
        }),
      );
    }
  });

  it("accepts a selected warehouse for inventory-tracked products", () => {
    const result = createProductSchema.shape.body.safeParse({
      ...productBody,
      inventoryWarehouseId: "507f1f77bcf86cd799439012",
    });

    expect(result.success).toBe(true);
  });

  it("allows products with inventory tracking disabled without a warehouse", () => {
    const result = createProductSchema.shape.body.safeParse({
      ...productBody,
      trackInventory: false,
    });

    expect(result.success).toBe(true);
  });

  it("accepts managed tag IDs and rejects malformed IDs", () => {
    const valid = createProductSchema.shape.body.safeParse({
      ...productBody,
      trackInventory: false,
      tagIds: ["507f1f77bcf86cd799439012"],
    });
    const invalid = createProductSchema.shape.body.safeParse({
      ...productBody,
      trackInventory: false,
      tagIds: ["not-an-object-id"],
    });

    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
  });

  it("accepts a sale price lower than regular price", () => {
    const result = createProductSchema.shape.body.safeParse({
      ...productBody,
      trackInventory: false,
      salePrice: 75,
      saleStartsAt: new Date(Date.now() + 60_000).toISOString(),
      saleEndsAt: new Date(Date.now() + 3_600_000).toISOString(),
    });

    expect(result.success).toBe(true);
  });

  it("rejects sale prices that are not below regular price", () => {
    const result = createProductSchema.shape.body.safeParse({
      ...productBody,
      trackInventory: false,
      salePrice: 100,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({ path: ["salePrice"] }),
      );
    }
  });

  it("accepts future publication dates and storefront visibility", () => {
    const result = createProductSchema.shape.body.safeParse({
      ...productBody,
      trackInventory: false,
      visibility: "HIDDEN",
      publishAt: new Date(Date.now() + 60_000).toISOString(),
    });

    expect(result.success).toBe(true);
  });

  it("rejects publication schedules in the past", () => {
    const result = createProductSchema.shape.body.safeParse({
      ...productBody,
      trackInventory: false,
      publishAt: new Date(Date.now() - 60_000).toISOString(),
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({ path: ["publishAt"] }),
      );
    }
  });

  it("rejects invalid publication schedules on product updates", () => {
    const result = updateProductSchema.shape.body.safeParse({
      publishAt: new Date(Date.now() - 60_000).toISOString(),
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({ path: ["publishAt"] }),
      );
    }
  });
});
