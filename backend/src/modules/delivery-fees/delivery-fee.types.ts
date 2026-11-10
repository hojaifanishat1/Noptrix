import type { Types } from "mongoose";

export const DELIVERY_FEE_STATUSES = ["active", "inactive"] as const;
export type DeliveryFeeStatus = (typeof DELIVERY_FEE_STATUSES)[number];

export const DELIVERY_FEE_METHODS = [
  "flat",
  "weight_based",
  "order_value_based",
] as const;

export type DeliveryFeeMethod = (typeof DELIVERY_FEE_METHODS)[number];

export interface IDeliveryFee {
  name: string;
  slug: string;
  description?: string;

  country: string;
  state?: string;
  city?: string;
  deliveryZoneId?: Types.ObjectId;
  deliveryMethodId?: Types.ObjectId;
  postalCodes: string[];

  method: DeliveryFeeMethod;
  baseFee: number;
  perKgFee: number;
  freeDeliveryThreshold?: number;
  minimumOrderAmount: number;

  minimumWeightKg: number;
  maximumWeightKg?: number;

  supportsCOD: boolean;
  priority: number;
  status: DeliveryFeeStatus;

  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

export interface CalculateDeliveryFeeInput {
  country: string;
  state?: string;
  city: string;
  postalCode?: string;
  deliveryZoneId?: string;
  deliveryMethodId?: string;
  orderAmount: number;
  weightKg?: number;
  paymentMethod: "cod" | "online";
}

export interface DeliveryFeeCalculation {
  available: boolean;
  fee: number;
  currency: "BDT";
  freeDelivery: boolean;
  ruleId?: string;
  ruleName?: string;
  message: string;
}
