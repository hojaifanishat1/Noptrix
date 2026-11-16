import apiClient from "./client";

import type {
    AuthUser,
} from "@/types/auth";

import type {
    ApiResponse,
} from "@/types/api";

export interface RiderLoginInput {
    email?: string;
    phone?: string;
    password: string;
}

export interface RiderLoginVerificationChallenge {
    verificationRequired: true;
    challengeId: string;
        email?: string;
    phone?: string;
    expiresAt: string;
    resendAvailableAt: string;
}

export interface RiderLoginResponse {
    riderId: string;
    sessionId: string;
    accessToken: string;
}

export interface RiderProfile extends AuthUser {
    riderId: string;
    riderCode?: string;
    riderStatus?: string;
    onboardingStatus?: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
    vehicleType?: string;
    vehicleNumber?: string;
}

export const riderAuthApi = {
    async login(
                input: RiderLoginInput,
    ): Promise<RiderLoginVerificationChallenge> {
        const response = await apiClient.post<
            ApiResponse<RiderLoginVerificationChallenge>
        >("/rider-auth/login", input);

        return response.data.data;
    },

    async verifyLogin(input: {
        challengeId: string;
        code: string;
    }): Promise<RiderLoginResponse> {
        const response = await apiClient.post<
            ApiResponse<RiderLoginResponse>
        >("/rider-auth/verify-login", input);

        return response.data.data;
    },

    async resendLoginCode(
        challengeId: string,
    ): Promise<RiderLoginVerificationChallenge> {
        const response = await apiClient.post<
            ApiResponse<RiderLoginVerificationChallenge>
        >(
            "/rider-auth/resend-login-code",
            { challengeId },
        );

        return response.data.data;
    },

    async getMe(): Promise<RiderProfile> {
        const response = await apiClient.get<
            ApiResponse<RiderProfile>
        >("/rider-auth/me");

        return response.data.data;
    },

    async refresh(): Promise<RiderLoginResponse> {
        const response = await apiClient.post<
            ApiResponse<RiderLoginResponse>
        >("/rider-auth/refresh", {});

        return response.data.data;
    },

    async logout(): Promise<void> {
        await apiClient.post(
            "/rider-auth/logout",
            {},
        );
    },
};
