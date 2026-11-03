import { describe, expect, it } from "vitest";

import {
  createPurchaseSchema,
  updatePurchaseSchema,
} from "../../src/modules/purchases/purchase.validator";

const purchase = {
  supplierId: "507f1f77bcf86cd799439011",
  warehouseId: "507f1f77bcf86cd799439012",
  items: [
    {
      productId: "507f1f77bcf86cd799439013",
      quantity: 2,
      unitCost: 15,
    },
  ],
};

describe("purchase item catalog validation", () => {
  it("accepts an existing catalog product", () => {
    expect(createPurchaseSchema.safeParse(purchase).success).toBe(true);
  });

  it("accepts a supplier item that will be added to the catalog later", () => {
    const result = createPurchaseSchema.safeParse({
      ...purchase,
      items: [
        {
          productName: "Supplier-only item",
          sku: "SUP-123",
          quantity: 2,
          unitCost: 15,
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("requires either a catalog product or a new product name", () => {
    const result = createPurchaseSchema.safeParse({
      ...purchase,
      items: [
        {
          quantity: 2,
          unitCost: 15,
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("rejects a line that supplies both catalog and supplier-only identities", () => {
    const result = updatePurchaseSchema.safeParse({
      items: [
        {
          productId: "507f1f77bcf86cd799439013",
          productName: "Supplier-only item",
          quantity: 2,
          unitCost: 15,
        },
      ],
    });

    expect(result.success).toBe(false);
  });
});
