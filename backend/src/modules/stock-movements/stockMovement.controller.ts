import type { Request, Response } from "express";

import { ApiResponse } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import { getAuthenticatedAdminId } from "../../middlewares/adminAuth.middleware";
import * as service from "./stockMovement.service";
import type {
  CreateStockMovementInput,
  StockMovementFilters,
} from "./stockMovement.types";

export const listStockMovementsController = asyncHandler(
  async (req: Request, res: Response) => {
    const filters: StockMovementFilters = {
      productId:
        typeof req.query.productId === "string"
          ? req.query.productId
          : undefined,
      variantId:
        typeof req.query.variantId === "string"
          ? req.query.variantId
          : undefined,
      warehouseId:
        typeof req.query.warehouseId === "string"
          ? req.query.warehouseId
          : undefined,
      destinationWarehouseId:
        typeof req.query.destinationWarehouseId === "string"
          ? req.query.destinationWarehouseId
          : undefined,
      type:
        typeof req.query.type === "string"
          ? (req.query.type as StockMovementFilters["type"])
          : undefined,
      referenceType:
        typeof req.query.referenceType === "string"
          ? req.query.referenceType
          : undefined,
      referenceId:
        typeof req.query.referenceId === "string"
          ? req.query.referenceId
          : undefined,
      fromDate:
        typeof req.query.fromDate === "string" ? req.query.fromDate : undefined,
      toDate:
        typeof req.query.toDate === "string" ? req.query.toDate : undefined,
      page:
        typeof req.query.page === "number"
          ? req.query.page
          : Number(req.query.page ?? 1),
      limit:
        typeof req.query.limit === "number"
          ? req.query.limit
          : Number(req.query.limit ?? 20),
      sortOrder: req.query.sortOrder === "asc" ? "asc" : "desc",
    };

    const data = await service.listStockMovements(filters);

    res.status(200).json(ApiResponse.ok(data, "Stock movements retrieved."));
  },
);

export const getStockMovementController = asyncHandler(
  async (req: Request, res: Response) => {
    const movement = await service.getStockMovement(String(req.params.id));

    res.status(200).json(ApiResponse.ok(movement, "Stock movement retrieved."));
  },
);

export const createStockMovementController = asyncHandler(
  async (req: Request, res: Response) => {
    const body = req.body as CreateStockMovementInput;
    const headerKey = req.get("Idempotency-Key");

    const input: CreateStockMovementInput = {
      ...body,
      idempotencyKey: body.idempotencyKey ?? headerKey ?? undefined,
    };

    const movement = await service.createStockMovement(
      input,
      getAuthenticatedAdminId(req),
    );

    res
      .status(201)
      .json(ApiResponse.created(movement, "Stock movement recorded."));
  },
);
