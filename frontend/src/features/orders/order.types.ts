import type { PaginationMeta } from "@/types/api";

export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PROCESSING"
  | "READY_TO_SHIP"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "RETURN_REQUESTED"
  | "RETURNED";

export type OrderPaymentStatus =
  | "PENDING"
  | "AUTHORIZED"
  | "PAID"
  | "PARTIALLY_REFUNDED"
  | "REFUNDED"
  | "FAILED";

export type OrderFulfillmentStatus =
  "UNFULFILLED" | "PARTIALLY_FULFILLED" | "FULFILLED";

export interface OrderAddress {
  fullName?: string;
  phone?: string;
  email?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  [key: string]: unknown;
}

export interface OrderItem {
  productId?: string;
  variantId?: string;
  sku?: string;
  productName: string;
  variantName?: string;
  imageUrl?: string;
  quantity: number;
  fulfilledQuantity?: number;
  returnedQuantity?: number;
  unitPrice: number;
  discountAmount: number;
  taxAmount: number;
  lineTotal: number;
  currency: string;
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

export interface AdminOrder {
  _id: string;
  orderNumber: string;
  userId: string;
  checkoutId?: string;
  items: OrderItem[];
  shippingAddress: OrderAddress;
  billingAddress?: OrderAddress;
  shippingMethod?: string;
  paymentMethod?: string;
  paymentStatus: OrderPaymentStatus;
  fulfillmentStatus: OrderFulfillmentStatus;
  status: OrderStatus;
  totals: OrderTotals;
  notes?: string;
  internalNote?: string;
  confirmedAt?: string;
  shippedAt?: string;
  deliveredAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminOrderFilters {
  page: number;
  limit: number;
  sort: "newest" | "oldest";
  status?: OrderStatus | "";
  paymentStatus?: OrderPaymentStatus | "";
  search?: string;
}

export interface AdminOrderListResult {
  items: AdminOrder[];
  pagination: PaginationMeta;
}

export interface UpdateAdminOrderStatusInput {
  status: Extract<
    OrderStatus,
    | "CONFIRMED"
    | "PROCESSING"
    | "READY_TO_SHIP"
    | "SHIPPED"
    | "DELIVERED"
    | "CANCELLED"
  >;
  internalNote?: string;
}
