import type { Types } from "mongoose";

export const DELIVERY_METHOD_STATUSES = [
  "ACTIVE",
  "INACTIVE",
] as const;

export type DeliveryMethodStatus =
  (typeof DELIVERY_METHOD_STATUSES)[number];

export interface DeliveryMethod {
  _id?: Types.ObjectId;
  code: string;
  name: string;
  description?: string;
  estimatedMinMinutes: number;
  estimatedMaxMinutes: number;
  maximumDistanceKm?: number;
  requiresLiveRider: boolean;
  requiresAreaCoverage: boolean;
  status: DeliveryMethodStatus;
  priority: number;
  createdAt?: Date;
  updatedAt?: Date;
}
