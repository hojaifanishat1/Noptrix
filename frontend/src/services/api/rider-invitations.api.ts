import apiClient from "./client";
import type { ApiResponse } from "@/types/api";

export type RiderInvitationStatus =
  | "PENDING"
  | "ACCEPTED"
  | "EXPIRED"
  | "REVOKED";

export type RiderVehicleType =
  | "MOTORCYCLE"
  | "CAR"
  | "BICYCLE"
  | "VAN"
  | "OTHER";

export interface RiderInvitation {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  type: "INTERNAL" | "CONTRACT" | "FREELANCE";
  vehicleType?: RiderVehicleType;
  status: RiderInvitationStatus;
  expiresAt: string;
  createdAt: string;
}

export interface CreateRiderInvitationInput {
  name: string;
  email: string;
  phone?: string;
  type?: RiderInvitation["type"];
  vehicleType?: RiderVehicleType;
  vehicleNumber?: string;
  licenseNumber?: string;
  nationalId?: string;
}

export interface CreatedRiderInvitation {
  invitationId: string;
  name: string;
  email: string;
  status: RiderInvitationStatus;
  expiresAt: string;
}

export interface RiderInvitationValidation {
  invitationId: string;
  name: string;
  email: string;
  phone?: string;
  type: RiderInvitation["type"];
  vehicleType?: RiderInvitation["vehicleType"];
  expiresAt: string;
  requiresPassword: boolean;
}

const BASE_PATH = "/rider-invitations";

export const riderInvitationsApi = {
  async create(input: CreateRiderInvitationInput): Promise<CreatedRiderInvitation> {
    const response = await apiClient.post<ApiResponse<CreatedRiderInvitation>>(
      BASE_PATH,
      input,
    );
    return response.data.data;
  },

  async list(): Promise<RiderInvitation[]> {
    const response = await apiClient.get<
      ApiResponse<{ invitations: RiderInvitation[] }>
    >(BASE_PATH, { params: { page: 1, limit: 100 } });
    return response.data.data.invitations;
  },

  async revoke(invitationId: string): Promise<RiderInvitation> {
    const response = await apiClient.post<ApiResponse<RiderInvitation>>(
      `${BASE_PATH}/${encodeURIComponent(invitationId)}/revoke`,
    );
    return response.data.data;
  },

  async validate(token: string): Promise<RiderInvitationValidation> {
    const response = await apiClient.get<ApiResponse<RiderInvitationValidation>>(
      `${BASE_PATH}/validate`,
      { params: { token } },
    );
    return response.data.data;
  },

  async accept(input: { token: string; password?: string }) {
    const response = await apiClient.post<
      ApiResponse<{
        riderId: string;
        riderCode: string;
        email: string;
        status: string;
        message?: string;
      }>
    >(`${BASE_PATH}/accept`, input);
    return response.data.data;
  },
};
