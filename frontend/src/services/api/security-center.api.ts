import apiClient from "./client";

export type SecurityView =
  | "login-history"
  | "events"
  | "suspicious"
  | "permissions"
  | "admin-activity"
  | "audit-logs"
  | "alerts";

export interface SecurityOverview {
  activeSessions: number;
  failedLogins24h: number;
  securityEvents24h: number;
  permissionChanges24h: number;
  totalAuditLogs: number;
  generatedAt: string;
}

export interface SecuritySession {
  sessionId: string;
  userId: string;
  name: string;
  email: string | null;
  phone: string | null;
  userStatus: string | null;
  accountType: string;
  status: string;
  secretVerified: boolean;
  userAgent: string | null;
  ipAddress: string | null;
  deviceId: string | null;
  lastUsedAt: string | null;
  expiresAt: string;
  createdAt: string;
}

export interface SecurityRecord {
  _id: string;
  actorId?: string;
  actorType: string;
  actorRole?: string;
  action: string;
  resource: string;
  resourceId?: string;
  description?: string;
  ipAddress?: string;
  userAgent?: string;
  method?: string;
  path?: string;
  success: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface SecurityPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data: T;
}

export const securityCenterApi = {
  async getOverview(): Promise<SecurityOverview> {
    const response = await apiClient.get<ApiEnvelope<SecurityOverview>>(
      "/security-center/overview",
    );
    return response.data.data;
  },

  async getSessions(): Promise<SecuritySession[]> {
    const response = await apiClient.get<
      ApiEnvelope<{ items: SecuritySession[]; total: number }>
    >("/security-center/sessions");
    return response.data.data.items;
  },

  async revokeSession(sessionId: string): Promise<void> {
    await apiClient.delete(`/security-center/sessions/${sessionId}`);
  },

  async getRecords(
    view: SecurityView,
    page = 1,
    limit = 20,
  ): Promise<{ items: SecurityRecord[]; pagination: SecurityPagination }> {
    const response = await apiClient.get<
      ApiEnvelope<{
        items: SecurityRecord[];
        pagination: SecurityPagination;
      }>
    >("/security-center/records", {
      params: { view, page, limit },
    });

    return response.data.data;
  },
};
