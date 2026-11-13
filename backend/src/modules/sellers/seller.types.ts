import { Types } from "mongoose";

export const SELLER_STATUSES = [
  "PENDING",
  "ACTIVE",
  "INACTIVE",
  "SUSPENDED",
  "REJECTED",
] as const;

export type SellerStatus = (typeof SELLER_STATUSES)[number];

export const SELLER_TYPES = ["INDIVIDUAL", "BUSINESS"] as const;

export type SellerType = (typeof SELLER_TYPES)[number];

export interface SellerData {
  _id: Types.ObjectId;
  sourceApplicationId?: Types.ObjectId;
  sellerCode: string;
  type: SellerType;
  businessName: string;
  legalName?: string;
  email: string;
  phone?: string;
  taxNumber?: string;
  registrationNumber?: string;
  description?: string;
  logoUrl?: string;
  website?: string;
  status: SellerStatus;
  verifiedAt?: Date;
  verifiedBy?: Types.ObjectId;
  suspendedAt?: Date;
  suspendedBy?: Types.ObjectId;
  suspensionReason?: string;
  rejectionReason?: string;
  notes?: string;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  lastLoginAt?: Date;
  passwordChangedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type SellerStatusTransition = {
  from: SellerStatus;
  to: SellerStatus;
};

export interface SellerPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface SellerListResult {
  sellers: SellerData[];
  pagination: SellerPagination;
}