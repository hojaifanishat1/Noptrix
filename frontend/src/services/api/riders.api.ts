import apiClient from "./client";
import type { ApiResponse } from "@/types/api";

export type RiderStatus =
  | "PENDING"
  | "ACTIVE"
  | "INACTIVE"
  | "SUSPENDED"
  | "BLOCKED"
  | "TERMINATED";

export type RiderType = "INTERNAL" | "CONTRACT" | "FREELANCE";

export type RiderVehicleType =
  | "MOTORCYCLE"
  | "CAR"
  | "BICYCLE"
  | "VAN"
  | "OTHER";

export interface Rider {
  _id: string;
  userId: string | { _id: string; name?: string; email?: string; phone?: string };
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
  isAvailable: boolean;
  joinedAt?: string;
  notes?: string;
  suspensionReason?: string;
  terminationReason?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface RiderPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface ConvertSelectedApplicationToRiderInput {
  riderCode: string;
  type?: RiderType;
  phone?: string;
  vehicleType?: RiderVehicleType;
  vehicleNumber?: string;
  licenseNumber?: string;
  nationalId?: string;
  joinedAt?: string;
  notes?: string;
}

export interface RiderListResult {
  riders: Rider[];
  pagination: RiderPagination;
}

export interface RiderListParams {
  page: number;
  limit: number;
  search?: string;
  status?: RiderStatus;
}

export const ridersApi = {
  async list(params: RiderListParams): Promise<RiderListResult> {
    const response = await apiClient.get<ApiResponse<RiderListResult>>(
      "/riders",
      { params },
    );

    return response.data.data;
  },

  async convertApplication(
    applicationId: string,
    input: ConvertSelectedApplicationToRiderInput,
  ): Promise<Rider> {
    const response = await apiClient.post<ApiResponse<Rider>>(
      `/riders/applications/${applicationId}/convert`,
      input,
    );

    return response.data.data;
  },

  async updateStatus(
    riderId: string,
    status: RiderStatus,
    reason?: string,
  ): Promise<Rider> {
    const response = await apiClient.patch<ApiResponse<Rider>>(
      `/riders/${riderId}/status`,
      { status, ...(reason ? { reason } : {}) },
    );

    return response.data.data;
  },
};
