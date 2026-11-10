export type DeliveryStatus =
  | "pending"
  | "assigned"
  | "accepted"
  | "picked_up"
  | "in_transit"
  | "arriving"
  | "delivered"
  | "failed"
  | "cancelled"
  | "returned";

export type ActiveStatus = "active" | "inactive";

export interface DeliveryRecord {
  _id: string;
  deliveryNumber: string;
  orderId: string;
  shipmentId?: string;
  customerId?: string;
  riderId?: string;
  status: DeliveryStatus;
  recipientName: string;
  recipientPhone: string;
  address: string;
  city: string;
  deliveryFee: number;
  currency: string;
  assignedAt?: string;
  deliveredAt?: string;
  failureReason?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface DeliveryListResult<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage?: boolean;
    hasPreviousPage?: boolean;
  };
}
