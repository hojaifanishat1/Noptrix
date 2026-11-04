export type AbandonedCartStatus =
  | "OPEN"
  | "RECOVERED"
  | "CONVERTED"
  | "EXPIRED";

export interface AbandonedCartItem {
  productId?: string;
  variantId?: string;
  sku?: string;
  productName?: string;
  variantName?: string;
  imageUrl?: string;
  quantity: number;
  unitPrice: number;
  compareAtPrice?: number;
  currency?: string;
}

export interface AbandonedCart {
  _id: string;
  cartId: string;
  userId: string;
  status: AbandonedCartStatus;
  cartStatusAtCapture: "ACTIVE" | "CONVERTED" | "ABANDONED";
  items: AbandonedCartItem[];
  currency: string;
  itemCount: number;
  subtotal: number;
  couponCode?: string;
  abandonedAt: string;
  emailSentAt?: string;
  lastEmailAt?: string;
  reminderCount: number;
  recoveredAt?: string;
  convertedAt?: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface AbandonedCartFilters {
  page: number;
  limit: number;
  status?: AbandonedCartStatus;
  userId?: string;
  from?: string;
  to?: string;
}

export interface AbandonedCartPagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface AbandonedCartListResult {
  records: AbandonedCart[];
  pagination: AbandonedCartPagination;
}

export interface AbandonedCartCurrencyTotal {
  _id: string;
  carts?: number;
  itemCount?: number;
  subtotal?: number;
  count?: number;
}

export interface AbandonedCartAnalytics {
  total: number;
  open: number;
  recovered: number;
  converted: number;
  expired: number;
  conversionRate: number;
  openTotals: AbandonedCartCurrencyTotal[];
  conversionTotals: AbandonedCartCurrencyTotal[];
}
