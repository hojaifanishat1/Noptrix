import mongoose, { Types } from "mongoose";
import { ApiError } from "../../utils/ApiError";
import InventoryModel from "../inventory/inventory.model";
import type { LowStockQuery } from "./low-stock.types";

function assertObjectId(id: string, field: string): void {
  if (!Types.ObjectId.isValid(id)) {
    throw ApiError.badRequest(`Invalid ${field}.`);
  }
}

function lowStockExpression() {
  return {
    $lte: [
      { $subtract: ["$quantity", "$reservedQuantity"] },
      "$lowStockThreshold",
    ],
  };
}

function outOfStockExpression() {
  return {
    $lte: [{ $subtract: ["$quantity", "$reservedQuantity"] }, 0],
  };
}

function lowOnlyExpression() {
  return {
    $and: [
      {
        $gt: [{ $subtract: ["$quantity", "$reservedQuantity"] }, 0],
      },
      lowStockExpression(),
    ],
  };
}

async function buildBaseQuery(filters: LowStockQuery) {
  const query: Record<string, unknown> = {};

  if (filters.warehouseId) {
    assertObjectId(filters.warehouseId, "warehouseId");
    query.warehouseId = new Types.ObjectId(filters.warehouseId);
  }

  if (filters.productId) {
    assertObjectId(filters.productId, "productId");
    query.productId = new Types.ObjectId(filters.productId);
  }

  if (filters.search?.trim()) {
    const escaped = filters.search
      .trim()
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const productModel = mongoose.model("Product");
    const products = await productModel
      .find({ name: { $regex: escaped, $options: "i" } })
      .select("_id")
      .limit(100)
      .lean()
      .exec();

    query.productId = {
      $in: products.map((product: { _id: Types.ObjectId }) => product._id),
    };
  }

  return query;
}

export async function listLowStock(filters: LowStockQuery) {
  const baseQuery = await buildBaseQuery(filters);
  const query: Record<string, unknown> = {
    ...baseQuery,
    $expr:
      filters.status === "OUT_OF_STOCK"
        ? outOfStockExpression()
        : filters.status === "LOW_STOCK"
          ? lowOnlyExpression()
          : lowStockExpression(),
  };

  const direction = filters.sortOrder === "asc" ? 1 : -1;
  const skip = (filters.page - 1) * filters.limit;

  const [items, total] = await Promise.all([
    InventoryModel.find(query)
      .sort({ [filters.sortBy]: direction, _id: 1 })
      .skip(skip)
      .limit(filters.limit)
      .populate("productId")
      .populate("variantId")
      .populate("warehouseId")
      .lean()
      .exec(),
    InventoryModel.countDocuments(query).exec(),
  ]);

  const resultItems = items.map((item) => {
    const availableQuantity = item.quantity - item.reservedQuantity;
    const stockStatus = availableQuantity <= 0 ? "OUT_OF_STOCK" : "LOW_STOCK";

    return {
      ...item,
      availableQuantity,
      stockStatus,
    };
  });

  return {
    items: resultItems,
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      totalPages: Math.ceil(total / filters.limit),
      hasNextPage: skip + filters.limit < total,
      hasPreviousPage: filters.page > 1,
    },
  };
}

export async function getLowStockSummary(
  filters: Pick<LowStockQuery, "search" | "warehouseId" | "productId">,
) {
  const baseQuery = await buildBaseQuery({
    ...filters,
    page: 1,
    limit: 1,
    status: "ALL",
    sortBy: "updatedAt",
    sortOrder: "asc",
  });

  const [lowStock, outOfStock] = await Promise.all([
    InventoryModel.countDocuments({
      ...baseQuery,
      $expr: lowOnlyExpression(),
    }).exec(),
    InventoryModel.countDocuments({
      ...baseQuery,
      $expr: outOfStockExpression(),
    }).exec(),
  ]);

  return {
    lowStock,
    outOfStock,
    totalAlerts: lowStock + outOfStock,
  };
}
