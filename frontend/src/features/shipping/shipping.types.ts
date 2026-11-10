export type ShippingStatus =
  | "created"
  | "ready_to_ship"
  | "picked_up"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "failed"
  | "returned"
  | "cancelled";

export interface ShippingAddress {
  recipientName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state?: string;
  postalCode?: string;
  country: string;
}

export interface ShippingRecord {
  _id: string;
  shipmentNumber: string;
  trackingNumber: string;
  orderId: string;
  customerId?: string;
  riderId?: string;
  provider: string;
  providerShipmentId?: string;
  status: ShippingStatus;
  address: ShippingAddress;
  shippingFee: number;
  currency: string;
  estimatedDeliveryAt?: string;
  shippedAt?: string;
  deliveredAt?: string;
  failureReason?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface TrackingResult {
  trackingNumber?: string;
  shipmentNumber?: string;
  orderId?: string;
  provider?: string;
  status?: string;
  address?: ShippingAddress;
  trackingEvents?: Array<{
    status?: string;
    description?: string;
    location?: string;
    occurredAt?: string;
    createdAt?: string;
  }>;
  estimatedDeliveryAt?: string;
  deliveredAt?: string;
  [key: string]: unknown;
}
