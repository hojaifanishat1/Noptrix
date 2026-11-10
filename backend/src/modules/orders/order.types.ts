import type { Types } from "mongoose";

export const ORDER_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "READY_TO_SHIP",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "RETURN_REQUESTED",
  "RETURNED",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_PAYMENT_STATUSES = [
  "PENDING",
  "AUTHORIZED",
  "PAID",
  "PARTIALLY_REFUNDED",
  "REFUNDED",
  "FAILED",
] as const;

export type OrderPaymentStatus = (typeof ORDER_PAYMENT_STATUSES)[number];

export const ORDER_FULFILLMENT_STATUSES = [
  "UNFULFILLED",
  "PARTIALLY_FULFILLED",
  "FULFILLED",
] as const;

export type OrderFulfillmentStatus =
  (typeof ORDER_FULFILLMENT_STATUSES)[number];

export interface OrderAddressSnapshot {
  fullName: string;
  phone: string;
  email?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state?: string;
  postalCode?: string;
  country: string;
}

export interface OrderItem {
  _id?: Types.ObjectId;
  productId: Types.ObjectId;
  sellerId?: Types.ObjectId;
  variantId?: Types.ObjectId;
  sku?: string;
  productName: string;
  variantName?: string;
  imageUrl?: string;
  quantity: number;
  trackInventory?: boolean;
  allowOverselling?: boolean;
  inventoryAllocations?: Array<{
    warehouseId: Types.ObjectId;
    quantity: number;
  }>;
  fulfilledQuantity: number;
  returnedQuantity: number;
  unitPrice: number;
  discountAmount: number;
  taxAmount: number;
  lineTotal: number;
  currency: string;
}

export interface OrderDeliverySnapshot {
  zoneId: Types.ObjectId;
  zoneName: string;
  areaId: Types.ObjectId;
  areaName: string;
  methodId?: Types.ObjectId;
  methodCode?: string;
  methodName?: string;
  fee: number;
  currency: string;
  freeDeliveryApplied: boolean;
  estimatedMinMinutes?: number;
  estimatedMaxMinutes?: number;
  distanceKm?: number;
  estimatedTravelMinutes?: number;
}

export interface OrderTotals {
  currency: string;
  itemCount: number;
  subtotal: number;
  discountAmount: number;
  shippingAmount: number;
  taxAmount: number;
  totalAmount: number;
  refundedAmount: number;
}

export interface Order {
  _id?: Types.ObjectId;
  orderNumber: string;
  userId: Types.ObjectId;
  checkoutId?: Types.ObjectId;
  items: OrderItem[];
  shippingAddress: OrderAddressSnapshot;
  billingAddress?: OrderAddressSnapshot;
  shippingMethod?: string;
  delivery?: OrderDeliverySnapshot;
  paymentMethod: string;
  paymentStatus: OrderPaymentStatus;
  fulfillmentStatus: OrderFulfillmentStatus;
  status: OrderStatus;
  totals: OrderTotals;
  notes?: string;
  internalNote?: string;
  cancellationReason?: string;
  cancelledAt?: Date;
  confirmedAt?: Date;
  shippedAt?: Date;
  deliveredAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateOrderInput {
  checkoutId: string;
}

export interface OrderListFilters {
  status?: OrderStatus;
  paymentStatus?: OrderPaymentStatus;
  page?: number;
  limit?: number;
  search?: string;
  sort?: "newest" | "oldest";
}

export interface UpdateOrderStatusInput {
  status: OrderStatus;
  notes?: string;
}
