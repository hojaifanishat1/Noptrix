
import axios from "axios";
import apiClient from "./client";
import { env } from "@/config/env";
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
  vehicleType?: RiderVehicleType;
  vehicleNumber?: string;
  riderCode: string;
  expiresAt: string;
  requiresPassword: boolean;
}

export interface AcceptRiderInvitationInput {
  token: string;
  password: string;
  confirmPassword: string;
}

export interface AcceptedRiderInvitation {
  riderId: string;
  riderCode: string;
  email: string;
  status: "ACTIVE";
  onboardingStatus: "IN_PROGRESS";
  message?: string;
}

const BASE_PATH = "/rider-invitations";

/*
|--------------------------------------------------------------------------
| Public Invitation Client
|--------------------------------------------------------------------------
|
| Does not attach Customer/Admin access tokens.
| Does not run the shared authentication refresh interceptors.
|
*/

const publicInvitationClient = axios.create({
  baseURL: env.apiUrl,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30_000,
});

export const riderInvitationsApi = {
  /*
   * Management APIs
   * These endpoints require Admin authentication.
   */

  async create(
    input: CreateRiderInvitationInput,
  ): Promise<CreatedRiderInvitation> {
    const response = await apiClient.post<
      ApiResponse<CreatedRiderInvitation>
    >(BASE_PATH, input);

    return response.data.data;
  },

  async list(): Promise<RiderInvitation[]> {
    const response = await apiClient.get<
      ApiResponse<{ invitations: RiderInvitation[] }>
    >(BASE_PATH, {
      params: {
        page: 1,
        limit: 100,
      },
    });

    return response.data.data.invitations;
  },

  async revoke(invitationId: string): Promise<RiderInvitation> {
    const response = await apiClient.post<
      ApiResponse<RiderInvitation>
    >(
      `${BASE_PATH}/${encodeURIComponent(invitationId)}/revoke`,
    );

    return response.data.data;
  },

  /*
   * Public Invitation APIs
   */

  async validate(
    token: string,
  ): Promise<RiderInvitationValidation> {
    const response = await publicInvitationClient.get<
      ApiResponse<RiderInvitationValidation>
    >(`${BASE_PATH}/validate`, {
      params: {
        token: token.trim(),
      },
    });

    return response.data.data;
  },

  async accept(
    input: AcceptRiderInvitationInput,
  ): Promise<AcceptedRiderInvitation> {
    const response = await publicInvitationClient.post<
      ApiResponse<AcceptedRiderInvitation>
    >(`${BASE_PATH}/accept`, {
      token: input.token.trim(),
      password: input.password,
      confirmPassword: input.confirmPassword,
    });

    return response.data.data;
  },
};
