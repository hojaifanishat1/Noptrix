import mongoose, { Types } from "mongoose";

import { ApiError } from "../../utils/ApiError";
import { InventoryModel } from "../inventory/inventory.model";
import {
  assertStockReferences,
  getDefaultLowStockThreshold,
  syncInventoryStockQuantity,
} from "../inventory/inventory.service";
import { WarehouseModel } from "../warehouses/warehouse.model";
import { StockMovementModel } from "../stock-movements/stockMovement.model";
import { StockTransferModel } from "./stockTransfer.model";
import type {
  CreateStockTransferInput,
  StockTransferFilters,
  StockTransferStatus,
} from "./stockTransfer.types";

function assertObjectId(value: string, label: string): void {
  if (!Types.ObjectId.isValid(value)) {
    throw ApiError.badRequest(`Invalid ${label}.`);
  }
}

function assertAdminId(adminId: string): Types.ObjectId {
  assertObjectId(adminId, "authenticated admin id");
  return new Types.ObjectId(adminId);
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: number }).code === 11000
  );
}

function createTransferNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = new Types.ObjectId().toString().slice(-8).toUpperCase();

  return `ST-${timestamp}-${random}`;
}

function addAudit(
  transfer: {
    auditTrail: Array<{
      action: string;
      performedBy: Types.ObjectId;
      note?: string;
      performedAt: Date;
    }>;
  },
  action:
    | "CREATED"
    | "APPROVED"
    | "DISPATCHED"
    | "RECEIVED"
    | "CANCELLED"
    | "REJECTED",
  adminId: Types.ObjectId,
  note?: string,
): void {
  transfer.auditTrail.push({
    action,
    performedBy: adminId,
    note: note?.trim() || undefined,
    performedAt: new Date(),
  });
}

