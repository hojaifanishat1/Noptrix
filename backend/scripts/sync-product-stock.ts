import "dotenv/config";

import { Types } from "mongoose";

import { connectDatabase, disconnectDatabase } from "../src/config/database";
import { InventoryModel } from "../src/modules/inventory/inventory.model";
import ProductModel from "../src/modules/products/product.model";
import ProductVariantModel from "../src/modules/product-variants/variant.model";

interface ProductInventoryTotal {
  _id: Types.ObjectId;
  total: number;
}

interface VariantInventoryTotal {
  _id: Types.ObjectId;
  total: number;
}

async function syncProductStock(): Promise<void> {
  await connectDatabase();

  const totals = await InventoryModel.aggregate<ProductInventoryTotal>([
    {
      $group: {
        _id: "$productId",
        total: { $sum: "$quantity" },
      },
    },
  ]).exec();

  const invalidTotal = totals.find(
    ({ total }) => !Number.isSafeInteger(total) || total < 0,
  );
  if (invalidTotal) {
    throw new Error(
      `Invalid inventory total for product ${invalidTotal._id.toHexString()}.`,
    );
  }

  const variantTotals = await InventoryModel.aggregate<VariantInventoryTotal>([
    { $match: { variantId: { $exists: true } } },
    {
      $group: {
        _id: "$variantId",
        total: { $sum: "$quantity" },
      },
    },
  ]).exec();

  const invalidVariantTotal = variantTotals.find(
    ({ total }) => !Number.isSafeInteger(total) || total < 0,
  );
  if (invalidVariantTotal) {
    throw new Error(
      `Invalid inventory total for variant ${invalidVariantTotal._id.toHexString()}.`,
    );
  }

  let updatedProducts = 0;
  let updatedVariants = 0;

  for (let index = 0; index < totals.length; index += 500) {
    const batch = totals.slice(index, index + 500);
    const result = await ProductModel.bulkWrite(
      batch.map(({ _id, total }) => ({
        updateOne: {
          filter: { _id },
          update: { $set: { stockQuantity: total } },
        },
      })),
    );

    updatedProducts += result.matchedCount;
  }

  await ProductModel.updateMany(
    { _id: { $nin: totals.map(({ _id }) => _id) } },
    { $set: { stockQuantity: 0 } },
  );

  for (let index = 0; index < variantTotals.length; index += 500) {
    const batch = variantTotals.slice(index, index + 500);
    const result = await ProductVariantModel.bulkWrite(
      batch.map(({ _id, total }) => ({
        updateOne: {
          filter: { _id },
          update: { $set: { stockQuantity: total } },
        },
      })),
    );

    updatedVariants += result.matchedCount;
  }

  await ProductVariantModel.updateMany(
    { _id: { $nin: variantTotals.map(({ _id }) => _id) } },
    { $set: { stockQuantity: 0 } },
  );

  console.log(
    `Synchronized warehouse stock for ${updatedProducts} products and ${updatedVariants} variants.`,
  );
}

syncProductStock()
  .catch((error: unknown) => {
    console.error("Product stock synchronization failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });
