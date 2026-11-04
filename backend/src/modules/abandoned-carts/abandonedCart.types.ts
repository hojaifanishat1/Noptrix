import type { Types } from "mongoose";
import type { CartItem, CartStatus } from "../cart/cart.types";

export const ABANDONED_CART_STATUSES = [
  "OPEN",
  "RECOVERED",
  "CONVERTED",
  "EXPIRED",
] as const;

export type AbandonedCartStatus = (typeof ABANDONED_CART_STATUSES)[number];

export interface AbandonedCart {
  _id: Types.ObjectId;
  cartId: Types.ObjectId;
  userId: Types.ObjectId;

  status: AbandonedCartStatus;
  cartStatusAtCapture: CartStatus;

  items: CartItem[];
  currency: string;
  itemCount: number;
  subtotal: number;
  couponCode?: string;

  abandonedAt: Date;
  recoveryTokenHash?: string;
  recoveryTokenExpiresAt?: Date;
  emailClaimToken?: string;
  emailClaimExpiresAt?: Date;

  emailSentAt?: Date;
  lastEmailAt?: Date;
  reminderCount: number;

  recoveredAt?: Date;
  convertedAt?: Date;
  expiresAt: Date;

  createdAt: Date;
  updatedAt: Date;
}

export interface AbandonedCartListFilters {
  status?: AbandonedCartStatus;
  userId?: string;
  from?: Date;
  to?: Date;
  page: number;
  limit: number;
}
