import axios from "axios";

import { env } from "@/config/env";
import type { ApiResponse } from "@/types/api";
import type { SellerStatus } from "./sellers.api";

export interface AcceptSellerInvitationInput {
  token: string;
  password: string;
  confirmPassword: string;
}

export interface AcceptSellerInvitationResult {
  sellerId: string;
  sellerCode: string;
  email: string;
  status: SellerStatus;
}

export interface SellerInvitationPreview {
  name: string;
  businessName: string;
  email: string;
  phone: string | null;
}

const sellerPublicClient = axios.create({
  baseURL: env.apiUrl,
  withCredentials: true,
  timeout: 30_000,
  headers: {
    "Content-Type": "application/json",
  },
});

export const sellerInvitationsApi = {
  async preview(token: string): Promise<SellerInvitationPreview> {
    const response = await sellerPublicClient.get<
      ApiResponse<SellerInvitationPreview>
    >(`/seller-invitations/${encodeURIComponent(token.trim())}`);

    return response.data.data;
  },

  async accept(
    input: AcceptSellerInvitationInput,
  ): Promise<AcceptSellerInvitationResult> {
    const response = await sellerPublicClient.post<
      ApiResponse<AcceptSellerInvitationResult>
    >("/seller-invitations/accept", {
      token: input.token.trim(),
      password: input.password,
      confirmPassword: input.confirmPassword,
    });

    return response.data.data;
  },
};
