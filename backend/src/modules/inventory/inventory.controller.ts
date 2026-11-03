import type { Request, Response } from "express";
import { getAuthenticatedAdminId } from "../../middlewares/adminAuth.middleware";
import { ApiResponse } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import { createStockMovement } from "../stock-movements/stockMovement.service";
import * as service from "./inventory.service";

export const listInventoryController = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await service.listInventory({
      page: Number(req.query.page ?? 1),
      limit: Number(req.query.limit ?? 20),
      search:
        typeof req.query.search === "string" ? req.query.search : undefined,
      warehouseId:
        typeof req.query.warehouseId === "string"
          ? req.query.warehouseId
          : undefined,
      productId:
        typeof req.query.productId === "string"
          ? req.query.productId
          : undefined,
      variantId:
        typeof req.query.variantId === "string"
          ? req.query.variantId
          : undefined,
      stockStatus:
        req.query.stockStatus === "IN_STOCK" ||
        req.query.stockStatus === "LOW_STOCK" ||
        req.query.stockStatus === "OUT_OF_STOCK"
          ? req.query.stockStatus
          : undefined,
      sortBy:
        req.query.sortBy === "quantity" || req.query.sortBy === "createdAt"
          ? req.query.sortBy
          : "updatedAt",
      sortOrder: req.query.sortOrder === "asc" ? "asc" : "desc",
    });

    res
      .status(200)
      .json(
        ApiResponse.ok(result.items, "Inventory retrieved.", result.pagination),
      );
  },
);

export const getInventoryController = asyncHandler(
  async (req: Request, res: Response) => {
    const item = await service.getInventory(String(req.params.id));
    res.status(200).json(ApiResponse.ok(item, "Inventory retrieved."));
  },
);

export const getProductStockCapacityController = asyncHandler(
  async (req: Request, res: Response) => {
    const capacity = await service.getProductStockCapacity(
      String(req.params.productId),
    );
    res
      .status(200)
      .json(ApiResponse.ok(capacity, "Product stock capacity retrieved."));
  },
);

export const setLowStockThresholdController = asyncHandler(
  async (req: Request, res: Response) => {
    const item = await service.setLowStockThreshold(
      String(req.params.id),
      req.body.lowStockThreshold,
    );

    res.status(200).json(ApiResponse.ok(item, "Low-stock threshold updated."));
  },
);

export const adjustInventoryController = asyncHandler(
  async (req: Request, res: Response) => {
    const inventoryId = String(req.params.id);
    const current = await service.getInventoryReferences(inventoryId);

    await createStockMovement(
      {
        productId: current.productId,
        ...(current.variantId ? { variantId: current.variantId } : {}),
        warehouseId: current.warehouseId,
        type: "ADJUSTMENT",
        quantity: req.body.quantityChange,
        reason: req.body.reason,
        reference: req.body.reference,
      },
      getAuthenticatedAdminId(req),
    );

    const item = await service.getInventory(inventoryId);

    res.status(200).json(ApiResponse.ok(item, "Inventory adjusted."));
  },
);
