import mongoose, { Types } from "mongoose";
import { ApiError } from "../../utils/ApiError";
import ProductModel from "../products/product.model";
import ProductVariantModel from "../product-variants/variant.model";
import InventoryModel from "./inventory.model";
import WarehouseModel from "../warehouses/warehouse.model";
import { PurchaseModel } from "../purchases/purchase.model";
import { PurchaseReturnModel } from "../purchase-returns/purchaseReturn.model";
import type { InventoryListFilters, InventoryStatus } from "./inventory.types";

function assertObjectId(id: string): void {
  if (!Types.ObjectId.isValid(id)) {
    throw ApiError.badRequest("Invalid MongoDB ID.");
  }
}

function statusFor(
  quantity: number,
  reservedQuantity: number,
  threshold: number,
): InventoryStatus {
  const available = quantity - reservedQuantity;
  if (available <= 0) return "OUT_OF_STOCK";
  if (available <= threshold) return "LOW_STOCK";
  return "IN_STOCK";
}

export async function listInventory(filters: InventoryListFilters) {
  const {
    page,
    limit,
    search,
    warehouseId,
    productId,
    variantId,
    stockStatus,
    sortBy,
    sortOrder,
  } = filters;

  if (warehouseId) assertObjectId(warehouseId);
  if (productId) assertObjectId(productId);
  if (variantId) assertObjectId(variantId);

  const query: Record<string, unknown> = {};

  if (warehouseId) query.warehouseId = new Types.ObjectId(warehouseId);
  if (productId) query.productId = new Types.ObjectId(productId);
  if (variantId) query.variantId = new Types.ObjectId(variantId);

  if (search?.trim()) {
    const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const products = await mongoose
      .model("Product")
      .find({ name: { $regex: escaped, $options: "i" } })
      .select("_id")
      .limit(100)
      .lean()
      .exec();

    query.productId = {
      $in: products.map((product: { _id: Types.ObjectId }) => product._id),
    };
  }

  if (stockStatus) {
    if (stockStatus === "OUT_OF_STOCK") {
      query.$expr = {
        $lte: [{ $subtract: ["$quantity", "$reservedQuantity"] }, 0],
      };
    } else if (stockStatus === "LOW_STOCK") {
      query.$expr = {
        $and: [
          { $gt: [{ $subtract: ["$quantity", "$reservedQuantity"] }, 0] },
          {
            $lte: [
              { $subtract: ["$quantity", "$reservedQuantity"] },
              "$lowStockThreshold",
            ],
          },
        ],
      };
    } else {
      query.$expr = {
        $gt: [
          { $subtract: ["$quantity", "$reservedQuantity"] },
          "$lowStockThreshold",
        ],
      };
    }
  }

  const direction = sortOrder === "asc" ? 1 : -1;
  const sort: Record<string, 1 | -1> = {
    [sortBy]: direction,
    _id: 1,
  };

  const [items, total] = await Promise.all([
    InventoryModel.find(query)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("productId")
      .populate("variantId")
      .populate("warehouseId")
      .lean()
      .exec(),
    InventoryModel.countDocuments(query).exec(),
  ]);

  return {
    items: items.map((item) => ({
      ...item,
      availableQuantity: item.quantity - item.reservedQuantity,
      stockStatus: statusFor(
        item.quantity,
        item.reservedQuantity,
        item.lowStockThreshold,
      ),
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPreviousPage: page > 1,
    },
  };
}

export async function getInventoryReferences(id: string) {
  assertObjectId(id);

  const item = await InventoryModel.findById(id)
    .select("productId variantId warehouseId")
    .lean()
    .exec();

  if (!item) throw ApiError.notFound("Inventory record not found.");

  return {
    productId: item.productId.toString(),
    ...(item.variantId ? { variantId: item.variantId.toString() } : {}),
    warehouseId: item.warehouseId.toString(),
  };
}

export async function getInventory(id: string) {
  assertObjectId(id);

  const item = await InventoryModel.findById(id)
    .populate("productId")
    .populate("variantId")
    .populate("warehouseId")
    .exec();

  if (!item) throw ApiError.notFound("Inventory record not found.");

  return {
    ...item.toObject(),
    availableQuantity: item.quantity - item.reservedQuantity,
    stockStatus: statusFor(
      item.quantity,
      item.reservedQuantity,
      item.lowStockThreshold,
    ),
  };
}

export async function getProductStockCapacity(
  productId: string | Types.ObjectId,
  session?: mongoose.ClientSession,
) {
  assertObjectId(String(productId));
  const productObjectId = new Types.ObjectId(productId);

  const purchaseAggregate = PurchaseModel.aggregate<{ total: number }>([
    { $unwind: "$items" },
    { $match: { "items.productId": productObjectId } },
    {
      $group: {
        _id: null,
        total: { $sum: "$items.receivedQuantity" },
      },
    },
  ]);
  const returnAggregate = PurchaseReturnModel.aggregate<{ total: number }>([
    { $match: { status: "COMPLETED" } },
    { $unwind: "$items" },
    {
      $match: {
        "items.productId": productObjectId,
        "items.restock": true,
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$items.quantity" },
      },
    },
  ]);
  const inventoryAggregate = InventoryModel.aggregate<{ total: number }>([
    { $match: { productId: productObjectId } },
    {
      $group: {
        _id: null,
        total: { $sum: "$quantity" },
      },
    },
  ]);

  if (session) {
    purchaseAggregate.session(session);
    returnAggregate.session(session);
    inventoryAggregate.session(session);
  }

  const purchaseTotals = await purchaseAggregate.exec();
  const returnTotals = await returnAggregate.exec();
  const inventoryTotals = await inventoryAggregate.exec();

  const receivedQuantity = purchaseTotals[0]?.total ?? 0;
  const returnedQuantity = returnTotals[0]?.total ?? 0;
  const allocatedQuantity = inventoryTotals[0]?.total ?? 0;
  const totalStockLimit = Math.max(0, receivedQuantity - returnedQuantity);

  if (
    !Number.isSafeInteger(totalStockLimit) ||
    !Number.isSafeInteger(allocatedQuantity)
  ) {
    throw ApiError.conflict("Product stock limit is outside the safe range.");
  }

  return {
    totalStockLimit,
    allocatedQuantity,
    availableToAllocate: Math.max(0, totalStockLimit - allocatedQuantity),
  };
}

export async function syncProductStockQuantity(
  productId: string | Types.ObjectId,
  session?: mongoose.ClientSession,
): Promise<number> {
  const productObjectId = new Types.ObjectId(productId);
  const aggregate = InventoryModel.aggregate<{ total: number }>([
    { $match: { productId: productObjectId, variantId: { $exists: false } } },
    { $group: { _id: null, total: { $sum: "$quantity" } } },
  ]);

  if (session) aggregate.session(session);

  const [inventoryTotal] = await aggregate.exec();
  const total = inventoryTotal?.total ?? 0;

  if (!Number.isSafeInteger(total) || total < 0) {
    throw ApiError.conflict(
      "Inventory total is outside the supported quantity range.",
    );
  }

  const result = await ProductModel.updateOne(
    { _id: productObjectId },
    { $set: { stockQuantity: total } },
    session ? { session } : {},
  ).exec();

  if (result.matchedCount !== 1) {
    throw ApiError.notFound("Product not found.");
  }

  return total;
}

export async function syncVariantStockQuantity(
  variantId: string | Types.ObjectId,
  session?: mongoose.ClientSession,
): Promise<number> {
  const variantObjectId = new Types.ObjectId(variantId);
  const aggregate = InventoryModel.aggregate<{ total: number }>([
    { $match: { variantId: variantObjectId } },
    { $group: { _id: null, total: { $sum: "$quantity" } } },
  ]);

  if (session) aggregate.session(session);

  const [inventoryTotal] = await aggregate.exec();
  const total = inventoryTotal?.total ?? 0;

  if (!Number.isSafeInteger(total) || total < 0) {
    throw ApiError.conflict(
      "Variant inventory total is outside the supported quantity range.",
    );
  }

  const variant = await ProductVariantModel.findById(variantObjectId)
    .select("productId")
    .session(session ?? null)
    .lean()
    .exec();

  if (!variant) {
    throw ApiError.notFound("Product variant not found.");
  }

  await ProductVariantModel.updateOne(
    { _id: variantObjectId },
    { $set: { stockQuantity: total } },
    session ? { session } : {},
  ).exec();

  const aggregateProductStock = InventoryModel.aggregate<{ total: number }>([
    { $match: { productId: variant.productId } },
    { $group: { _id: null, total: { $sum: "$quantity" } } },
  ]);
  if (session) aggregateProductStock.session(session);
  const [productInventoryTotal] = await aggregateProductStock.exec();
  const productStockTotal = productInventoryTotal?.total ?? 0;

  if (!Number.isSafeInteger(productStockTotal) || productStockTotal < 0) {
    throw ApiError.conflict(
      "Product inventory total is outside the supported quantity range.",
    );
  }

  const productUpdate = await ProductModel.updateOne(
    { _id: variant.productId },
    { $set: { stockQuantity: productStockTotal } },
    session ? { session } : {},
  ).exec();
  if (productUpdate.matchedCount !== 1) {
    throw ApiError.notFound("Product for variant not found.");
  }

  return total;
}

export async function syncInventoryStockQuantity(
  productId: string | Types.ObjectId,
  variantId?: string | Types.ObjectId,
  session?: mongoose.ClientSession,
): Promise<number> {
  return variantId
    ? syncVariantStockQuantity(variantId, session)
    : syncProductStockQuantity(productId, session);
}

export async function getDefaultLowStockThreshold(
  variantId?: string | Types.ObjectId,
  session?: mongoose.ClientSession,
): Promise<number> {
  if (!variantId) return 5;

  const variant = await ProductVariantModel.findById(variantId)
    .select("lowStockThreshold")
    .session(session ?? null)
    .lean()
    .exec();

  if (!variant) {
    throw ApiError.notFound("Product variant not found.");
  }

  return variant.lowStockThreshold;
}

export async function setLowStockThreshold(
  id: string,
  lowStockThreshold: number,
) {
  assertObjectId(id);

  const item = await InventoryModel.findByIdAndUpdate(
    id,
    { $set: { lowStockThreshold } },
    { new: true, runValidators: true },
  ).exec();

  if (!item) throw ApiError.notFound("Inventory record not found.");

  return item;
}

/**
 * Atomic quantity adjustment.
 * This endpoint should be restricted to trusted inventory-management roles.
 * Stock history should be written by the stock-movements workflow.
 */
export async function adjustInventory(id: string, quantityChange: number) {
  assertObjectId(id);

  if (!Number.isSafeInteger(quantityChange) || quantityChange === 0) {
    throw ApiError.badRequest("quantityChange must be a non-zero integer.");
  }

  const session = await mongoose.startSession();

  try {
    let updatedItemId: Types.ObjectId | undefined;

    await session.withTransaction(async () => {
      const item = await InventoryModel.findOneAndUpdate(
        {
          _id: id,
          ...(quantityChange < 0
            ? { $expr: { $gte: ["$quantity", Math.abs(quantityChange)] } }
            : {}),
        },
        { $inc: { quantity: quantityChange } },
        { new: true, runValidators: true, session },
      ).exec();

      if (!item) {
        const exists = await InventoryModel.exists({ _id: id })
          .session(session)
          .exec();
        if (!exists) throw ApiError.notFound("Inventory record not found.");
        throw ApiError.conflict("Insufficient stock for this adjustment.");
      }

      await syncInventoryStockQuantity(item.productId, item.variantId, session);
      updatedItemId = item._id;
    });

    if (!updatedItemId) {
      throw ApiError.conflict("Inventory adjustment did not complete.");
    }

    return getInventory(updatedItemId.toHexString());
  } finally {
    await session.endSession();
  }
}

export async function ensureWarehouseActive(warehouseId: string) {
  assertObjectId(warehouseId);

  const warehouse = await WarehouseModel.findById(warehouseId)
    .select("_id status")
    .lean()
    .exec();

  if (!warehouse) throw ApiError.notFound("Warehouse not found.");
  if (warehouse.status !== "ACTIVE") {
    throw ApiError.badRequest("Warehouse is inactive.");
  }

  return warehouse;
}

/**
 * Shared reference validation for stock-movement operations.
 * Checks that the product and warehouse exist and that the warehouse is active.
 */
export async function assertStockReferences(
  productId: string | Types.ObjectId,
  warehouseId: string | Types.ObjectId,
  session?: mongoose.ClientSession,
  variantId?: string | Types.ObjectId,
) {
  const productIdString = String(productId);
  const warehouseIdString = String(warehouseId);

  assertObjectId(productIdString);
  assertObjectId(warehouseIdString);

  const product = await ProductModel.findById(productIdString)
    .select("_id type trackInventory")
    .session(session ?? null)
    .lean()
    .exec();
  const warehouse = await WarehouseModel.findById(warehouseIdString)
    .select("_id status")
    .session(session ?? null)
    .lean()
    .exec();

  if (!product) {
    throw ApiError.notFound("Product not found.");
  }

  if (!product.trackInventory && product.type !== "VARIABLE") {
    throw ApiError.badRequest(
      "Inventory tracking is disabled for this product.",
    );
  }

  if (variantId) {
    if (!Types.ObjectId.isValid(String(variantId))) {
      throw ApiError.badRequest("Invalid product variant ID.");
    }

    if (product.type !== "VARIABLE") {
      throw ApiError.badRequest("Only variable products can have variants.");
    }

    const variant = await ProductVariantModel.findOne({
      _id: variantId,
      productId: productIdString,
    })
      .select("_id status trackInventory")
      .session(session ?? null)
      .lean()
      .exec();

    if (!variant) {
      throw ApiError.notFound("Product variant not found for this product.");
    }
    if (variant.status !== "ACTIVE") {
      throw ApiError.badRequest("Inactive variants cannot receive stock.");
    }
    if (!variant.trackInventory) {
      throw ApiError.badRequest(
        "Inventory tracking is disabled for this variant.",
      );
    }
  } else if (product.type === "VARIABLE") {
    throw ApiError.badRequest(
      "Select a variant before changing stock for a variable product.",
    );
  }

  if (!warehouse) {
    throw ApiError.notFound("Warehouse not found.");
  }

  if (warehouse.status !== "ACTIVE") {
    throw ApiError.badRequest("Warehouse is inactive.");
  }

  return { product, warehouse };
}
