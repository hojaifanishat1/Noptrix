import mongoose, { Types } from "mongoose";

import { ApiError } from "../../utils/ApiError";
import { InventoryModel } from "../inventory/inventory.model";
import {
  assertStockReferences,
  getDefaultLowStockThreshold,
  getProductStockCapacity,
  syncInventoryStockQuantity,
} from "../inventory/inventory.service";
import { StockMovementModel } from "./stockMovement.model";
import type {
  CreateStockMovementInput,
  StockMovementFilters,
} from "./stockMovement.types";

function assertObjectId(value: string, label: string): void {
  if (!Types.ObjectId.isValid(value)) {
    throw ApiError.badRequest(`Invalid ${label}.`);
  }
}

function assertSafeQuantity(value: number): void {
  if (!Number.isSafeInteger(value) || value === 0) {
    throw ApiError.badRequest("Quantity must be a non-zero safe integer.");
  }
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: number }).code === 11000
  );
}

function validateMovementInput(input: CreateStockMovementInput): void {
  assertObjectId(input.productId, "productId");
  assertObjectId(input.warehouseId, "warehouseId");
  assertSafeQuantity(input.quantity);

  if (input.type !== "ADJUSTMENT" && input.quantity < 0) {
    throw ApiError.badRequest(
      "Quantity must be positive for this movement type.",
    );
  }

  if (input.type === "TRANSFER") {
    if (!input.destinationWarehouseId) {
      throw ApiError.badRequest(
        "Destination warehouse is required for a transfer.",
      );
    }

    assertObjectId(input.destinationWarehouseId, "destinationWarehouseId");

    if (input.destinationWarehouseId === input.warehouseId) {
      throw ApiError.badRequest(
        "Source and destination warehouses must be different.",
      );
    }
  } else if (input.destinationWarehouseId) {
    throw ApiError.badRequest(
      "Destination warehouse is only allowed for TRANSFER.",
    );
  }

  if (input.referenceId) {
    assertObjectId(input.referenceId, "referenceId");
  }

  if (input.idempotencyKey) {
    const key = input.idempotencyKey.trim();

    if (key.length < 8 || key.length > 128) {
      throw ApiError.badRequest(
        "Idempotency key must contain 8–128 characters.",
      );
    }
  }

  if (
    typeof input.reason !== "string" ||
    input.reason.trim().length < 3 ||
    input.reason.trim().length > 500
  ) {
    throw ApiError.badRequest("Reason must contain 3–500 characters.");
  }

  if (input.reference && input.reference.trim().length > 120) {
    throw ApiError.badRequest("Reference must contain at most 120 characters.");
  }
}

async function getOrCreateInventory(
  productId: Types.ObjectId,
  variantId: Types.ObjectId | undefined,
  warehouseId: Types.ObjectId,
  session: mongoose.ClientSession,
  allowCreate: boolean,
) {
  const inventory = await InventoryModel.findOne({
    productId,
    ...(variantId ? { variantId } : { variantId: { $exists: false } }),
    warehouseId,
  })
    .session(session)
    .exec();

  if (inventory) return inventory;

  if (!allowCreate) {
    throw ApiError.conflict("Insufficient stock.");
  }

  const lowStockThreshold = await getDefaultLowStockThreshold(
    variantId,
    session,
  );
  const [created] = await InventoryModel.create(
    [
      {
        productId,
        ...(variantId ? { variantId } : {}),
        warehouseId,
        quantity: 0,
        reservedQuantity: 0,
        lowStockThreshold,
      },
    ],
    { session },
  );

  if (!created) {
    throw ApiError.conflict(
      "Could not initialize inventory for this warehouse.",
    );
  }

  return created;
}

async function updateInventoryQuantity(
  inventory: Awaited<ReturnType<typeof getOrCreateInventory>>,
  before: number,
  reservedBefore: number,
  after: number,
  adminId: Types.ObjectId,
  session: mongoose.ClientSession,
): Promise<void> {
  if (!Number.isSafeInteger(after) || after < 0) {
    throw ApiError.badRequest(
      "The operation would result in an invalid stock quantity.",
    );
  }

  if (after < reservedBefore) {
    throw ApiError.conflict(
      "The operation would reduce stock below the reserved quantity.",
    );
  }

  const result = await InventoryModel.updateOne(
    {
      _id: inventory._id,
      quantity: before,
      reservedQuantity: reservedBefore,
    },
    {
      $set: {
        quantity: after,
        updatedBy: adminId,
      },
    },
    { session },
  ).exec();

  if (result.modifiedCount !== 1) {
    throw ApiError.conflict(
      "Inventory changed concurrently. Please retry the request.",
    );
  }
}

