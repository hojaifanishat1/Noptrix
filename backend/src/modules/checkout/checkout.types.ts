import type { Types } from "mongoose";

export const CHECKOUT_STATUSES = [
  "PENDING",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "EXPIRED",
] as const;

export type CheckoutStatus = (typeof CHECKOUT_STATUSES)[number];

export const CHECKOUT_PAYMENT_STATUSES = [
  "PENDING",
  "AUTHORIZED",
  "PAID",
  "FAILED",
  "REFUNDED",
] as const;

export type CheckoutPaymentStatus = (typeof CHECKOUT_PAYMENT_STATUSES)[number];

export interface CheckoutAddressSnapshot {
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

export interface CheckoutItemSnapshot {
  productId: Types.ObjectId;
  sellerId?: Types.ObjectId;
  variantId?: Types.ObjectId;
  sku?: string;
  productName: string;
  variantName?: string;
  quantity: number;
  trackInventory: boolean;
  allowOverselling: boolean;
  unitPrice: number;
  compareAtPrice?: number;
  currency: string;
  lineSubtotal: number;
}

export interface CheckoutTotals {
  currency: string;
  itemCount: number;
  subtotal: number;
  discountAmount: number;
  shippingAmount: number;
  taxAmount: number;
  totalAmount: number;
}

export interface Checkout {
  _id?: Types.ObjectId;
  userId: Types.ObjectId;
  checkoutToken: string;
  idempotencyKey: string;
  status: CheckoutStatus;
  paymentStatus: CheckoutPaymentStatus;
  items: CheckoutItemSnapshot[];
  shippingAddress: CheckoutAddressSnapshot;
  billingAddress?: CheckoutAddressSnapshot;
  shippingMethod?: string;
  paymentMethod: string;
  couponCode?: string;
  totals: CheckoutTotals;
  orderId?: Types.ObjectId;
  expiresAt: Date;
  completedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateCheckoutInput {
  addressId: string;
  billingAddressId?: string;
  shippingMethod?: string;
  paymentMethod: string;
  couponCode?: string;
  idempotencyKey: string;
}

export interface ConfirmCheckoutInput {
  checkoutToken: string;
}

export interface CheckoutListFilters {
  status?: CheckoutStatus;
  page?: number;
  limit?: number;
}
