import type { ApiResponse } from "@/types/api";
import type { Seller } from "./sellers.api";

import { sellerAuthClient } from "./seller-auth-client";

import {
  sellerAuthStorage,
  sellerTokenStorage,
} from "@/lib/auth/seller-auth-storage";

export interface SellerLoginInput {
  email: string;
  password: string;
}

export interface SellerTokenResponse {
  accessToken: string;
  refreshToken: string;
  sellerId: string;
  sessionId: string;
}

export const sellerAuthApi = {
  async login(input: SellerLoginInput): Promise<SellerTokenResponse> {
    const response = await sellerAuthClient.post<
      ApiResponse<SellerTokenResponse>
    >("/seller-auth/login", input);

    const result = response.data.data;

    sellerTokenStorage.set(result.accessToken);

    sellerAuthStorage.setRefreshToken(result.refreshToken);

    sellerAuthStorage.setSession({
      sellerId: result.sellerId,
      sessionId: result.sessionId,
    });

    return result;
  },

  async getMe(): Promise<Seller> {
    const response = await sellerAuthClient.get<ApiResponse<Seller>>(
      "/seller-auth/me",
    );

    return response.data.data;
  },

  async logout(): Promise<void> {
    const session = sellerAuthStorage.getSession();

    try {
      if (session?.sessionId) {
        await sellerAuthClient.post("/seller-auth/logout", {
          sessionId: session.sessionId,
        });
      }
    } finally {
      sellerAuthStorage.clear();
      sellerTokenStorage.clear();
    }
  },

  clearSession(): void {
    sellerAuthStorage.clear();
    sellerTokenStorage.clear();
  },
};
