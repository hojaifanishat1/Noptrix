import type { Types } from "mongoose";

export const AREA_FEE_OVERRIDE_STATUSES = [
  "ACTIVE",
  "INACTIVE",
] as const;

export interface AreaFeeOverride {
  _id?: Types.ObjectId;
  areaId: Types.ObjectId;
  methodId?: Types.ObjectId;
  fee: number;
  freeDeliveryThreshold?: number;
  minimumOrderAmount: number;
  currency: string;
  status: (typeof AREA_FEE_OVERRIDE_STATUSES)[number];
  priority: number;
  validFrom?: Date;
  validUntil?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}
