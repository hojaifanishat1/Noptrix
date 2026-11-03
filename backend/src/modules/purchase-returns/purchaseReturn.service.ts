import mongoose, { Types } from "mongoose";

import { ApiError } from "../../utils/ApiError";
import { PurchaseModel } from "../purchases/purchase.model";
import { InventoryModel } from "../inventory/inventory.model";
import { syncInventoryStockQuantity } from "../inventory/inventory.service";
import { StockMovementModel } from "../stock-movements/stockMovement.model";

import { PurchaseReturnModel } from "./purchaseReturn.model";

import type {
  PurchaseReturnAuditEntry,
  PurchaseReturnItem,
} from "./purchaseReturn.types";

import type {
  CreatePurchaseReturnBody,
  UpdatePurchaseReturnBody,
  PurchaseReturnQuery,
  ApprovePurchaseReturnBody,
  RejectPurchaseReturnBody,
  CompletePurchaseReturnBody,
  RecordPurchaseReturnRefundBody,
  CancelPurchaseReturnBody,
  PurchaseReturnSummaryQuery,
  PurchaseReturnItemBody,
} from "./purchaseReturn.validator";

type AdminId = string;

const roundMoney = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

function assertObjectId(value: string, label: string): void {
  if (!Types.ObjectId.isValid(value)) {
    throw ApiError.badRequest(`Invalid ${label}.`);
  }
}

function assertAdminId(adminId: AdminId): Types.ObjectId {
  assertObjectId(adminId, "admin ID");
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

function addAudit(
  returnRecord: {
    auditTrail: PurchaseReturnAuditEntry[];
  },
  action: PurchaseReturnAuditEntry["action"],
  adminId: Types.ObjectId,
  note?: string,
  metadata?: Record<string, unknown>,
): void {
  returnRecord.auditTrail.push({
    action,
    performedBy: adminId,
    performedAt: new Date(),
    ...(note ? { note } : {}),
    ...(metadata ? { metadata } : {}),
  });
}

function calculateRefundStatus(
  refundedAmount: number,
  totalAmount: number,
): "PENDING" | "PARTIALLY_REFUNDED" | "REFUNDED" {
  if (refundedAmount <= 0) return "PENDING";

  if (refundedAmount + 0.01 >= totalAmount) {
    return "REFUNDED";
  }

  return "PARTIALLY_REFUNDED";
}

function normalizePurchaseReturn(record: {
  auditTrail?: PurchaseReturnAuditEntry[];
}): void {
  if (!record.auditTrail) record.auditTrail = [];
}

async function findPurchaseReturn(
  id: string,
  session?: mongoose.ClientSession,
) {
  assertObjectId(id, "purchase return ID");

  let query = PurchaseReturnModel.findById(id).select("+auditTrail");

  if (session) query = query.session(session);

  const record = await query.exec();

  if (!record) {
    throw ApiError.notFound("Purchase return not found.");
  }

  normalizePurchaseReturn(record);

  return record;
}

async function generateReturnNumber(
  session?: mongoose.ClientSession,
): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = `PR-${Date.now().toString(36).toUpperCase()}-${new Types.ObjectId()
      .toString()
      .slice(-6)
      .toUpperCase()}`;

    let query = PurchaseReturnModel.exists({
      returnNumber: candidate,
    });

    if (session) query = query.session(session);

    if (!(await query)) return candidate;
  }

  throw ApiError.badRequest(
    "Could not generate a unique purchase return number.",
  );
}

interface PreparedReturnItems {
  items: PurchaseReturnItem[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
}

async function prepareReturnItems(
  purchase: {
    _id: Types.ObjectId;
    items: Array<{
      productId?: Types.ObjectId;
      variantId?: Types.ObjectId;
      sku?: string;
      productName: string;
      quantity: number;
      receivedQuantity: number;
      unitCost: number;
      discountAmount: number;
      taxAmount: number;
      lineSubtotal: number;
      lineTotal: number;
    }>;
  },
  inputItems: PurchaseReturnItemBody[],
  session: mongoose.ClientSession,
): Promise<PreparedReturnItems> {
  const prepared: PurchaseReturnItem[] = [];

  let subtotal = 0;
  let discountAmount = 0;
  let taxAmount = 0;
  let totalAmount = 0;

  for (const input of inputItems) {
    const purchaseItem = purchase.items.find(
      (item) =>
        String(item.productId ?? "") === input.productId &&
        String(item.variantId ?? "") === String(input.variantId ?? ""),
    );

    if (!purchaseItem?.productId) {
      throw ApiError.badRequest(
        `Linked product ${input.productId} is not part of this purchase.`,
      );
    }

    const alreadyReturned = await PurchaseReturnModel.aggregate<{
      quantity: number;
    }>([
      {
        $match: {
          purchaseId: purchase._id,
          status: {
            $nin: ["REJECTED", "CANCELLED"],
          },
        },
      },
      { $unwind: "$items" },
      {
        $match: {
          "items.productId": purchaseItem.productId,
          "items.variantId": purchaseItem.variantId ?? null,
        },
      },
      {
        $group: {
          _id: null,
          quantity: { $sum: "$items.quantity" },
        },
      },
    ]).session(session);

    const previouslyReturned = alreadyReturned[0]?.quantity ?? 0;
    const availableQuantity =
      purchaseItem.receivedQuantity - previouslyReturned;

    if (input.quantity > availableQuantity) {
      throw ApiError.badRequest(
        `Return quantity exceeds the remaining received quantity for ${purchaseItem.productName}. Available: ${Math.max(0, availableQuantity)}.`,
      );
    }

    const sourceQuantity = purchaseItem.quantity;

    const itemDiscount = roundMoney(
      (purchaseItem.discountAmount / sourceQuantity) * input.quantity,
    );

    const itemTax = roundMoney(
      (purchaseItem.taxAmount / sourceQuantity) * input.quantity,
    );

    const itemSubtotal = roundMoney(purchaseItem.unitCost * input.quantity);

    const itemTotal = roundMoney(itemSubtotal - itemDiscount + itemTax);

    prepared.push({
      productId: purchaseItem.productId,
      ...(purchaseItem.variantId ? { variantId: purchaseItem.variantId } : {}),
      ...(purchaseItem.sku ? { sku: purchaseItem.sku } : {}),
      productName: purchaseItem.productName,
      quantity: input.quantity,
      unitCost: purchaseItem.unitCost,
      discountAmount: itemDiscount,
      taxAmount: itemTax,
      lineTotal: itemTotal,
      reason: input.reason,
      ...(input.condition ? { condition: input.condition } : {}),
      restock: input.restock ?? true,
      ...(input.note ? { note: input.note } : {}),
    });

    subtotal = roundMoney(subtotal + itemSubtotal);
    discountAmount = roundMoney(discountAmount + itemDiscount);
    taxAmount = roundMoney(taxAmount + itemTax);
    totalAmount = roundMoney(totalAmount + itemTotal);
  }

  return {
    items: prepared,
    subtotal,
    discountAmount,
    taxAmount,
    totalAmount,
  };
}

export async function createPurchaseReturn(
  input: CreatePurchaseReturnBody,
  adminId: AdminId,
) {
  const requestedBy = assertAdminId(adminId);
  assertObjectId(input.purchaseId, "purchase ID");

  const session = await mongoose.startSession();

  try {
    let createdId: Types.ObjectId | undefined;

    await session.withTransaction(async () => {
      const purchase = await PurchaseModel.findById(input.purchaseId)
        .session(session)
        .exec();

      if (!purchase) {
        throw ApiError.notFound("Purchase not found.");
      }

      if (
        purchase.status === "DRAFT" ||
        purchase.status === "PENDING" ||
        purchase.status === "CANCELLED"
      ) {
        throw ApiError.badRequest(
          "Returns can only be created for an ordered or received purchase.",
        );
      }

      if (!purchase.items.some((item) => item.receivedQuantity > 0)) {
        throw ApiError.badRequest(
          "This purchase has no received quantity available for return.",
        );
      }

      const prepared = await prepareReturnItems(purchase, input.items, session);

      const returnNumber = await generateReturnNumber(session);

      const [record] = await PurchaseReturnModel.create(
        [
          {
            returnNumber,
            purchaseId: purchase._id,
            supplierId: purchase.supplierId,
            warehouseId: purchase.warehouseId,
            ...prepared,
            refundedAmount: 0,
            refundStatus: "PENDING",
            refunds: [],
            status: "REQUESTED",
            reason: input.reason,
            ...(input.reasonDetails
              ? { reasonDetails: input.reasonDetails }
              : {}),
            ...(input.supplierReference
              ? { supplierReference: input.supplierReference }
              : {}),
            ...(input.referenceNumber
              ? { referenceNumber: input.referenceNumber }
              : {}),
            ...(input.notes ? { notes: input.notes } : {}),
            requestedAt: new Date(),
            requestedBy,
            auditTrail: [
              {
                action: "CREATED",
                performedBy: requestedBy,
                performedAt: new Date(),
                note: "Purchase return requested.",
              },
            ],
          },
        ],
        { session },
      );

      createdId = record._id;
    });

    if (!createdId) {
      throw ApiError.badRequest("Purchase return could not be created.");
    }

    return findPurchaseReturn(String(createdId));
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw ApiError.badRequest(
        "A purchase return with this number already exists. Please retry.",
      );
    }

    throw error;
  } finally {
    await session.endSession();
  }
}

export async function listPurchaseReturns(filters: PurchaseReturnQuery) {
  const {
    page,
    limit,
    search,
    status,
    refundStatus,
    purchaseId,
    supplierId,
    warehouseId,
    requestedBy,
    fromDate,
    toDate,
    sortBy,
    sortOrder,
  } = filters;

  const query: Record<string, unknown> = {};

  if (status) query.status = status;
  if (refundStatus) query.refundStatus = refundStatus;
  if (purchaseId) query.purchaseId = purchaseId;
  if (supplierId) query.supplierId = supplierId;
  if (warehouseId) query.warehouseId = warehouseId;
  if (requestedBy) query.requestedBy = requestedBy;

  if (fromDate || toDate) {
    const requestedAt: Record<string, Date> = {};

    if (fromDate) requestedAt.$gte = new Date(fromDate);
    if (toDate) requestedAt.$lte = new Date(toDate);

    query.requestedAt = requestedAt;
  }

  if (search) {
    const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    query.$or = [
      { returnNumber: { $regex: safeSearch, $options: "i" } },
      { supplierReference: { $regex: safeSearch, $options: "i" } },
      { referenceNumber: { $regex: safeSearch, $options: "i" } },
    ];
  }

  const currentPage = page ?? 1;
  const pageSize = limit ?? 20;
  const skip = (currentPage - 1) * pageSize;

  const sort: Record<string, 1 | -1> = {
    [sortBy ?? "createdAt"]: sortOrder === "asc" ? 1 : -1,
  };

  const [items, total] = await Promise.all([
    PurchaseReturnModel.find(query)
      .sort(sort)
      .skip(skip)
      .limit(pageSize)
      .populate("purchaseId", "purchaseNumber status")
      .populate("supplierId", "name code")
      .populate("warehouseId", "name code")
      .populate("requestedBy", "name email")
      .lean()
      .exec(),
    PurchaseReturnModel.countDocuments(query).exec(),
  ]);

  return {
    items,
    pagination: {
      page: currentPage,
      limit: pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      hasNextPage: currentPage * pageSize < total,
      hasPreviousPage: currentPage > 1,
    },
  };
}

export async function getPurchaseReturnById(id: string) {
  return findPurchaseReturn(id);
}

export async function getPurchaseReturnByNumber(returnNumber: string) {
  const record = await PurchaseReturnModel.findOne({
    returnNumber: returnNumber.trim().toUpperCase(),
  })
    .select("+auditTrail")
    .populate("purchaseId", "purchaseNumber status")
    .populate("supplierId", "name code")
    .populate("warehouseId", "name code")
    .exec();

  if (!record) {
    throw ApiError.notFound("Purchase return not found.");
  }

  normalizePurchaseReturn(record);

  return record;
}

export async function updatePurchaseReturn(
  id: string,
  input: UpdatePurchaseReturnBody,
  adminId: AdminId,
) {
  const performedBy = assertAdminId(adminId);
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const record = await findPurchaseReturn(id, session);

      if (record.status !== "REQUESTED") {
        throw ApiError.badRequest(
          "Only requested purchase returns can be updated.",
        );
      }

      const purchase = await PurchaseModel.findById(record.purchaseId)
        .session(session)
        .exec();

      if (!purchase) {
        throw ApiError.notFound("Original purchase not found.");
      }

      if (input.items) {
        const prepared = await prepareReturnItems(
          purchase,
          input.items,
          session,
        );

        record.items = prepared.items as typeof record.items;
        record.subtotal = prepared.subtotal;
        record.discountAmount = prepared.discountAmount;
        record.taxAmount = prepared.taxAmount;
        record.totalAmount = prepared.totalAmount;
      }

      if (input.reason !== undefined) record.reason = input.reason;
      if (input.reasonDetails !== undefined) {
        record.reasonDetails = input.reasonDetails;
      }
      if (input.supplierReference !== undefined) {
        record.supplierReference = input.supplierReference;
      }
      if (input.referenceNumber !== undefined) {
        record.referenceNumber = input.referenceNumber;
      }
      if (input.notes !== undefined) record.notes = input.notes;

      addAudit(record, "UPDATED", performedBy, "Purchase return updated.");

      await record.save({ session });
    });

    return findPurchaseReturn(id);
  } finally {
    await session.endSession();
  }
}

export async function approvePurchaseReturn(
  id: string,
  input: ApprovePurchaseReturnBody,
  adminId: AdminId,
) {
  const performedBy = assertAdminId(adminId);
  const record = await findPurchaseReturn(id);

  if (record.status !== "REQUESTED") {
    throw ApiError.badRequest(
      "Only requested purchase returns can be approved.",
    );
  }

  record.status = "APPROVED";
  record.approvedBy = performedBy;
  record.approvedAt = new Date();

  addAudit(
    record,
    "APPROVED",
    performedBy,
    input.note ?? "Purchase return approved.",
  );

  await record.save();

  return findPurchaseReturn(id);
}

export async function rejectPurchaseReturn(
  id: string,
  input: RejectPurchaseReturnBody,
  adminId: AdminId,
) {
  const performedBy = assertAdminId(adminId);
  const record = await findPurchaseReturn(id);

  if (record.status !== "REQUESTED") {
    throw ApiError.badRequest(
      "Only requested purchase returns can be rejected.",
    );
  }

  record.status = "REJECTED";
  record.rejectedBy = performedBy;
  record.rejectedAt = new Date();
  record.rejectionReason = input.reason;

  addAudit(record, "REJECTED", performedBy, input.reason);

  await record.save();

  return findPurchaseReturn(id);
}

export async function completePurchaseReturn(
  id: string,
  input: CompletePurchaseReturnBody,
  adminId: AdminId,
) {
  const performedBy = assertAdminId(adminId);
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const record = await findPurchaseReturn(id, session);

      if (record.status !== "APPROVED") {
        throw ApiError.badRequest(
          "Only approved purchase returns can be completed.",
        );
      }

      for (const item of record.items) {
        if (!item.restock) continue;

        const inventory = await InventoryModel.findOne({
          productId: item.productId,
          ...(item.variantId
            ? { variantId: item.variantId }
            : { variantId: { $exists: false } }),
          warehouseId: record.warehouseId,
        })
          .session(session)
          .exec();

        if (!inventory) {
          throw ApiError.badRequest(
            `Inventory record not found for ${item.productName}.`,
          );
        }

        const quantityBefore = inventory.quantity;

        if (quantityBefore < item.quantity) {
          throw ApiError.badRequest(
            `Insufficient inventory for ${item.productName}. Available: ${quantityBefore}, return quantity: ${item.quantity}.`,
          );
        }

        const quantityAfter = quantityBefore - item.quantity;

        inventory.quantity = quantityAfter;
        await inventory.save({ session });

        await StockMovementModel.create(
          [
            {
              productId: item.productId,
              ...(item.variantId ? { variantId: item.variantId } : {}),
              warehouseId: record.warehouseId,
              type: "OUT",
              quantity: item.quantity,
              quantityBefore,
              quantityAfter,
              reason: `Supplier purchase return ${record.returnNumber}`,
              referenceType: "PURCHASE_RETURN",
              referenceId: record._id,
              createdBy: performedBy,
            },
          ],
          { session },
        );

        await syncInventoryStockQuantity(
          item.productId,
          item.variantId,
          session,
        );
      }

      record.status = "COMPLETED";
      record.completedBy = performedBy;
      record.completedAt = new Date();

      addAudit(
        record,
        "COMPLETED",
        performedBy,
        input.note ?? "Purchase return completed; inventory adjusted.",
      );

      await record.save({ session });
    });

    return findPurchaseReturn(id);
  } finally {
    await session.endSession();
  }
}

export async function recordPurchaseReturnRefund(
  id: string,
  input: RecordPurchaseReturnRefundBody,
  adminId: AdminId,
) {
  const performedBy = assertAdminId(adminId);
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const record = await findPurchaseReturn(id, session);

      if (record.status !== "COMPLETED") {
        throw ApiError.badRequest(
          "Refunds can only be recorded for completed purchase returns.",
        );
      }

      const remaining = roundMoney(record.totalAmount - record.refundedAmount);

      if (input.amount > remaining + 0.001) {
        throw ApiError.badRequest(
          `Refund exceeds the remaining refundable amount (${remaining}).`,
        );
      }

      record.refunds.push({
        amount: input.amount,
        method: input.method,
        ...(input.referenceNumber
          ? { referenceNumber: input.referenceNumber }
          : {}),
        refundedAt: input.refundedAt ? new Date(input.refundedAt) : new Date(),
        ...(input.note ? { note: input.note } : {}),
        recordedBy: performedBy,
      });

      record.refundedAmount = roundMoney(record.refundedAmount + input.amount);

      record.refundStatus = calculateRefundStatus(
        record.refundedAmount,
        record.totalAmount,
      );

      addAudit(
        record,
        "REFUND_RECORDED",
        performedBy,
        input.note ?? "Supplier refund recorded.",
        {
          amount: input.amount,
          method: input.method,
          referenceNumber: input.referenceNumber,
        },
      );

      await record.save({ session });
    });

    return findPurchaseReturn(id);
  } finally {
    await session.endSession();
  }
}

export async function cancelPurchaseReturn(
  id: string,
  input: CancelPurchaseReturnBody,
  adminId: AdminId,
) {
  const performedBy = assertAdminId(adminId);
  const record = await findPurchaseReturn(id);

  if (!["REQUESTED", "APPROVED"].includes(record.status)) {
    throw ApiError.badRequest(
      "Only requested or approved purchase returns can be cancelled.",
    );
  }

  if (record.refundedAmount > 0) {
    throw ApiError.badRequest(
      "A purchase return with recorded refunds cannot be cancelled.",
    );
  }

  record.status = "CANCELLED";
  record.cancelledBy = performedBy;
  record.cancelledAt = new Date();
  record.cancellationReason = input.reason;

  addAudit(record, "CANCELLED", performedBy, input.reason);

  await record.save();

  return findPurchaseReturn(id);
}

export async function getPurchaseReturnSummary(
  filters: PurchaseReturnSummaryQuery = {},
) {
  const match: Record<string, unknown> = {};

  if (filters.supplierId) {
    assertObjectId(filters.supplierId, "supplier ID");
    match.supplierId = new Types.ObjectId(filters.supplierId);
  }

  if (filters.warehouseId) {
    assertObjectId(filters.warehouseId, "warehouse ID");
    match.warehouseId = new Types.ObjectId(filters.warehouseId);
  }

  if (filters.fromDate || filters.toDate) {
    const requestedAt: Record<string, Date> = {};

    if (filters.fromDate) {
      requestedAt.$gte = new Date(filters.fromDate);
    }

    if (filters.toDate) {
      requestedAt.$lte = new Date(filters.toDate);
    }

    match.requestedAt = requestedAt;
  }

  const [result] = await PurchaseReturnModel.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalReturns: { $sum: 1 },
        totalReturnValue: { $sum: "$totalAmount" },
        totalRefunded: { $sum: "$refundedAmount" },
        requestedCount: {
          $sum: { $cond: [{ $eq: ["$status", "REQUESTED"] }, 1, 0] },
        },
        approvedCount: {
          $sum: { $cond: [{ $eq: ["$status", "APPROVED"] }, 1, 0] },
        },
        rejectedCount: {
          $sum: { $cond: [{ $eq: ["$status", "REJECTED"] }, 1, 0] },
        },
        completedCount: {
          $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] },
        },
        cancelledCount: {
          $sum: { $cond: [{ $eq: ["$status", "CANCELLED"] }, 1, 0] },
        },
        pendingRefundCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$status", "COMPLETED"] },
                  { $ne: ["$refundStatus", "REFUNDED"] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
  ]).exec();

  return (
    result ?? {
      totalReturns: 0,
      totalReturnValue: 0,
      totalRefunded: 0,
      requestedCount: 0,
      approvedCount: 0,
      rejectedCount: 0,
      completedCount: 0,
      cancelledCount: 0,
      pendingRefundCount: 0,
    }
  );
}
