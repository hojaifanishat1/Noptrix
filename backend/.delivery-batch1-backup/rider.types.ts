import { Types } from "mongoose";

/*
|--------------------------------------------------------------------------
| Rider Status
|--------------------------------------------------------------------------
*/

export const RIDER_STATUSES = [
  "PENDING",
  "ACTIVE",
  "INACTIVE",
  "SUSPENDED",
  "BLOCKED",
  "TERMINATED",
] as const;

export type RiderStatus = (typeof RIDER_STATUSES)[number];

/*
|--------------------------------------------------------------------------
| Rider Type
|--------------------------------------------------------------------------
*/

export const RIDER_TYPES = ["INTERNAL", "CONTRACT", "FREELANCE"] as const;

export type RiderType = (typeof RIDER_TYPES)[number];

/*
|--------------------------------------------------------------------------
| Vehicle Type
|--------------------------------------------------------------------------
*/

export const RIDER_VEHICLE_TYPES = [
  "MOTORCYCLE",
  "CAR",
  "BICYCLE",
  "VAN",
  "OTHER",
] as const;

export type RiderVehicleType = (typeof RIDER_VEHICLE_TYPES)[number];

/*
|--------------------------------------------------------------------------
| Rider Data
|--------------------------------------------------------------------------
*/

export interface RiderData {
  _id: Types.ObjectId;

  userId: Types.ObjectId;

  riderCode: string;

  type: RiderType;

  name: string;

  email: string;

  phone?: string;

  vehicleType?: RiderVehicleType;

  vehicleNumber?: string;

  licenseNumber?: string;

  nationalId?: string;

  status: RiderStatus;

  joinedAt?: Date;

  suspendedAt?: Date;

  suspendedBy?: Types.ObjectId;

  suspensionReason?: string;

  terminatedAt?: Date;

  terminatedBy?: Types.ObjectId;

  terminationReason?: string;

  notes?: string;

  createdBy?: Types.ObjectId;

  updatedBy?: Types.ObjectId;

  createdAt: Date;

  updatedAt: Date;
}

/*
|--------------------------------------------------------------------------
| Rider Status Transition
|--------------------------------------------------------------------------
*/

export interface RiderStatusTransition {
  from: RiderStatus;

  to: RiderStatus;
}

/*
|--------------------------------------------------------------------------
| Rider Pagination
|--------------------------------------------------------------------------
*/

export interface RiderPagination {
  page: number;

  limit: number;

  total: number;

  totalPages: number;

  hasNextPage: boolean;

  hasPreviousPage: boolean;
}

/*
|--------------------------------------------------------------------------
| Rider List Result
|--------------------------------------------------------------------------
*/

export interface RiderListResult {
  riders: RiderData[];

  pagination: RiderPagination;
}
