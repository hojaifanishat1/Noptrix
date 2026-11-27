import apiClient from "./client";
import type { ApiResponse } from "@/types/api";

export type RiderSupportCategory =
    | "ACCOUNT"
    | "ORDERS"
    | "PAYMENTS"
    | "VEHICLE"
    | "APP"
    | "OTHER";

export type RiderSupportStatus =
    | "OPEN"
    | "IN_PROGRESS"
    | "RESOLVED"
    | "CLOSED";

export interface RiderSettings {
    riderId: string;
    notifications: {
        announcements: boolean;
        orderUpdates: boolean;
        earnings: boolean;
        promotions: boolean;
        sound: boolean;
        push: boolean;
        email: boolean;
    };
    app: {
        language: "en" | "bn" | "ar";
        theme: "light" | "dark" | "system";
        distanceUnit: "km" | "mi";
    };
}

export interface RiderChangeRequest {
    _id: string;
    type: "VEHICLE" | "PAYMENT";
    status: "PENDING" | "APPROVED" | "REJECTED";
    requestedValues: Record<string, string>;
    reviewNote?: string;
    createdAt: string;
    reviewedAt?: string;
}

export interface RiderSupportMessage {
    _id?: string;
    message: string;
    createdAt: string;
}

export interface RiderSupportTicket {
    _id: string;
    ticketNumber: string;
    subject: string;
    category: RiderSupportCategory;
    description: string;
    status: RiderSupportStatus;
    messages: RiderSupportMessage[];
    createdAt: string;
    updatedAt: string;
}

export const riderSettingsApi = {
    async getSettings(): Promise<RiderSettings> {
        const response = await apiClient.get<ApiResponse<RiderSettings>>(
            "/rider-settings/me",
        );
        return response.data.data;
    },

    async updateSettings(input: {
        notifications?: Partial<RiderSettings["notifications"]>;
        app?: Partial<RiderSettings["app"]>;
    }): Promise<RiderSettings> {
        const response = await apiClient.patch<ApiResponse<RiderSettings>>(
            "/rider-settings/me",
            input,
        );
        return response.data.data;
    },

    async getChangeRequests(): Promise<RiderChangeRequest[]> {
        const response = await apiClient.get<ApiResponse<RiderChangeRequest[]>>(
            "/rider-settings/me/change-requests",
        );
        return response.data.data;
    },

    async createVehicleChangeRequest(input: {
        vehicleType: "MOTORCYCLE" | "CAR" | "BICYCLE" | "VAN" | "OTHER";
        vehicleNumber: string;
        licenseNumber: string;
    }): Promise<RiderChangeRequest> {
        const response = await apiClient.post<ApiResponse<RiderChangeRequest>>(
            "/rider-settings/me/change-requests",
            { type: "VEHICLE", values: input },
        );
        return response.data.data;
    },

    async createPaymentChangeRequest(input: {
        provider: string;
        accountHolderName: string;
        accountLast4: string;
    }): Promise<RiderChangeRequest> {
        const response = await apiClient.post<ApiResponse<RiderChangeRequest>>(
            "/rider-settings/me/change-requests",
            { type: "PAYMENT", values: input },
        );
        return response.data.data;
    },

    async getSupportTickets(): Promise<RiderSupportTicket[]> {
        const response = await apiClient.get<ApiResponse<RiderSupportTicket[]>>(
            "/rider-settings/me/support-tickets",
        );
        return response.data.data;
    },

    async createSupportTicket(input: {
        subject: string;
        category: RiderSupportCategory;
        description: string;
    }): Promise<RiderSupportTicket> {
        const response = await apiClient.post<ApiResponse<RiderSupportTicket>>(
            "/rider-settings/me/support-tickets",
            input,
        );
        return response.data.data;
    },

    async getSupportTicket(ticketId: string): Promise<RiderSupportTicket> {
        const response = await apiClient.get<ApiResponse<RiderSupportTicket>>(
            `/rider-settings/me/support-tickets/${ticketId}`,
        );
        return response.data.data;
    },

    async replyToSupportTicket(
        ticketId: string,
        message: string,
    ): Promise<RiderSupportTicket> {
        const response = await apiClient.post<ApiResponse<RiderSupportTicket>>(
            `/rider-settings/me/support-tickets/${ticketId}/replies`,
            { message },
        );
        return response.data.data;
    },

    async closeSupportTicket(ticketId: string): Promise<RiderSupportTicket> {
        const response = await apiClient.patch<ApiResponse<RiderSupportTicket>>(
            `/rider-settings/me/support-tickets/${ticketId}/close`,
        );
        return response.data.data;
    },

    async changePassword(input: {
        currentPassword: string;
        newPassword: string;
        confirmPassword: string;
    }): Promise<void> {
        await apiClient.post("/rider-auth/change-password", input);
    },
};
