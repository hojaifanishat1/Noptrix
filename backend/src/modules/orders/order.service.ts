import { randomBytes } from "node:crypto";
import mongoose, { Types, type HydratedDocument } from "mongoose";

import { ApiError } from "../../utils/ApiError";

import CheckoutModel from "../checkout/checkout.model";
import { InventoryModel } from "../inventory/inventory.model";
import { syncInventoryStockQuantity } from "../inventory/inventory.service";
import { awardLoyaltyPointsForOrder } from "../loyalty/loyalty.service";
import { StockMovementModel } from "../stock-movements/stockMovement.model";
import { WarehouseModel } from "../warehouses/warehouse.model";
import OrderModel from "./order.model";

import type {
  Order,
  OrderItem,
  OrderListFilters,
  OrderStatus,
  UpdateOrderStatusInput,
} from "./order.types";

const toObjectId = (value: string): Types.ObjectId => {
  if (!/^[a-f\d]{24}$/i.test(value)) {
    throw ApiError.badRequest("Invalid MongoDB ObjectId.");
  }

  return new Types.ObjectId(value);
};

const normalizeUserId = (userId: string): Types.ObjectId => toObjectId(userId);

const generateOrderNumber = (): string => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = randomBytes(5).toString("hex").toUpperCase();

  return `NPT-${timestamp}-${random}`;
};

const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["READY_TO_SHIP", "CANCELLED"],
  READY_TO_SHIP: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: ["RETURN_REQUESTED", "RETURNED"],
  CANCELLED: [],
  RETURN_REQUESTED: ["RETURNED"],
  RETURNED: [],
};

async function reserveInventory(
  item: OrderItem,
  quantity: number,
  session: mongoose.ClientSession,
  allowPartial: boolean,
) {
  const warehouses = await WarehouseModel.find({ status: "ACTIVE" })
    .select("_id")
    .sort({ isDefault: -1, name: 1, _id: 1 })
    .session(session)
    .lean()
    .exec();

  const allocations: NonNullable<OrderItem["inventoryAllocations"]> = [];
  let remaining = quantity;

  for (const warehouse of warehouses) {
    if (remaining === 0) break;

    const inventory = await InventoryModel.findOne({
      productId: item.productId,
      ...(item.variantId
        ? { variantId: item.variantId }
        : { variantId: { $exists: false } }),
      warehouseId: warehouse._id,
    })
      .session(session)
      .lean()
      .exec();

    if (!inventory) continue;

    const available = Math.max(
      0,
      inventory.quantity - inventory.reservedQuantity,
    );
    const allocated = Math.min(remaining, available);

    if (allocated === 0) continue;

    const result = await InventoryModel.updateOne(
      {
        _id: inventory._id,
        quantity: inventory.quantity,
        reservedQuantity: inventory.reservedQuantity,
      },
      { $inc: { reservedQuantity: allocated } },
      { session },
    ).exec();

    if (result.modifiedCount !== 1) {
      throw ApiError.conflict(
        "Inventory changed while reserving stock. Please retry.",
      );
    }

    allocations.push({ warehouseId: warehouse._id, quantity: allocated });
    remaining -= allocated;
  }

  if (remaining > 0 && !allowPartial) {
    throw ApiError.conflict(
      `Insufficient available stock for "${item.productName}".`,
    );
  }

  return allocations;
}

export async function releaseOrderInventoryAllocations(
  order: Pick<Order, "items">,
  session: mongoose.ClientSession,
): Promise<void> {
  for (const item of order.items) {
    for (const allocation of item.inventoryAllocations ?? []) {
      const result = await InventoryModel.updateOne(
        {
          productId: item.productId,
          ...(item.variantId
            ? { variantId: item.variantId }
            : { variantId: { $exists: false } }),
          warehouseId: allocation.warehouseId,
          reservedQuantity: { $gte: allocation.quantity },
        },
        { $inc: { reservedQuantity: -allocation.quantity } },
        { session },
      ).exec();

      if (result.modifiedCount !== 1) {
        throw ApiError.conflict(
          "Could not release the reserved order stock. Please reconcile inventory.",
        );
      }
    }
  }
}

async function fulfillOrderInventory(
  order: Order & { _id: Types.ObjectId },
  session: mongoose.ClientSession,
): Promise<void> {
  for (const item of order.items) {
    if (item.trackInventory === false) continue;

    const allocations = [...(item.inventoryAllocations ?? [])];
    const alreadyAllocated = allocations.reduce(
      (total, allocation) => total + allocation.quantity,
      0,
    );
    const remaining = item.quantity - alreadyAllocated;

    if (remaining > 0) {
      allocations.push(
        ...(await reserveInventory(item, remaining, session, false)),
      );
      item.inventoryAllocations = allocations;
    }

    for (const allocation of allocations) {
      const inventory = await InventoryModel.findOne({
        productId: item.productId,
        ...(item.variantId
          ? { variantId: item.variantId }
          : { variantId: { $exists: false } }),
        warehouseId: allocation.warehouseId,
      })
        .session(session)
        .exec();

      if (
        !inventory ||
        inventory.quantity < allocation.quantity ||
        inventory.reservedQuantity < allocation.quantity
      ) {
        throw ApiError.conflict(
          "Reserved stock is no longer available for fulfillment.",
        );
      }

      const before = inventory.quantity;
      const after = before - allocation.quantity;
      const result = await InventoryModel.updateOne(
        {
          _id: inventory._id,
          quantity: before,
          reservedQuantity: inventory.reservedQuantity,
        },
        {
          $inc: {
            quantity: -allocation.quantity,
            reservedQuantity: -allocation.quantity,
          },
        },
        { session },
      ).exec();

      if (result.modifiedCount !== 1) {
        throw ApiError.conflict(
          "Inventory changed while fulfilling the order. Please retry.",
        );
      }

      await StockMovementModel.create(
        [
          {
            productId: item.productId,
            ...(item.variantId ? { variantId: item.variantId } : {}),
            warehouseId: allocation.warehouseId,
            type: "OUT",
            quantity: allocation.quantity,
            quantityBefore: before,
            quantityAfter: after,
            reason: `Order fulfilled: ${order._id.toString()}`,
            referenceType: "ORDER",
            referenceId: order._id,
            idempotencyKey: `order:${order._id.toString()}:fulfill:${item._id?.toString()}:${allocation.warehouseId.toString()}`,
          },
        ],
        { session },
      );

      await syncInventoryStockQuantity(item.productId, item.variantId, session);
    }
  }
}

export const createOrderFromCheckout = async (
  userIdInput: string,
  checkoutIdInput: string,
) => {
  const userId = normalizeUserId(userIdInput);
  const checkoutId = toObjectId(checkoutIdInput);

  const existingOrder = await OrderModel.findOne({
    checkoutId,
    userId,
  });

  if (existingOrder) return existingOrder;

  const session = await mongoose.startSession();
  let createdOrder: HydratedDocument<Order> | undefined;

  try {
    await session.withTransaction(async () => {
      const existing = await OrderModel.findOne({
        checkoutId,
        userId,
      }).session(session);

      if (existing) {
        createdOrder = existing;
        return;
      }

      const checkout = await CheckoutModel.findOne({
        _id: checkoutId,
        userId,
      }).session(session);

      if (!checkout) {
        throw ApiError.notFound("Checkout not found.");
      }

      if (checkout.status !== "PENDING") {
        throw ApiError.badRequest(
          "Only a pending checkout can be converted to an order.",
        );
      }

      if (checkout.expiresAt && checkout.expiresAt.getTime() <= Date.now()) {
        throw ApiError.badRequest("Checkout has expired.");
      }

      if (checkout.paymentStatus === "FAILED") {
        throw ApiError.badRequest(
          "Cannot create an order from a failed payment.",
        );
      }

      const orderItems: OrderItem[] = [];

      for (const item of checkout.items) {
        const orderItem: OrderItem = {
          productId: item.productId,
          ...(item.sellerId ? { sellerId: item.sellerId } : {}),
          ...(item.variantId ? { variantId: item.variantId } : {}),
          ...(item.sku ? { sku: item.sku } : {}),
          productName: item.productName,
          ...(item.variantName ? { variantName: item.variantName } : {}),
          quantity: item.quantity,
          trackInventory: item.trackInventory !== false,
          allowOverselling: item.allowOverselling === true,
          inventoryAllocations: [],
          fulfilledQuantity: 0,
          returnedQuantity: 0,
          unitPrice: item.unitPrice,
          discountAmount: 0,
          taxAmount: 0,
          lineTotal: item.lineSubtotal,
          currency: item.currency,
        };

        if (orderItem.trackInventory) {
          orderItem.inventoryAllocations = await reserveInventory(
            orderItem,
            orderItem.quantity,
            session,
            orderItem.allowOverselling === true,
          );
        }

        orderItems.push(orderItem);
      }

      const orderDocuments = await OrderModel.create(
        [
          {
            orderNumber: generateOrderNumber(),
            userId,
            checkoutId: checkout._id,
            items: orderItems,
            shippingAddress: checkout.shippingAddress,
            ...(checkout.billingAddress
              ? {
                  billingAddress: checkout.billingAddress,
                }
              : {}),
            ...(checkout.shippingMethod
              ? { shippingMethod: checkout.shippingMethod }
              : {}),
            ...(checkout.delivery ? { delivery: checkout.delivery } : {}),
            paymentMethod: checkout.paymentMethod,
            paymentStatus:
              checkout.paymentStatus === "PAID"
                ? "PAID"
                : checkout.paymentStatus === "AUTHORIZED"
                  ? "AUTHORIZED"
                  : "PENDING",
            fulfillmentStatus: "UNFULFILLED",
            status: "PENDING",
            totals: {
              currency: checkout.totals.currency,
              itemCount: checkout.totals.itemCount,
              subtotal: checkout.totals.subtotal,
              discountAmount: checkout.totals.discountAmount,
              shippingAmount: checkout.totals.shippingAmount,
              taxAmount: checkout.totals.taxAmount,
              totalAmount: checkout.totals.totalAmount,
              refundedAmount: 0,
            },
          },
        ],
        { session },
      );

      const order = orderDocuments[0];

      checkout.status = "COMPLETED";
      checkout.orderId = order._id;
      checkout.completedAt = new Date();

      await checkout.save({ session });

      createdOrder = order;
    });

    if (!createdOrder) {
      throw ApiError.internal("Order creation failed.");
    }

    return createdOrder;
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      const duplicate = await OrderModel.findOne({
        checkoutId,
        userId,
      });

      if (duplicate) return duplicate;
    }

    throw error;
  } finally {
    await session.endSession();
  }
};

