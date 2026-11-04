import type { PaginationMeta } from "@/types/api";

export const checkoutStatuses = [
  "PENDING",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "EXPIRED",
] as const;

export const checkoutPaymentStatuses = [
  "PENDING",
  "AUTHORIZED",
  "PAID",
  "FAILED",
  "REFUNDED",
] as const;

export type CheckoutStatus = (typeof checkoutStatuses)[number];
export type CheckoutPaymentStatus =
  (typeof checkoutPaymentStatuses)[number];

export interface CheckoutUser {
  _id?: string;
  name?: string;
  email?: string;
  phone?: string;
  status?: string;
}

export interface CheckoutAddress {
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

export interface CheckoutItem {
  _id?: string;
  productId: string;
  sellerId?: string;
  variantId?: string;
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

export interface AdminCheckout {
  _id: string;
  userId: CheckoutUser | string;
  status: CheckoutStatus;
  paymentStatus: CheckoutPaymentStatus;
  items: CheckoutItem[];
  shippingAddress: CheckoutAddress;
  billingAddress?: CheckoutAddress;
  shippingMethod?: string;
  paymentMethod: string;
  couponCode?: string;
  totals: CheckoutTotals;
  orderId?: string;
  expiresAt: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CheckoutFilters {
  page: number;
  limit: number;
  sort: "newest" | "oldest";
  status: CheckoutStatus | "";
  paymentStatus: CheckoutPaymentStatus | "";
  search: string;
  from: string;
  to: string;
}

export interface CheckoutListResult {
  items: AdminCheckout[];
  pagination: PaginationMeta;
}

export interface CheckoutCurrencyTotal {
  _id: string;
  count: number;
  totalAmount: number;
  averageAmount: number;
}

export interface CheckoutTrendItem {
  _id: {
    year: number;
    month: number;
    day: number;
  };
  count: number;
  amount: number;
}

export interface CheckoutAnalytics {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  cancelled: number;
  expired: number;
  paid: number;
  paymentPending: number;
  paymentFailed: number;
  refunded: number;
  completionRate: number;
  currencyTotals: CheckoutCurrencyTotal[];
  recentTrend: CheckoutTrendItem[];
}