function validateCreateInput(input: CreateStockTransferInput): void {
  assertObjectId(input.productId, "productId");
  if (input.variantId) assertObjectId(input.variantId, "variantId");
  assertObjectId(input.sourceWarehouseId, "sourceWarehouseId");
  assertObjectId(input.destinationWarehouseId, "destinationWarehouseId");

  if (input.sourceWarehouseId === input.destinationWarehouseId) {
    throw ApiError.badRequest(
      "Source and destination warehouses must be different.",
    );
  }

  if (!Number.isSafeInteger(input.quantity) || input.quantity <= 0) {
    throw ApiError.badRequest(
      "Transfer quantity must be a positive safe integer.",
    );
  }

  if (
    typeof input.reason !== "string" ||
    input.reason.trim().length < 3 ||
    input.reason.trim().length > 500
  ) {
    throw ApiError.badRequest("Reason must contain 3–500 characters.");
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
}

async function getTransferOrThrow(
  id: string,
  session?: mongoose.ClientSession,
) {
  assertObjectId(id, "transfer id");

  const query = StockTransferModel.findById(id);

  if (session) query.session(session);

  const transfer = await query.exec();

  if (!transfer) {
    throw ApiError.notFound("Stock transfer not found.");
  }

  return transfer;
}

async function assertWarehouseActive(
  warehouseId: Types.ObjectId,
  session: mongoose.ClientSession,
): Promise<void> {
  const warehouse = await WarehouseModel.findById(warehouseId)
    .select("_id status")
    .session(session)
    .lean()
    .exec();

  if (!warehouse) {
    throw ApiError.notFound("Warehouse not found.");
  }

  if (warehouse.status !== "ACTIVE") {
    throw ApiError.badRequest("Stock transfers require active warehouses.");
  }
}

async function updateInventory(
  productId: Types.ObjectId,
  variantId: Types.ObjectId | undefined,
  warehouseId: Types.ObjectId,
  quantityDelta: number,
  adminId: Types.ObjectId,
  session: mongoose.ClientSession,
  allowCreate: boolean,
): Promise<{ before: number; after: number }> {
  let inventory = await InventoryModel.findOne({
    productId,
    ...(variantId ? { variantId } : { variantId: { $exists: false } }),
    warehouseId,
  })
    .session(session)
    .exec();

  if (!inventory) {
    if (!allowCreate || quantityDelta < 0) {
      throw ApiError.conflict("Insufficient stock in source warehouse.");
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
      throw ApiError.conflict("Could not initialize destination inventory.");
    }

    inventory = created;
  }

  const before = inventory.quantity;
  const reserved = inventory.reservedQuantity;
  const after = before + quantityDelta;

  if (!Number.isSafeInteger(after) || after < 0) {
    throw ApiError.conflict("Invalid resulting inventory quantity.");
  }

  if (after < reserved) {
    throw ApiError.conflict(
      "Operation would reduce stock below the reserved quantity.",
    );
  }

  if (quantityDelta < 0 && before - reserved < Math.abs(quantityDelta)) {
    throw ApiError.conflict("Insufficient available stock.");
  }

  const result = await InventoryModel.updateOne(
    {
      _id: inventory._id,
      quantity: before,
      reservedQuantity: reserved,
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
      "Inventory changed concurrently. Retry the operation.",
    );
  }

  return { before, after };
}

async function createMovementRecord(args: {
  productId: Types.ObjectId;
  variantId?: Types.ObjectId;
  sourceWarehouseId: Types.ObjectId;
  destinationWarehouseId: Types.ObjectId;
  quantity: number;
  sourceBefore: number;
  sourceAfter: number;
  destinationBefore?: number;
  destinationAfter?: number;
  reason: string;
  transferId: Types.ObjectId;
  adminId: Types.ObjectId;
  session: mongoose.ClientSession;
  idempotencyKey?: string;
}) {
  const [movement] = await StockMovementModel.create(
    [
      {
        productId: args.productId,
        ...(args.variantId ? { variantId: args.variantId } : {}),
        warehouseId: args.sourceWarehouseId,
        destinationWarehouseId: args.destinationWarehouseId,
        type: "TRANSFER",
        quantity: args.quantity,
        quantityBefore: args.sourceBefore,
        quantityAfter: args.sourceAfter,
        destinationQuantityBefore: args.destinationBefore,
        destinationQuantityAfter: args.destinationAfter,
        reason: args.reason,
        referenceType: "STOCK_TRANSFER",
        referenceId: args.transferId,
        idempotencyKey: args.idempotencyKey,
        createdBy: args.adminId,
      },
    ],
    { session: args.session },
  );

  if (!movement) {
    throw ApiError.conflict("Could not create stock movement history.");
  }

  return movement;
}

export async function createStockTransfer(
  input: CreateStockTransferInput,
  adminId: string,
) {
  validateCreateInput(input);

  const actorId = assertAdminId(adminId);
  const productId = new Types.ObjectId(input.productId);
  const variantId = input.variantId
    ? new Types.ObjectId(input.variantId)
    : undefined;
  const sourceWarehouseId = new Types.ObjectId(input.sourceWarehouseId);
  const destinationWarehouseId = new Types.ObjectId(
    input.destinationWarehouseId,
  );

  const idempotencyKey = input.idempotencyKey?.trim();

  if (idempotencyKey) {
    const existing = await StockTransferModel.findOne({ idempotencyKey })
      .lean()
      .exec();

    if (existing) return existing;
  }

  const session = await mongoose.startSession();

  try {
    let createdId: Types.ObjectId | undefined;

    await session.withTransaction(async () => {
      await assertStockReferences(
        productId,
        sourceWarehouseId,
        session,
        variantId,
      );
      await assertStockReferences(
        productId,
        destinationWarehouseId,
        session,
        variantId,
      );

      const [transfer] = await StockTransferModel.create(
        [
          {
            transferNumber: createTransferNumber(),
            productId,
            ...(variantId ? { variantId } : {}),
            sourceWarehouseId,
            destinationWarehouseId,
            quantity: input.quantity,
            status: "DRAFT",
            reason: input.reason.trim(),
            referenceType: input.referenceType?.trim(),
            referenceId: input.referenceId
              ? new Types.ObjectId(input.referenceId)
              : undefined,
            idempotencyKey,
            createdBy: actorId,
            auditTrail: [
              {
                action: "CREATED",
                performedBy: actorId,
                performedAt: new Date(),
              },
            ],
          },
        ],
        { session },
      );

      if (!transfer) {
        throw ApiError.conflict("Could not create stock transfer.");
      }

      createdId = transfer._id;
    });

    if (!createdId) {
      throw ApiError.conflict("Stock transfer was not created.");
    }

    return getStockTransfer(String(createdId));
  } catch (error) {
    if (idempotencyKey && isDuplicateKeyError(error)) {
      const existing = await StockTransferModel.findOne({ idempotencyKey })
        .lean()
        .exec();

      if (existing) return existing;
    }

    throw error;
  } finally {
    await session.endSession();
  }
}

export async function listStockTransfers(filters: StockTransferFilters) {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 20;
  const query: Record<string, unknown> = {};

  if (filters.productId) {
    assertObjectId(filters.productId, "productId");
    query.productId = new Types.ObjectId(filters.productId);
  }

  if (filters.sourceWarehouseId) {
    assertObjectId(filters.sourceWarehouseId, "sourceWarehouseId");
    query.sourceWarehouseId = new Types.ObjectId(filters.sourceWarehouseId);
  }

  if (filters.destinationWarehouseId) {
    assertObjectId(filters.destinationWarehouseId, "destinationWarehouseId");
    query.destinationWarehouseId = new Types.ObjectId(
      filters.destinationWarehouseId,
    );
  }

  if (filters.status) query.status = filters.status;
  if (filters.referenceType) query.referenceType = filters.referenceType;

  if (filters.referenceId) {
    assertObjectId(filters.referenceId, "referenceId");
    query.referenceId = new Types.ObjectId(filters.referenceId);
  }

  if (filters.fromDate || filters.toDate) {
    const createdAt: Record<string, Date> = {};

    if (filters.fromDate) createdAt.$gte = new Date(filters.fromDate);
    if (filters.toDate) createdAt.$lte = new Date(filters.toDate);

    query.createdAt = createdAt;
  }

  const direction = filters.sortOrder === "asc" ? 1 : -1;

  const [items, total] = await Promise.all([
    StockTransferModel.find(query)
      .populate("productId")
      .populate("variantId")
      .populate("sourceWarehouseId")
      .populate("destinationWarehouseId")
      .populate("createdBy", "name email")
      .populate("approvedBy", "name email")
      .populate("dispatchedBy", "name email")
      .populate("receivedBy", "name email")
      .sort({ createdAt: direction, _id: direction })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()
      .exec(),

    StockTransferModel.countDocuments(query).exec(),
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

export async function getStockTransfer(id: string) {
  assertObjectId(id, "transfer id");

  const transfer = await StockTransferModel.findById(id)
    .populate("productId")
    .populate("variantId")
    .populate("sourceWarehouseId")
    .populate("destinationWarehouseId")
    .populate("createdBy", "name email")
    .populate("approvedBy", "name email")
    .populate("dispatchedBy", "name email")
    .populate("receivedBy", "name email")
    .populate("cancelledBy", "name email")
    .populate("rejectedBy", "name email")
    .populate("auditTrail.performedBy", "name email")
    .lean()
    .exec();

  if (!transfer) {
    throw ApiError.notFound("Stock transfer not found.");
  }

  return transfer;
}

async function updateTransferStatus(
  id: string,
  adminId: string,
  action: "APPROVE" | "REJECT" | "DISPATCH" | "RECEIVE" | "CANCEL",
  note?: string,
) {
  assertObjectId(id, "transfer id");
  const actorId = assertAdminId(adminId);
  const session = await mongoose.startSession();

  try {
    let updatedId: Types.ObjectId | undefined;

    await session.withTransaction(async () => {
      const transfer = await getTransferOrThrow(id, session);

      if (action === "APPROVE") {
        if (transfer.status !== "DRAFT") {
          throw ApiError.conflict("Only DRAFT transfers can be approved.");
        }

        if (String(transfer.createdBy) === String(actorId)) {
          throw ApiError.forbidden(
            "The creator cannot approve their own transfer.",
          );
        }

        transfer.status = "APPROVED";
        transfer.approvedBy = actorId;
        transfer.approvedAt = new Date();

        addAudit(transfer, "APPROVED", actorId, note);
      } else if (action === "REJECT") {
        if (transfer.status !== "DRAFT") {
          throw ApiError.conflict("Only DRAFT transfers can be rejected.");
        }

        transfer.status = "REJECTED";
        transfer.rejectedBy = actorId;
        transfer.rejectedAt = new Date();
        transfer.rejectionReason = note?.trim() || "Transfer rejected.";

        addAudit(transfer, "REJECTED", actorId, note);
      } else if (action === "DISPATCH") {
        if (transfer.status !== "APPROVED") {
          throw ApiError.conflict("Only APPROVED transfers can be dispatched.");
        }

        await assertWarehouseActive(transfer.sourceWarehouseId, session);
        await assertWarehouseActive(transfer.destinationWarehouseId, session);

        const source = await updateInventory(
          transfer.productId,
          transfer.variantId,
          transfer.sourceWarehouseId,
          -transfer.quantity,
          actorId,
          session,
          false,
        );

        transfer.status = "DISPATCHED";
        transfer.dispatchedBy = actorId;
        transfer.dispatchedAt = new Date();
        transfer.dispatchNote = note?.trim();

        await createMovementRecord({
          productId: transfer.productId,
          ...(transfer.variantId ? { variantId: transfer.variantId } : {}),
          sourceWarehouseId: transfer.sourceWarehouseId,
          destinationWarehouseId: transfer.destinationWarehouseId,
          quantity: transfer.quantity,
          sourceBefore: source.before,
          sourceAfter: source.after,
          reason: `Transfer ${transfer.transferNumber} dispatched`,
          transferId: transfer._id,
          adminId: actorId,
          session,
          idempotencyKey: `transfer-dispatch-${transfer._id}`,
        });

        addAudit(transfer, "DISPATCHED", actorId, note);
      } else if (action === "RECEIVE") {
        if (transfer.status !== "DISPATCHED") {
          throw ApiError.conflict("Only DISPATCHED transfers can be received.");
        }

        await assertWarehouseActive(transfer.destinationWarehouseId, session);

        const destination = await updateInventory(
          transfer.productId,
          transfer.variantId,
          transfer.destinationWarehouseId,
          transfer.quantity,
          actorId,
          session,
          true,
        );

        transfer.status = "RECEIVED";
        transfer.receivedBy = actorId;
        transfer.receivedAt = new Date();
        transfer.receiveNote = note?.trim();

        await createMovementRecord({
          productId: transfer.productId,
          ...(transfer.variantId ? { variantId: transfer.variantId } : {}),
          sourceWarehouseId: transfer.sourceWarehouseId,
          destinationWarehouseId: transfer.destinationWarehouseId,
          quantity: transfer.quantity,
          sourceBefore: destination.before,
          sourceAfter: destination.after,
          reason: `Transfer ${transfer.transferNumber} received`,
          transferId: transfer._id,
          adminId: actorId,
          session,
          idempotencyKey: `transfer-receive-${transfer._id}`,
        });

        addAudit(transfer, "RECEIVED", actorId, note);
      } else {
        if (transfer.status !== "DRAFT" && transfer.status !== "APPROVED") {
          throw ApiError.conflict(
            "Only DRAFT or APPROVED transfers can be cancelled.",
          );
        }

        transfer.status = "CANCELLED";
        transfer.cancelledBy = actorId;
        transfer.cancelledAt = new Date();
        transfer.cancellationReason = note?.trim() || "Transfer cancelled.";

        addAudit(transfer, "CANCELLED", actorId, note);
      }

      if (action === "DISPATCH" || action === "RECEIVE") {
        await syncInventoryStockQuantity(
          transfer.productId,
          transfer.variantId,
          session,
        );
      }

      await transfer.save({ session });
      updatedId = transfer._id;
    });

    if (!updatedId) {
      throw ApiError.conflict("Transfer action did not complete.");
    }

    return getStockTransfer(String(updatedId));
  } finally {
    await session.endSession();
  }
}

export function approveStockTransfer(
  id: string,
  adminId: string,
  note?: string,
) {
  return updateTransferStatus(id, adminId, "APPROVE", note);
}

export function rejectStockTransfer(
  id: string,
  adminId: string,
  reason: string,
) {
  if (!reason?.trim()) {
    throw ApiError.badRequest("A rejection reason is required.");
  }

  return updateTransferStatus(id, adminId, "REJECT", reason);
}

export function dispatchStockTransfer(
  id: string,
  adminId: string,
  note?: string,
) {
  return updateTransferStatus(id, adminId, "DISPATCH", note);
}

export function receiveStockTransfer(
  id: string,
  adminId: string,
  note?: string,
) {
  return updateTransferStatus(id, adminId, "RECEIVE", note);
}

export function cancelStockTransfer(
  id: string,
  adminId: string,
  reason: string,
) {
  if (!reason?.trim()) {
    throw ApiError.badRequest("A cancellation reason is required.");
  }

  return updateTransferStatus(id, adminId, "CANCEL", reason);
}

export type { StockTransferStatus };