export const getCustomerOrder = async (
  userIdInput: string,
  orderIdInput: string,
) => {
  const userId = normalizeUserId(userIdInput);
  const orderId = toObjectId(orderIdInput);

  const order = await OrderModel.findOne({
    _id: orderId,
    userId,
  })
    .select("-internalNote -notes")
    .exec();

  if (!order) {
    throw ApiError.notFound("Order not found.");
  }

  return order;
};

export const listCustomerOrders = async (
  userIdInput: string,
  filters: OrderListFilters = {},
) => {
  const userId = normalizeUserId(userIdInput);
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 20));

  const query: Record<string, unknown> = { userId };

  if (filters.status) query.status = filters.status;
  if (filters.paymentStatus) {
    query.paymentStatus = filters.paymentStatus;
  }

  if (filters.search) {
    const escapedSearch = filters.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    query.orderNumber = {
      $regex: escapedSearch,
      $options: "i",
    };
  }

  const [items, total] = await Promise.all([
    OrderModel.find(query)
      .select("-internalNote -notes")
      .sort({ createdAt: filters.sort === "oldest" ? 1 : -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    OrderModel.countDocuments(query),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const updateOrderStatus = async (
  orderIdInput: string,
  input: UpdateOrderStatusInput,
) => {
  const orderId = toObjectId(orderIdInput);
  const nextStatus = input.status;
  const session = await mongoose.startSession();
  let updatedOrder: Awaited<ReturnType<typeof OrderModel.findById>> | null =
    null;

  try {
    await session.withTransaction(async () => {
      const order = await OrderModel.findById(orderId).session(session);

      if (!order) {
        throw ApiError.notFound("Order not found.");
      }

      if (order.status === "DELIVERED" && nextStatus === "DELIVERED") {
        updatedOrder = order;
        return;
      }

      if (!ORDER_TRANSITIONS[order.status].includes(nextStatus)) {
        throw ApiError.badRequest(
          `Order cannot transition from ${order.status} to ${nextStatus}.`,
        );
      }

      if (
        nextStatus === "CANCELLED" &&
        ["PAID", "PARTIALLY_REFUNDED"].includes(order.paymentStatus)
      ) {
        throw ApiError.badRequest(
          "Paid orders must follow the cancellation and refund workflow.",
        );
      }

      if (nextStatus === "CANCELLED") {
        await releaseOrderInventoryAllocations(order, session);
        order.cancelledAt = new Date();
      }

      if (input.notes !== undefined) {
        order.internalNote = input.notes;
      }

      const now = new Date();

      if (nextStatus === "CONFIRMED") order.confirmedAt = now;
      if (nextStatus === "SHIPPED") {
        await fulfillOrderInventory(order, session);
        order.shippedAt = now;
        order.fulfillmentStatus = "FULFILLED";
        for (const item of order.items) {
          item.fulfilledQuantity = item.quantity;
        }
      }
      if (nextStatus === "DELIVERED") order.deliveredAt = now;

      order.status = nextStatus;
      await order.save({ session });
      updatedOrder = order;
    });

    if (!updatedOrder) {
      throw ApiError.internal("Order status update failed.");
    }

    if (nextStatus === "DELIVERED") {
      await awardLoyaltyPointsForOrder(orderId.toString());
    }

    return updatedOrder;
  } finally {
    await session.endSession();
  }
};
