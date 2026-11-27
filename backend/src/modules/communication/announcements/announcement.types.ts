import { Types } from "mongoose";

/*
|--------------------------------------------------------------------------
| Announcement Status
|--------------------------------------------------------------------------
*/

export const ANNOUNCEMENT_STATUSES = {
  DRAFT: "DRAFT",
  SCHEDULED: "SCHEDULED",
  PUBLISHED: "PUBLISHED",
  EXPIRED: "EXPIRED",
  ARCHIVED: "ARCHIVED",
} as const;

export type AnnouncementStatus =
  (typeof ANNOUNCEMENT_STATUSES)[keyof typeof ANNOUNCEMENT_STATUSES];

/*
|--------------------------------------------------------------------------
| Announcement Priority
|--------------------------------------------------------------------------
*/

export const ANNOUNCEMENT_PRIORITIES = {
  LOW: "LOW",
  NORMAL: "NORMAL",
  HIGH: "HIGH",
  URGENT: "URGENT",
} as const;

export type AnnouncementPriority =
  (typeof ANNOUNCEMENT_PRIORITIES)[keyof typeof ANNOUNCEMENT_PRIORITIES];

/*
|--------------------------------------------------------------------------
| Announcement Target Type
|--------------------------------------------------------------------------
*/

export const ANNOUNCEMENT_TARGET_TYPES = {
  ALL_ADMINS: "ALL_ADMINS",
  ALL_RIDERS: "ALL_RIDERS",
  RIDERS: "RIDERS",
  ROLES: "ROLES",
  USERS: "USERS",
} as const;

export type AnnouncementTargetType =
  (typeof ANNOUNCEMENT_TARGET_TYPES)[keyof typeof ANNOUNCEMENT_TARGET_TYPES];

/*
|--------------------------------------------------------------------------
| Attachment
|--------------------------------------------------------------------------
*/

export interface AnnouncementAttachment {
  name: string;
  url: string;
  mimeType: string;
  size: number;
}

/*
|--------------------------------------------------------------------------
| Announcement
|--------------------------------------------------------------------------
*/

export interface IAnnouncement {
  _id: Types.ObjectId;

  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;

  title: string;
  body: string;

  priority: AnnouncementPriority;

  targetType: AnnouncementTargetType;

  targetRoleIds?: Types.ObjectId[];
  targetUserIds?: Types.ObjectId[];
  targetRiderIds?: Types.ObjectId[];

  status: AnnouncementStatus;

  publishedAt?: Date;
  scheduledAt?: Date;
  expiresAt?: Date;

  attachments?: AnnouncementAttachment[];

  createdAt: Date;
  updatedAt: Date;
}

/*
|--------------------------------------------------------------------------
| Announcement Recipient
|--------------------------------------------------------------------------
*/

export interface IAnnouncementRecipient {
  _id: Types.ObjectId;

  announcementId: Types.ObjectId;
  userId: Types.ObjectId;

  deliveredAt?: Date;
  readAt?: Date;
  dismissedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}
