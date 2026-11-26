import type { Types } from "mongoose";

export const DELIVERY_STATUSES = [
  "pending",
  "assigned",
  "accepted",
  "picked_up",
  "in_transit",
  "arriving",
  "delivered",
  "failed",
  "cancelled",
  "returned",
] as const;

export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export interface IDeliveryEvent {
  eventId: string;
  status: DeliveryStatus;
  description: string;
  location?: string;
  occurredAt: Date;
  createdAt?: Date;
}

export interface IDelivery {
  deliveryNumber: string;

  orderId: Types.ObjectId;
  shipmentId?: Types.ObjectId;
  customerId?: Types.ObjectId;
  riderId?: Types.ObjectId;

  status: DeliveryStatus;

  recipientName: string;
  recipientPhone: string;
  address: string;
  city: string;

  deliveryFee: number;
  riderEarningAmount?: number;
  riderEarningCurrency?: string;
  currency: string;

  assignedAt?: Date;
  acceptedAt?: Date;
  pickedUpAt?: Date;
  deliveredAt?: Date;
  cancelledAt?: Date;

  attemptCount: number;
  failureReason?: string;

  proofOfDeliveryUrl?: string;
  recipientSignatureUrl?: string;

  events: IDeliveryEvent[];

  idempotencyKey?: string;
  createdBy?: Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}
