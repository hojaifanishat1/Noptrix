import mongoose, { Types } from "mongoose";
import { ApiError } from "../../utils/ApiError";
import InventoryModel from "./inventory.model";
import WarehouseModel from "../warehouses/warehouse.model";
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
    stockStatus,
    sortBy,
    sortOrder,
  } = filters;

  if (warehouseId) assertObjectId(warehouseId);
  if (productId) assertObjectId(productId);

  const query: Record<string, unknown> = {};

  if (warehouseId) query.warehouseId = new Types.ObjectId(warehouseId);
  if (productId) query.productId = new Types.ObjectId(productId);

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
    .select("productId warehouseId")
    .lean()
    .exec();

  if (!item) throw ApiError.notFound("Inventory record not found.");

  return {
    productId: item.productId.toString(),
    warehouseId: item.warehouseId.toString(),
  };
}

export async function getInventory(id: string) {
  assertObjectId(id);

  const item = await InventoryModel.findById(id)
    .populate("productId")
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

  const item = await InventoryModel.findOneAndUpdate(
    {
      _id: id,
      ...(quantityChange < 0
        ? { $expr: { $gte: ["$quantity", Math.abs(quantityChange)] } }
        : {}),
    },
    { $inc: { quantity: quantityChange } },
    { new: true, runValidators: true },
  ).exec();

  if (!item) {
    const exists = await InventoryModel.exists({ _id: id });
    if (!exists) throw ApiError.notFound("Inventory record not found.");
    throw ApiError.conflict("Insufficient stock for this adjustment.");
  }

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
) {
  const productIdString = String(productId);
  const warehouseIdString = String(warehouseId);

  assertObjectId(productIdString);
  assertObjectId(warehouseIdString);

  const [product, warehouse] = await Promise.all([
    mongoose
      .model("Product")
      .exists({ _id: productIdString })
      .session(session ?? null),
    WarehouseModel.findById(warehouseIdString)
      .select("_id status")
      .session(session ?? null)
      .lean()
      .exec(),
  ]);

  if (!product) {
    throw ApiError.notFound("Product not found.");
  }

  if (!warehouse) {
    throw ApiError.notFound("Warehouse not found.");
  }

  if (warehouse.status !== "ACTIVE") {
    throw ApiError.badRequest("Warehouse is inactive.");
  }

  return { product, warehouse };
}
