export const ANNOUNCEMENT_STATUSES = [
    "DRAFT",
    "SCHEDULED",
    "PUBLISHED",
    "EXPIRED",
    "ARCHIVED",
] as const;

export const ANNOUNCEMENT_PRIORITIES = [
    "LOW",
    "NORMAL",
    "HIGH",
    "URGENT",
] as const;

export const ANNOUNCEMENT_TARGET_TYPES = [
    "ALL_ADMINS",
    "ALL_RIDERS",
    "RIDERS",
    "ROLES",
    "USERS",
] as const;

export type AnnouncementStatus =
    (typeof ANNOUNCEMENT_STATUSES)[number];

export type AnnouncementPriority =
    (typeof ANNOUNCEMENT_PRIORITIES)[number];

export type AnnouncementTargetType =
    (typeof ANNOUNCEMENT_TARGET_TYPES)[number];

export interface AnnouncementAttachment {
    name: string;
    url: string;
    mimeType: string;
    size: number;
}

export interface Announcement {
    _id: string;
    title: string;
    body: string;
    priority: AnnouncementPriority;
    targetType: AnnouncementTargetType;
    targetRoleIds?: string[];
    targetUserIds?: string[];
    targetRiderIds?: string[];
    status: AnnouncementStatus;
    createdBy?: string;
    updatedBy?: string;
    publishedAt?: string;
    scheduledAt?: string;
    expiresAt?: string;
    attachments?: AnnouncementAttachment[];
    createdAt: string;
    updatedAt: string;
}

export interface AnnouncementQuery {
    page?: number;
    limit?: number;
    status?: AnnouncementStatus;
    priority?: AnnouncementPriority;
    targetType?: AnnouncementTargetType;
    search?: string;
}

export interface AnnouncementListResponse {
    announcements: Announcement[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export interface CreateAnnouncementInput {
    title: string;
    body: string;
    priority: AnnouncementPriority;
    targetType: AnnouncementTargetType;
    targetRoleIds?: string[];
    targetUserIds?: string[];
    targetRiderIds?: string[];
    scheduledAt?: string;
    expiresAt?: string;
    attachments?: AnnouncementAttachment[];
}

export type UpdateAnnouncementInput =
    Partial<CreateAnnouncementInput>;