export async function listStockMovements(filters: StockMovementFilters) {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 20;

  const query: Record<string, unknown> = {};

  if (filters.productId) {
    assertObjectId(filters.productId, "productId");
    query.productId = new Types.ObjectId(filters.productId);
  }

  if (filters.variantId) {
    assertObjectId(filters.variantId, "variantId");
    query.variantId = new Types.ObjectId(filters.variantId);
  }

  if (filters.warehouseId) {
    assertObjectId(filters.warehouseId, "warehouseId");
    query.warehouseId = new Types.ObjectId(filters.warehouseId);
  }

  if (filters.destinationWarehouseId) {
    assertObjectId(filters.destinationWarehouseId, "destinationWarehouseId");
    query.destinationWarehouseId = new Types.ObjectId(
      filters.destinationWarehouseId,
    );
  }

  if (filters.type) query.type = filters.type;

  if (filters.referenceType) {
    query.referenceType = filters.referenceType;
  }

  if (filters.referenceId) {
    assertObjectId(filters.referenceId, "referenceId");
    query.referenceId = new Types.ObjectId(filters.referenceId);
  }

  if (filters.fromDate || filters.toDate) {
    const createdAt: Record<string, Date> = {};

    if (filters.fromDate) {
      createdAt.$gte = new Date(filters.fromDate);
    }

    if (filters.toDate) {
      createdAt.$lte = new Date(filters.toDate);
    }

    if (
      filters.fromDate &&
      filters.toDate &&
      new Date(filters.fromDate) > new Date(filters.toDate)
    ) {
      throw ApiError.badRequest("fromDate must not be later than toDate.");
    }

    query.createdAt = createdAt;
  }

  const sortDirection = filters.sortOrder === "asc" ? 1 : -1;

  const [items, total] = await Promise.all([
    StockMovementModel.find(query)
      .populate("productId")
      .populate("variantId")
      .populate("warehouseId")
      .populate("destinationWarehouseId")
      .populate("createdBy", "name email")
      .sort({ createdAt: sortDirection, _id: sortDirection })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()
      .exec(),

    StockMovementModel.countDocuments(query).exec(),
  ]);

  return {
    items,
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

export async function getStockMovement(id: string) {
  assertObjectId(id, "movement id");

  const movement = await StockMovementModel.findById(id)
    .populate("productId")
    .populate("variantId")
    .populate("warehouseId")
    .populate("destinationWarehouseId")
    .populate("createdBy", "name email")
    .lean()
    .exec();

  if (!movement) {
    throw ApiError.notFound("Stock movement not found.");
  }

  return movement;
}

export async function createStockMovement(
  input: CreateStockMovementInput,
  adminId: string,
) {
  assertObjectId(adminId, "authenticated admin id");
  validateMovementInput(input);

  const adminObjectId = new Types.ObjectId(adminId);
  const productObjectId = new Types.ObjectId(input.productId);
  const variantObjectId = input.variantId
    ? new Types.ObjectId(input.variantId)
    : undefined;
  const sourceWarehouseId = new Types.ObjectId(input.warehouseId);
  const destinationWarehouseId = input.destinationWarehouseId
    ? new Types.ObjectId(input.destinationWarehouseId)
    : undefined;

  // Fast path for a previously completed idempotent request.
  if (input.idempotencyKey) {
    const existing = await StockMovementModel.findOne({
      idempotencyKey: input.idempotencyKey,
    })
      .lean()
      .exec();

    if (existing) return existing;
  }

  const session = await mongoose.startSession();

  try {
    let result: unknown;

    await session.withTransaction(async () => {
      // Recheck within the transaction so reference checks and stock
      // mutations participate in the same transaction.
      await assertStockReferences(
        productObjectId,
        sourceWarehouseId,
        session,
        variantObjectId,
      );

      if (destinationWarehouseId) {
        await assertStockReferences(
          productObjectId,
          destinationWarehouseId,
          session,
          variantObjectId,
        );
      }

      const source = await getOrCreateInventory(
        productObjectId,
        variantObjectId,
        sourceWarehouseId,
        session,
        input.type === "IN" ||
          (input.type === "ADJUSTMENT" && input.quantity > 0),
      );

      if (
        variantObjectId &&
        input.quantity > 0 &&
        (input.type === "IN" || input.type === "ADJUSTMENT")
      ) {
        const capacity = await getProductStockCapacity(
          productObjectId.toHexString(),
          session,
        );
        if (
          capacity.allocatedQuantity + input.quantity >
          capacity.totalStockLimit
        ) {
          throw ApiError.conflict(
            `Variant stock exceeds the product's received stock limit. Available to allocate: ${capacity.availableToAllocate}.`,
          );
        }
      }

      const sourceBefore = source.quantity;
      const sourceReservedBefore = source.reservedQuantity;
      let sourceAfter: number;

      let destinationBefore: number | undefined;
      let destinationAfter: number | undefined;

      if (input.type === "IN") {
        sourceAfter = sourceBefore + input.quantity;
      } else if (input.type === "OUT") {
        const available = sourceBefore - sourceReservedBefore;

        if (input.quantity > available) {
          throw ApiError.conflict(
            "Insufficient available stock after reserved quantity.",
          );
        }

        sourceAfter = sourceBefore - input.quantity;
      } else if (input.type === "ADJUSTMENT") {
        sourceAfter = sourceBefore + input.quantity;
      } else {
        // TRANSFER: decrement source and increment destination atomically.
        const available = sourceBefore - sourceReservedBefore;

        if (input.quantity > available) {
          throw ApiError.conflict("Insufficient available stock for transfer.");
        }

        if (!destinationWarehouseId) {
          throw ApiError.badRequest(
            "Destination warehouse is required for a transfer.",
          );
        }

        const destination = await getOrCreateInventory(
          productObjectId,
          variantObjectId,
          destinationWarehouseId,
          session,
          true,
        );

        destinationBefore = destination.quantity;
        destinationAfter = destinationBefore + input.quantity;

        if (!Number.isSafeInteger(destinationAfter)) {
          throw ApiError.badRequest(
            "Destination stock would exceed the safe integer range.",
          );
        }

        await updateInventoryQuantity(
          destination,
          destinationBefore,
          destination.reservedQuantity,
          destinationAfter,
          adminObjectId,
          session,
        );

        sourceAfter = sourceBefore - input.quantity;
      }

      await updateInventoryQuantity(
        source,
        sourceBefore,
        sourceReservedBefore,
        sourceAfter,
        adminObjectId,
        session,
      );

      const [movement] = await StockMovementModel.create(
        [
          {
            productId: productObjectId,
            ...(variantObjectId ? { variantId: variantObjectId } : {}),
            warehouseId: sourceWarehouseId,
            destinationWarehouseId,
            type: input.type,
            quantity: input.quantity,
            quantityBefore: sourceBefore,
            quantityAfter: sourceAfter,
            destinationQuantityBefore: destinationBefore,
            destinationQuantityAfter: destinationAfter,
            reason: input.reason.trim(),
            reference: input.reference?.trim(),
            referenceType: input.referenceType?.trim(),
            referenceId: input.referenceId
              ? new Types.ObjectId(input.referenceId)
              : undefined,
            idempotencyKey: input.idempotencyKey?.trim(),
            createdBy: adminObjectId,
          },
        ],
        { session },
      );

      if (!movement) {
        throw ApiError.conflict("Stock movement record could not be created.");
      }

      await syncInventoryStockQuantity(
        productObjectId,
        variantObjectId,
        session,
      );

      result = movement;
    });

    if (!result) {
      throw ApiError.conflict("Stock movement transaction did not complete.");
    }

    return result;
  } catch (error) {
    // If two concurrent requests use the same idempotency key,
    // the unique index prevents duplicate movement records.
    if (input.idempotencyKey && isDuplicateKeyError(error)) {
      const existing = await StockMovementModel.findOne({
        idempotencyKey: input.idempotencyKey.trim(),
      })
        .lean()
        .exec();

      if (existing) return existing;
    }

    throw error;
  } finally {
    await session.endSession();
  }
}
