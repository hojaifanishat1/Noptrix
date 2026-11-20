import apiClient from "./client";
import type { ApiResponse } from "@/types/api";

/*
|--------------------------------------------------------------------------
| TYPES
|--------------------------------------------------------------------------
*/

export type SellerInvitationStatus =
  | "PENDING"
  | "ACCEPTED"
  | "EXPIRED"
  | "REVOKED";

export interface SellerInvitationPreview {
  name: string;
  businessName: string;
  email: string;
  phone?: string;
}

export interface AcceptSellerInvitationInput {
  token: string;
  password: string;
  confirmPassword: string;
}

export interface AcceptSellerInvitationResult {
  _id?: string;
  sellerCode?: string;
  status: "ACTIVE" | string;
  onboardingStatus: "IN_PROGRESS" | string;
}

export interface SellerInvitationApplication {
  _id: string;
  businessName: string;
  legalName?: string;
  type: "INDIVIDUAL" | "BUSINESS";
  status?: string;
  city?: string;
  country?: string;
}

export interface SellerInvitationSeller {
  _id: string;
  sellerCode?: string;
  businessName?: string;
  email?: string;
  status?: string;
  onboardingStatus?: string;
}

export interface SellerInvitationCreator {
  _id: string;
  name?: string;
  email?: string;
}

export interface SellerInvitation {
  _id: string;
  applicationId: string | SellerInvitationApplication;
  email: string;
  status: SellerInvitationStatus;
  expiresAt: string;
  sentAt?: string;
  acceptedAt?: string;
  acceptedSellerId?: string | SellerInvitationSeller;
  createdBy?: string | SellerInvitationCreator;
  createdAt: string;
  updatedAt: string;
}

export interface SellerInvitationPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface SellerInvitationCounts {
  total: number;
  pending: number;
  accepted: number;
  expired: number;
  revoked: number;
}

export interface SellerInvitationListResult {
  invitations: SellerInvitation[];
  counts: SellerInvitationCounts;
  pagination: SellerInvitationPagination;
}

export interface SellerInvitationListParams {
  page: number;
  limit: number;
  search?: string;
  status?: SellerInvitationStatus;
}

/*
|--------------------------------------------------------------------------
| API
|--------------------------------------------------------------------------
*/

export const sellerInvitationsApi = {
  /*
  |--------------------------------------------------------------------------
  | PUBLIC: PREVIEW INVITATION
  |--------------------------------------------------------------------------
  */

  async preview(token: string): Promise<SellerInvitationPreview> {
    const response = await apiClient.get<
      ApiResponse<SellerInvitationPreview>
    >(`/seller-invitations/${encodeURIComponent(token)}`);

    return response.data.data;
  },

  /*
  |--------------------------------------------------------------------------
  | PUBLIC: ACCEPT INVITATION
  |--------------------------------------------------------------------------
  */

  async accept(
    input: AcceptSellerInvitationInput,
  ): Promise<AcceptSellerInvitationResult> {
    const response = await apiClient.post<
      ApiResponse<AcceptSellerInvitationResult>
    >("/seller-invitations/accept", input);

    return response.data.data;
  },

  /*
  |--------------------------------------------------------------------------
  | ADMIN: LIST INVITATIONS
  |--------------------------------------------------------------------------
  */

  async list(
    params: SellerInvitationListParams,
  ): Promise<SellerInvitationListResult> {
    const response = await apiClient.get<
      ApiResponse<SellerInvitationListResult>
    >("/seller-invitations/admin", { params });

    return response.data.data;
  },

  /*
  |--------------------------------------------------------------------------
  | ADMIN: REVOKE INVITATION
  |--------------------------------------------------------------------------
  */

  async revoke(invitationId: string): Promise<void> {
    await apiClient.post<ApiResponse<null>>(
      `/seller-invitations/admin/${invitationId}/revoke`,
    );
  },
};
