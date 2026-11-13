import axios, {
  type AxiosError,
  type InternalAxiosRequestConfig,
} from "axios";

import { env } from "@/config/env";

import {
  sellerAuthStorage,
  sellerTokenStorage,
} from "@/lib/auth/seller-auth-storage";

interface SellerRefreshResponse {
  accessToken: string;
  refreshToken: string;
  sellerId: string;
  sessionId: string;
}

interface ApiResponse<T> {
  data: T;
  message?: string;
  success?: boolean;
}

interface RetryConfig extends InternalAxiosRequestConfig {
  _sellerRetry?: boolean;
}

export const sellerAuthClient = axios.create({
  baseURL: env.apiUrl,
  withCredentials: true,
  timeout: 30_000,
  headers: {
    "Content-Type": "application/json",
  },
});

const refreshClient = axios.create({
  baseURL: env.apiUrl,
  withCredentials: true,
  timeout: 30_000,
  headers: {
    "Content-Type": "application/json",
  },
});

let refreshPromise: Promise<string | null> | null = null;

async function refreshSellerAccessToken(): Promise<string | null> {
  const refreshToken = sellerAuthStorage.getRefreshToken();

  if (!refreshToken) return null;

  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const response = await refreshClient.post<
          ApiResponse<SellerRefreshResponse>
        >("/seller-auth/refresh", { refreshToken });

        const result = response.data.data;

        sellerTokenStorage.set(result.accessToken);
        sellerAuthStorage.setRefreshToken(result.refreshToken);
        sellerAuthStorage.setSession({
          sellerId: result.sellerId,
          sessionId: result.sessionId,
        });

        return result.accessToken;
      } catch {
        sellerAuthStorage.clear();
        sellerTokenStorage.clear();
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }

  return refreshPromise;
}

sellerAuthClient.interceptors.request.use((config) => {
  const token = sellerTokenStorage.get();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

sellerAuthClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryConfig | undefined;

    if (
      error.response?.status !== 401 ||
      !originalRequest ||
      originalRequest._sellerRetry ||
      originalRequest.url?.includes("/seller-auth/refresh") ||
      originalRequest.url?.includes("/seller-auth/login")
    ) {
      return Promise.reject(error);
    }

    originalRequest._sellerRetry = true;

    const newToken = await refreshSellerAccessToken();

    if (!newToken) {
      return Promise.reject(error);
    }

    originalRequest.headers.Authorization = `Bearer ${newToken}`;

    return sellerAuthClient(originalRequest);
  },
);
