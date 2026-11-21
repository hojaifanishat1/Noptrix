import apiClient from "./client";

import type {
    ApiResponse,
} from "@/types/api";

export interface HealthResponse {
    success: boolean;
    message: string;
    timestamp: string;
}

export const healthApi = {
    async check(): Promise<HealthResponse> {
        const response =
            await apiClient.get<
                ApiResponse<HealthResponse>
            >("/health");

        return response.data.data;
    },
};