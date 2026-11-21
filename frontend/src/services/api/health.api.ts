import apiClient from "./client";

export type HealthDependencyStatus =
    | "healthy"
    | "unhealthy"
    | "unknown";

export interface HealthDependency {
    status: HealthDependencyStatus;
    latencyMs?: number;
}

export interface HealthResponse {
    success: boolean;
    service: string;
    status: "healthy" | "degraded" | "ready" | "not_ready" | "alive";
    timestamp: string;
    uptimeSeconds: number;
    startedAt?: string;
    dependencies?: {
        database: HealthDependency;
        redis: HealthDependency;
    };
}

export interface LivenessResponse {
    success: boolean;
    status: "alive";
    timestamp: string;
    uptimeSeconds: number;
}

export const healthApi = {
    async check(): Promise<HealthResponse> {
        const response = await apiClient.get<HealthResponse>("/health");

        return response.data;
    },

    async readiness(): Promise<HealthResponse> {
        const response = await apiClient.get<HealthResponse>("/health/ready");

        return response.data;
    },

    async liveness(): Promise<LivenessResponse> {
        const response = await apiClient.get<LivenessResponse>("/health/live");

        return response.data;
    },
};
