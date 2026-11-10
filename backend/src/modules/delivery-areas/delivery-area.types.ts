import type { Types } from "mongoose";

export const DELIVERY_AREA_STATUSES = ["ACTIVE", "INACTIVE"] as const;

export type DeliveryAreaStatus =
  (typeof DELIVERY_AREA_STATUSES)[number];

export interface DeliveryArea {
  _id?: Types.ObjectId;
  zoneId: Types.ObjectId;
  name: string;
  slug: string;
  description?: string;
  city: string;
  state?: string;
  postalCodes: string[];

  boundary?: {
    type: "Polygon";
    coordinates: number[][][];
  };

  center?: {
    latitude: number;
    longitude: number;
  };

  status: DeliveryAreaStatus;
  priority: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateDeliveryAreaInput {
  zoneId: string;
  name: string;
  slug: string;
  description?: string;
  city: string;
  state?: string;
  postalCodes?: string[];
  boundary?: {
    type: "Polygon";
    coordinates: number[][][];
  };
  center?: {
    latitude: number;
    longitude: number;
  };
  priority?: number;
}
