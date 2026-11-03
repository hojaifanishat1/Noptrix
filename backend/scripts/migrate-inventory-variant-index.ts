import "dotenv/config";

import { connectDatabase, disconnectDatabase } from "../src/config/database";
import { InventoryModel } from "../src/modules/inventory/inventory.model";

async function migrateInventoryVariantIndex(): Promise<void> {
  await connectDatabase();

  const collection = InventoryModel.collection;
  const indexes = await collection.indexes();
  const oldIndex = indexes.find(
    (index) =>
      index.unique === true &&
      "productId" in index.key &&
      "warehouseId" in index.key &&
      !("variantId" in index.key),
  );
  const newIndex = indexes.find(
    (index) => index.name === "uniq_inventory_product_variant_warehouse",
  );

  if (!newIndex) {
    await collection.createIndex(
      { productId: 1, variantId: 1, warehouseId: 1 },
      {
        unique: true,
        name: "uniq_inventory_product_variant_warehouse",
      },
    );
  }

  if (oldIndex) {
    await collection.dropIndex(oldIndex.name!);
  }

  console.log("Inventory product/variant/warehouse index is ready.");
}

migrateInventoryVariantIndex()
  .catch((error: unknown) => {
    console.error("Inventory variant index migration failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });
