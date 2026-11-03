import mongoose, { Types } from "mongoose";

import { ApiError } from "../../utils/ApiError";
import ProductModel from "../products/product.model";
import ProductVariantModel from "../product-variants/variant.model";
import { ensureSupplierCanReceivePurchase } from "../suppliers/supplier.service";
import WarehouseModel from "../warehouses/warehouse.model";
import { InventoryModel } from "../inventory/inventory.model";
import {
  assertStockReferences,
  getDefaultLowStockThreshold,
  syncInventoryStockQuantity,
} from "../inventory/inventory.service";
import { StockMovementModel } from "../stock-movements/stockMovement.model";
import { PurchaseModel } from "./purchase.model";

import type {
  PurchaseStatus,
  PurchasePaymentStatus,
  PurchaseAuditEntry,
} from "./purchase.types";

import type {
  CreatePurchaseBody,
  UpdatePurchaseBody,
  PurchaseQuery,
  ReceivePurchaseBody,
  RecordPurchasePaymentBody,
  ApprovePurchaseBody,
  OrderPurchaseBody,
  CancelPurchaseBody,
} from "./purchase.validator";

function assertObjectId(value: string, label: string): void {
  if (!Types.ObjectId.isValid(value)) {
    throw ApiError.badRequest(`Invalid ${label}.`);
  }
}

function assertAdminId(adminId: string): Types.ObjectId {
  assertObjectId(adminId, "authenticated admin ID");
  return new Types.ObjectId(adminId);
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
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
  purchase: {
    auditTrail: PurchaseAuditEntry[];
  },
  action: PurchaseAuditEntry["action"],
  adminId: Types.ObjectId,
  note?: string,
  metadata?: Record<string, unknown>,
): void {
  purchase.auditTrail.push({
    action,
    performedBy: adminId,
    performedAt: new Date(),
    ...(note ? { note } : {}),
    ...(metadata ? { metadata } : {}),
  });
}

function calculateTotals(
  items: Array<{
    quantity: number;
    unitCost: number;
    discountAmount: number;
    taxRate: number;
  }>,
  purchaseDiscount: number,
  shippingCost: number,
) {
  const subtotal = roundMoney(
    items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0),
  );

  const lineDiscountTotal = roundMoney(
    items.reduce((sum, item) => sum + item.discountAmount, 0),
  );

  if (lineDiscountTotal > subtotal) {
    throw ApiError.badRequest(
      "Item discounts cannot exceed the purchase subtotal.",
    );
  }

  const taxableSubtotal = roundMoney(subtotal - lineDiscountTotal);

  if (purchaseDiscount > taxableSubtotal) {
    throw ApiError.badRequest(
      "Purchase discount cannot exceed the subtotal after item discounts.",
    );
  }

  const taxAmount = roundMoney(
    items.reduce((sum, item) => {
      const lineGross = item.quantity * item.unitCost;
      const taxable = Math.max(0, lineGross - item.discountAmount);
      return sum + (taxable * item.taxRate) / 100;
    }, 0),
  );

  const grandTotal = roundMoney(
    taxableSubtotal - purchaseDiscount + taxAmount + shippingCost,
  );

  return {
    subtotal,
    lineDiscountTotal,
    taxAmount,
    grandTotal,
  };
}

function paymentStatusFor(
  amountPaid: number,
  grandTotal: number,
): PurchasePaymentStatus {
  if (amountPaid <= 0) return "UNPAID";
  if (amountPaid >= grandTotal) return "PAID";
  return "PARTIALLY_PAID";
}

function assertEditable(status: PurchaseStatus): void {
  if (status !== "DRAFT" && status !== "PENDING") {
    throw ApiError.conflict("Only draft or pending purchases can be edited.");
  }
}

async function ensureWarehouseActive(
  warehouseId: string,
  session?: mongoose.ClientSession,
) {
  assertObjectId(warehouseId, "warehouse ID");

  const warehouse = await WarehouseModel.findById(warehouseId)
    .select("_id status")
    .session(session ?? null)
    .lean()
    .exec();

  if (!warehouse) {
    throw ApiError.notFound("Warehouse not found.");
  }

  if (warehouse.status !== "ACTIVE") {
    throw ApiError.conflict("Warehouse is inactive.");
  }

  return warehouse;
}

async function prepareItems(
  input: CreatePurchaseBody["items"],
  session?: mongoose.ClientSession,
) {
  const productModel = ProductModel;
  const prepared = [];

  for (const item of input) {
    const product = item.productId
      ? await productModel
          .findById(item.productId)
          .select("_id name sku currency status trackInventory type")
          .session(session ?? null)
          .lean()
          .exec()
      : null;

    if (item.productId && !product) {
      throw ApiError.notFound(`Product not found: ${item.productId}.`);
    }

    const variant =
      item.variantId && item.productId
        ? await ProductVariantModel.findOne({
            _id: item.variantId,
            productId: item.productId,
            status: "ACTIVE",
          })
            .select("_id title sku trackInventory")
            .session(session ?? null)
            .lean()
            .exec()
        : null;

    if (item.variantId && !variant) {
      throw ApiError.notFound("Active product variant not found.");
    }

    if (product?.type === "VARIABLE" && !variant) {
      throw ApiError.badRequest(
        `Select a variant for variable product "${product.name}".`,
      );
    }

    if (product && product.type !== "VARIABLE" && variant) {
      throw ApiError.badRequest("Only variable products can have variants.");
    }
    if (variant && !variant.trackInventory) {
      throw ApiError.badRequest(
        `Inventory tracking is disabled for variant "${variant.title}".`,
      );
    }

    if (
      item.variantId &&
      (!product || !mongoose.isValidObjectId(item.variantId))
    ) {
      throw ApiError.badRequest("Invalid product variant ID.");
    }

    if (item.discountAmount > item.quantity * item.unitCost) {
      throw ApiError.badRequest(
        `Discount exceeds line subtotal for ${product?.name ?? item.productName}.`,
      );
    }

    const productName = product
      ? variant
        ? `${product.name} - ${variant.title}`
        : product.name
      : item.productName?.trim();
    if (!productName) {
      throw ApiError.badRequest(
        "Enter a product name when purchasing an item not in the catalog.",
      );
    }

    const lineSubtotal = roundMoney(item.quantity * item.unitCost);
    const taxableAmount = roundMoney(lineSubtotal - item.discountAmount);
    const taxAmount = roundMoney((taxableAmount * item.taxRate) / 100);

    prepared.push({
      ...(item.productId
        ? { productId: new Types.ObjectId(item.productId) }
        : {}),
      ...(item.variantId
        ? { variantId: new Types.ObjectId(item.variantId) }
        : {}),
      sku: variant?.sku ?? product?.sku ?? (item.sku?.trim() || undefined),
      productName,
      quantity: item.quantity,
      receivedQuantity: 0,
      unitCost: item.unitCost,
      discountAmount: item.discountAmount,
      taxRate: item.taxRate,
      taxAmount,
      lineSubtotal,
      lineTotal: roundMoney(taxableAmount + taxAmount),
    });
  }

  return prepared;
}

export async function linkPurchaseItemToProduct(
  purchaseId: string,
  itemId: string,
  productId: string,
  variantId: string | undefined,
  adminId: string,
) {
  assertObjectId(purchaseId, "purchase ID");
  assertObjectId(itemId, "purchase item ID");
  assertObjectId(productId, "product ID");
  if (variantId) assertObjectId(variantId, "variant ID");
  const adminObjectId = assertAdminId(adminId);

  const purchase = await PurchaseModel.findById(purchaseId)
    .select("+auditTrail")
    .exec();

  if (!purchase) throw ApiError.notFound("Purchase not found.");
  if (purchase.status === "CANCELLED" || purchase.status === "RECEIVED") {
    throw ApiError.conflict(
      "Products can only be linked to open purchase items.",
    );
  }

  const item = purchase.items.find(
    (purchaseItem) => String(purchaseItem._id) === itemId,
  );

  if (!item) throw ApiError.notFound("Purchase item not found.");
  if (item.productId) {
    throw ApiError.conflict(
      "This purchase item is already linked to a product.",
    );
  }
  if (item.receivedQuantity > 0) {
    throw ApiError.conflict("A received purchase item cannot be relinked.");
  }

  const product = await ProductModel.findById(productId)
    .select("_id name sku status type")
    .lean()
    .exec();

  if (!product) throw ApiError.notFound("Product not found.");
  if (product.status === "ARCHIVED") {
    throw ApiError.conflict(
      "An archived product cannot be linked to a purchase.",
    );
  }

  const variant = variantId
    ? await ProductVariantModel.findOne({
        _id: variantId,
        productId: product._id,
        status: "ACTIVE",
      })
        .select("_id title sku trackInventory")
        .lean()
        .exec()
    : null;

  if (variantId && !variant) {
    throw ApiError.notFound("Active product variant not found.");
  }
  if (product.type === "VARIABLE" && !variant) {
    throw ApiError.badRequest("Select a variant for this variable product.");
  }
  if (product.type !== "VARIABLE" && variant) {
    throw ApiError.badRequest("Only variable products can have variants.");
  }
  if (variant && !variant.trackInventory) {
    throw ApiError.badRequest(
      "Inventory tracking is disabled for this variant.",
    );
  }

  item.productId = product._id;
  item.variantId = variant?._id;
  item.productName = variant
    ? `${product.name} - ${variant.title}`
    : product.name;
  item.sku = item.sku || variant?.sku || product.sku;
  purchase.updatedBy = adminObjectId;
  addAudit(
    purchase,
    "UPDATED",
    adminObjectId,
    `Purchase item linked to catalog product ${product.name}.`,
    {
      purchaseItemId: String(item._id),
      productId: product._id.toHexString(),
    },
  );

  await purchase.save();
  return purchase.toObject();
}

function toPlainPurchase(purchase: unknown) {
  return purchase;
}

export async function createPurchase(
  input: CreatePurchaseBody,
  adminId: string,
) {
  const adminObjectId = assertAdminId(adminId);

  await ensureSupplierCanReceivePurchase(input.supplierId);
  await ensureWarehouseActive(input.warehouseId);

  const items = await prepareItems(input.items);
  const purchaseDiscount = input.discountAmount ?? 0;
  const shippingCost = input.shippingCost ?? 0;

  const totals = calculateTotals(items, purchaseDiscount, shippingCost);

  const purchaseNumber = `PUR-${Date.now()}-${new Types.ObjectId().toHexString().slice(-6).toUpperCase()}`;

  const purchase = new PurchaseModel({
    purchaseNumber,
    supplierId: new Types.ObjectId(input.supplierId),
    warehouseId: new Types.ObjectId(input.warehouseId),
    items,
    subtotal: totals.subtotal,
    discountAmount: purchaseDiscount,
    taxAmount: totals.taxAmount,
    shippingCost,
    grandTotal: totals.grandTotal,
    amountPaid: 0,
    amountDue: totals.grandTotal,
    paymentStatus: "UNPAID",
    status: "DRAFT",
    currency: input.currency ?? "BDT",
    expectedDeliveryDate: input.expectedDeliveryDate,
    notes: input.notes,
    referenceNumber: input.referenceNumber,
    createdBy: adminObjectId,
    auditTrail: [],
  });

  addAudit(purchase, "CREATED", adminObjectId, "Purchase created.");

  try {
    await purchase.save();
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw ApiError.conflict(
        "A purchase with this generated number already exists. Retry the request.",
      );
    }
    throw error;
  }

  return toPlainPurchase(purchase.toObject());
}

export async function listPurchases(filters: PurchaseQuery) {
  const query: Record<string, unknown> = {};

  if (filters.supplierId) {
    assertObjectId(filters.supplierId, "supplier ID");
    query.supplierId = new Types.ObjectId(filters.supplierId);
  }

  if (filters.warehouseId) {
    assertObjectId(filters.warehouseId, "warehouse ID");
    query.warehouseId = new Types.ObjectId(filters.warehouseId);
  }

  if (filters.status) query.status = filters.status;
  if (filters.paymentStatus) {
    query.paymentStatus = filters.paymentStatus;
  }

  if (filters.startDate || filters.endDate) {
    const createdAt: Record<string, Date> = {};
    if (filters.startDate) createdAt.$gte = filters.startDate;
    if (filters.endDate) createdAt.$lte = filters.endDate;
    query.createdAt = createdAt;
  }

  if (filters.search?.trim()) {
    const escaped = filters.search
      .trim()
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    query.$or = [
      { purchaseNumber: { $regex: escaped, $options: "i" } },
      { referenceNumber: { $regex: escaped, $options: "i" } },
    ];
  }

  const page = filters.page ?? 1;
  const limit = filters.limit ?? 20;
  const direction = filters.sortOrder === "asc" ? 1 : -1;

  const [items, total] = await Promise.all([
    PurchaseModel.find(query)
      .select("-auditTrail")
      .populate("supplierId", "name code status")
      .populate("warehouseId", "name code")
      .populate("createdBy", "name email")
      .sort({ [filters.sortBy ?? "createdAt"]: direction, _id: direction })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()
      .exec(),
    PurchaseModel.countDocuments(query).exec(),
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

export async function getPurchaseById(id: string) {
  assertObjectId(id, "purchase ID");

  const purchase = await PurchaseModel.findById(id)
    .select("-auditTrail")
    .populate("supplierId", "name code status email phone")
    .populate("warehouseId", "name code status")
    .populate("items.productId", "name sku")
    .populate("items.variantId")
    .populate("createdBy", "name email")
    .populate("updatedBy", "name email")
    .populate("approvedBy", "name email")
    .populate("receivedBy", "name email")
    .populate("cancelledBy", "name email")
    .lean()
    .exec();

  if (!purchase) {
    throw ApiError.notFound("Purchase not found.");
  }

  return purchase;
}

export async function getPurchaseByNumber(purchaseNumber: string) {
  const normalized = purchaseNumber.trim().toUpperCase();

  if (!normalized) {
    throw ApiError.badRequest("Purchase number is required.");
  }

  const purchase = await PurchaseModel.findOne({
    purchaseNumber: normalized,
  })
    .select("-auditTrail")
    .populate("supplierId", "name code status")
    .populate("warehouseId", "name code status")
    .lean()
    .exec();

  if (!purchase) {
    throw ApiError.notFound("Purchase not found.");
  }

  return purchase;
}

export async function updatePurchase(
  id: string,
  input: UpdatePurchaseBody,
  adminId: string,
) {
  assertObjectId(id, "purchase ID");
  const adminObjectId = assertAdminId(adminId);

  const purchase = await PurchaseModel.findById(id)
    .select("+auditTrail")
    .exec();

  if (!purchase) throw ApiError.notFound("Purchase not found.");
  assertEditable(purchase.status);

  if (input.supplierId) {
    await ensureSupplierCanReceivePurchase(input.supplierId);
    purchase.supplierId = new Types.ObjectId(input.supplierId);
  }

  if (input.warehouseId) {
    await ensureWarehouseActive(input.warehouseId);
    purchase.warehouseId = new Types.ObjectId(input.warehouseId);
  }

  if (input.items) {
    purchase.items = (await prepareItems(input.items)) as typeof purchase.items;
  }

  if (input.discountAmount !== undefined) {
    purchase.discountAmount = input.discountAmount;
  }

  if (input.shippingCost !== undefined) {
    purchase.shippingCost = input.shippingCost;
  }

  if (input.currency !== undefined) purchase.currency = input.currency;
  if (input.expectedDeliveryDate !== undefined) {
    purchase.expectedDeliveryDate = input.expectedDeliveryDate;
  }
  if (input.notes !== undefined) purchase.notes = input.notes;
  if (input.referenceNumber !== undefined) {
    purchase.referenceNumber = input.referenceNumber;
  }

  const totals = calculateTotals(
    purchase.items.map((item) => ({
      quantity: item.quantity,
      unitCost: item.unitCost,
      discountAmount: item.discountAmount,
      taxRate: item.taxRate,
    })),
    purchase.discountAmount,
    purchase.shippingCost,
  );

  purchase.subtotal = totals.subtotal;
  purchase.taxAmount = totals.taxAmount;
  purchase.grandTotal = totals.grandTotal;

  if (purchase.amountPaid > purchase.grandTotal) {
    throw ApiError.conflict(
      "The new purchase total cannot be less than the amount already paid.",
    );
  }

  purchase.amountDue = roundMoney(purchase.grandTotal - purchase.amountPaid);
  purchase.paymentStatus = paymentStatusFor(
    purchase.amountPaid,
    purchase.grandTotal,
  );
  purchase.updatedBy = adminObjectId;

  addAudit(purchase, "UPDATED", adminObjectId, "Purchase updated.");
  await purchase.save();

  return purchase.toObject();
}

export async function approvePurchase(
  id: string,
  input: ApprovePurchaseBody,
  adminId: string,
) {
  assertObjectId(id, "purchase ID");
  const adminObjectId = assertAdminId(adminId);

  const purchase = await PurchaseModel.findById(id)
    .select("+auditTrail")
    .exec();

  if (!purchase) throw ApiError.notFound("Purchase not found.");

  if (purchase.status !== "DRAFT" && purchase.status !== "PENDING") {
    throw ApiError.conflict("Only draft or pending purchases can be approved.");
  }

  await ensureSupplierCanReceivePurchase(String(purchase.supplierId));
  await ensureWarehouseActive(String(purchase.warehouseId));

  purchase.status = "APPROVED";
  purchase.approvedAt = new Date();
  purchase.approvedBy = adminObjectId;
  purchase.updatedBy = adminObjectId;

  addAudit(
    purchase,
    "APPROVED",
    adminObjectId,
    input.note ?? "Purchase approved.",
  );

  await purchase.save();
  return purchase.toObject();
}

export async function orderPurchase(
  id: string,
  input: OrderPurchaseBody,
  adminId: string,
) {
  assertObjectId(id, "purchase ID");
  const adminObjectId = assertAdminId(adminId);

  const purchase = await PurchaseModel.findById(id)
    .select("+auditTrail")
    .exec();

  if (!purchase) throw ApiError.notFound("Purchase not found.");

  if (purchase.status !== "APPROVED") {
    throw ApiError.conflict(
      "Only approved purchases can be marked as ordered.",
    );
  }

  purchase.status = "ORDERED";
  purchase.orderedAt = new Date();
  purchase.updatedBy = adminObjectId;

  if (input.expectedDeliveryDate) {
    purchase.expectedDeliveryDate = input.expectedDeliveryDate;
  }

  addAudit(
    purchase,
    "ORDERED",
    adminObjectId,
    input.note ?? "Purchase order placed.",
  );

  await purchase.save();
  return purchase.toObject();
}

export async function receivePurchase(
  id: string,
  input: ReceivePurchaseBody,
  adminId: string,
) {
  assertObjectId(id, "purchase ID");
  const adminObjectId = assertAdminId(adminId);

  const session = await mongoose.startSession();

  try {
    let result: unknown;

    await session.withTransaction(async () => {
      const purchase = await PurchaseModel.findById(id)
        .select("+auditTrail")
        .session(session)
        .exec();

      if (!purchase) throw ApiError.notFound("Purchase not found.");

      if (
        purchase.status !== "ORDERED" &&
        purchase.status !== "PARTIALLY_RECEIVED"
      ) {
        throw ApiError.conflict(
          "Only ordered or partially received purchases can receive stock.",
        );
      }

      await ensureWarehouseActive(String(purchase.warehouseId), session);

      const receivedByStockItem = new Map<
        string,
        { productId: string; variantId?: string; quantity: number }
      >();

      for (const receivedItem of input.items) {
        assertObjectId(receivedItem.productId, "product ID");
        if (receivedItem.variantId) {
          assertObjectId(receivedItem.variantId, "variant ID");
        }

        const key = `${receivedItem.productId}:${receivedItem.variantId ?? ""}`;
        const existing = receivedByStockItem.get(key);
        receivedByStockItem.set(key, {
          productId: receivedItem.productId,
          ...(receivedItem.variantId
            ? { variantId: receivedItem.variantId }
            : {}),
          quantity: (existing?.quantity ?? 0) + receivedItem.quantity,
        });
      }

      const receivingRecordId = new Types.ObjectId();
      const receivedItems: Array<{
        productId: Types.ObjectId;
        variantId?: Types.ObjectId;
        quantity: number;
      }> = [];

      for (const {
        productId,
        variantId,
        quantity,
      } of receivedByStockItem.values()) {
        const productObjectId = new Types.ObjectId(productId);
        const variantObjectId = variantId
          ? new Types.ObjectId(variantId)
          : undefined;
        const matchingItems = purchase.items.filter(
          (item) =>
            String(item.productId) === productId &&
            String(item.variantId ?? "") === (variantId ?? ""),
        );

        if (matchingItems.length === 0) {
          throw ApiError.badRequest(
            `Product ${productId}${variantId ? ` variant ${variantId}` : ""} is not part of this purchase.`,
          );
        }

        const remaining = matchingItems.reduce(
          (sum, item) => sum + item.quantity - item.receivedQuantity,
          0,
        );

        if (quantity > remaining) {
          throw ApiError.conflict(
            `Received quantity exceeds the outstanding quantity for product ${productId}.`,
          );
        }

        await assertStockReferences(
          productObjectId,
          purchase.warehouseId,
          session,
          variantObjectId,
        );

        let quantityToAllocate = quantity;

        for (const item of matchingItems) {
          if (quantityToAllocate <= 0) break;

          const itemRemaining = item.quantity - item.receivedQuantity;
          if (itemRemaining <= 0) continue;

          const allocated = Math.min(quantityToAllocate, itemRemaining);
          item.receivedQuantity += allocated;
          quantityToAllocate -= allocated;
        }

        const inventory = await InventoryModel.findOne({
          productId: productObjectId,
          ...(variantObjectId
            ? { variantId: variantObjectId }
            : { variantId: { $exists: false } }),
          warehouseId: purchase.warehouseId,
        })
          .session(session)
          .exec();

        let inventoryBefore = 0;
        let reservedQuantity = 0;

        if (inventory) {
          inventoryBefore = inventory.quantity;
          reservedQuantity = inventory.reservedQuantity;
        }

        const inventoryAfter = inventoryBefore + quantity;

        if (
          !Number.isSafeInteger(inventoryAfter) ||
          inventoryAfter < reservedQuantity
        ) {
          throw ApiError.conflict(
            "Receiving would result in an invalid inventory quantity.",
          );
        }

        if (inventory) {
          const updateResult = await InventoryModel.updateOne(
            {
              _id: inventory._id,
              quantity: inventoryBefore,
              reservedQuantity,
            },
            { $set: { quantity: inventoryAfter } },
            { session },
          ).exec();

          if (updateResult.modifiedCount !== 1) {
            throw ApiError.conflict(
              "Inventory changed concurrently. Retry receiving.",
            );
          }
        } else {
          const lowStockThreshold = await getDefaultLowStockThreshold(
            variantObjectId,
            session,
          );
          await InventoryModel.create(
            [
              {
                productId: productObjectId,
                ...(variantObjectId ? { variantId: variantObjectId } : {}),
                warehouseId: purchase.warehouseId,
                quantity: inventoryAfter,
                reservedQuantity: 0,
                lowStockThreshold,
              },
            ],
            { session },
          );
        }

        const idempotencyKey = `purchase:${purchase._id}:receive:${receivingRecordId}:${productId}:${variantId ?? "product"}`;

        await StockMovementModel.create(
          [
            {
              productId: productObjectId,
              ...(variantObjectId ? { variantId: variantObjectId } : {}),
              warehouseId: purchase.warehouseId,
              type: "IN",
              quantity,
              quantityBefore: inventoryBefore,
              quantityAfter: inventoryAfter,
              reason: `Purchase received: ${purchase.purchaseNumber}`,
              referenceType: "PURCHASE",
              referenceId: purchase._id,
              idempotencyKey,
              createdBy: adminObjectId,
            },
          ],
          { session },
        );

        await syncInventoryStockQuantity(
          productObjectId,
          variantObjectId,
          session,
        );

        receivedItems.push({
          productId: productObjectId,
          ...(variantObjectId ? { variantId: variantObjectId } : {}),
          quantity,
        });
      }

      const fullyReceived = purchase.items.every(
        (item) => item.receivedQuantity >= item.quantity,
      );

      purchase.status = fullyReceived ? "RECEIVED" : "PARTIALLY_RECEIVED";

      if (fullyReceived) {
        purchase.receivedAt = new Date();
        purchase.receivedBy = adminObjectId;
      }

      purchase.receivingHistory.push({
        _id: receivingRecordId,
        items: receivedItems,
        note: input.note,
        receivedBy: adminObjectId,
        receivedAt: new Date(),
      });

      purchase.updatedBy = adminObjectId;

      addAudit(
        purchase,
        "RECEIVED",
        adminObjectId,
        input.note ?? "Purchase stock received.",
        {
          receivingRecordId: receivingRecordId.toHexString(),
          items: receivedItems.map((item) => ({
            productId: item.productId.toHexString(),
            quantity: item.quantity,
          })),
          fullyReceived,
        },
      );

      await purchase.save({ session });
      result = purchase.toObject();
    });

    if (!result) {
      throw ApiError.conflict(
        "Purchase receiving transaction did not complete.",
      );
    }

    return result;
  } finally {
    await session.endSession();
  }
}

export async function recordPurchasePayment(
  id: string,
  input: RecordPurchasePaymentBody,
  adminId: string,
) {
  assertObjectId(id, "purchase ID");
  const adminObjectId = assertAdminId(adminId);

  const session = await mongoose.startSession();

  try {
    let result: unknown;

    await session.withTransaction(async () => {
      const purchase = await PurchaseModel.findById(id)
        .select("+auditTrail")
        .session(session)
        .exec();

      if (!purchase) throw ApiError.notFound("Purchase not found.");

      if (purchase.status === "CANCELLED") {
        throw ApiError.conflict(
          "Payments cannot be recorded for cancelled purchases.",
        );
      }

      const amount = roundMoney(input.amount);
      const newAmountPaid = roundMoney(purchase.amountPaid + amount);

      if (newAmountPaid > purchase.grandTotal) {
        throw ApiError.badRequest(
          "Payment exceeds the outstanding purchase balance.",
        );
      }

      purchase.payments.push({
        amount,
        method: input.method,
        referenceNumber: input.referenceNumber,
        paidAt: input.paidAt ?? new Date(),
        note: input.note,
        recordedBy: adminObjectId,
      });

      purchase.amountPaid = newAmountPaid;
      purchase.amountDue = roundMoney(purchase.grandTotal - newAmountPaid);
      purchase.paymentStatus = paymentStatusFor(
        purchase.amountPaid,
        purchase.grandTotal,
      );
      purchase.updatedBy = adminObjectId;

      addAudit(
        purchase,
        "PAYMENT_RECORDED",
        adminObjectId,
        input.note ?? "Purchase payment recorded.",
        {
          amount,
          method: input.method,
          amountPaid: purchase.amountPaid,
          amountDue: purchase.amountDue,
        },
      );

      await purchase.save({ session });
      result = purchase.toObject();
    });

    if (!result) {
      throw ApiError.conflict("Purchase payment transaction did not complete.");
    }

    return result;
  } finally {
    await session.endSession();
  }
}

export async function cancelPurchase(
  id: string,
  input: CancelPurchaseBody,
  adminId: string,
) {
  assertObjectId(id, "purchase ID");
  const adminObjectId = assertAdminId(adminId);

  const purchase = await PurchaseModel.findById(id)
    .select("+auditTrail")
    .exec();

  if (!purchase) throw ApiError.notFound("Purchase not found.");

  if (
    purchase.status === "RECEIVED" ||
    purchase.status === "PARTIALLY_RECEIVED"
  ) {
    throw ApiError.conflict(
      "Received purchases cannot be cancelled. Use the purchase-return workflow for received stock.",
    );
  }

  if (purchase.status === "CANCELLED") {
    throw ApiError.conflict("Purchase is already cancelled.");
  }

  if (purchase.amountPaid > 0) {
    throw ApiError.conflict(
      "This purchase has recorded payments. Resolve the payment or refund workflow before cancellation.",
    );
  }

  purchase.status = "CANCELLED";
  purchase.cancelledAt = new Date();
  purchase.cancelledBy = adminObjectId;
  purchase.cancellationReason = input.reason.trim();
  purchase.updatedBy = adminObjectId;

  addAudit(purchase, "CANCELLED", adminObjectId, input.reason.trim());

  await purchase.save();
  return purchase.toObject();
}

export async function getPurchaseSummary() {
  const [total, byStatus, paymentTotals] = await Promise.all([
    PurchaseModel.countDocuments({}).exec(),
    PurchaseModel.aggregate<{
      _id: PurchaseStatus;
      count: number;
      grandTotal: number;
    }>([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          grandTotal: { $sum: "$grandTotal" },
        },
      },
    ]).exec(),
    PurchaseModel.aggregate<{
      _id: PurchasePaymentStatus;
      count: number;
      amountPaid: number;
      amountDue: number;
    }>([
      {
        $group: {
          _id: "$paymentStatus",
          count: { $sum: 1 },
          amountPaid: { $sum: "$amountPaid" },
          amountDue: { $sum: "$amountDue" },
        },
      },
    ]).exec(),
  ]);

  return {
    total,
    byStatus,
    paymentSummary: paymentTotals,
  };
}
