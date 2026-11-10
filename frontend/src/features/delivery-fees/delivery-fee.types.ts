
export type DeliveryFeeStatus = "active" | "inactive";

export type DeliveryFeeMethod =
  | "flat"
  | "weight_based"
  | "order_value_based";

export interface DeliveryFeeRule {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  country: string;
  state?: string;
  city?: string;

  deliveryZoneId?: string;

  // Linked Delivery Method
  deliveryMethodId?: string | {
    _id: string;
    name?: string;
    code?: string;
  };

  postalCodes: string[];

  // Fee calculation method
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

  createdAt?: string;
  updatedAt?: string;

  [key: string]: unknown;
}
