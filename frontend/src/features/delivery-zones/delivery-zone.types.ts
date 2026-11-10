export type DeliveryZoneStatus = "active" | "inactive";

export interface DeliveryZone {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  country: string;
  state?: string;
  city: string;
  postalCodes: string[];
  boundary?: {
    type: "Polygon";
    coordinates: number[][][];
  };
  deliveryFee: number;
  freeDeliveryThreshold?: number;
  minimumOrderAmount: number;
  estimatedDeliveryMinDays: number;
  estimatedDeliveryMaxDays: number;
  supportsCOD: boolean;
  priority: number;
  status: DeliveryZoneStatus;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}
