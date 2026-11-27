import { Document, Model, Schema, model } from "mongoose";

import {
  IAnnouncement,
  AnnouncementAttachment,
  ANNOUNCEMENT_PRIORITIES,
  ANNOUNCEMENT_STATUSES,
  ANNOUNCEMENT_TARGET_TYPES,
} from "./announcement.types";

/*
|--------------------------------------------------------------------------
| Announcement Document
|--------------------------------------------------------------------------
*/

export interface IAnnouncementDocument extends IAnnouncement, Document {}

/*
|--------------------------------------------------------------------------
| Announcement Model
|--------------------------------------------------------------------------
*/

export type AnnouncementModel = Model<IAnnouncementDocument>;

/*
|--------------------------------------------------------------------------
| Attachment Schema
|--------------------------------------------------------------------------
*/

const attachmentSchema = new Schema<AnnouncementAttachment>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
    },

    url: {
      type: String,
      required: true,
      trim: true,
    },

    mimeType: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    size: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    _id: false,
    versionKey: false,
  },
);

/*
|--------------------------------------------------------------------------
| Announcement Schema
|--------------------------------------------------------------------------
*/

const announcementSchema = new Schema<IAnnouncementDocument>(
  {
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Announcement creator is required."],
      index: true,
    },

    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },

    title: {
      type: String,
      required: [true, "Announcement title is required."],
      trim: true,
      minlength: [1, "Announcement title cannot be empty."],
      maxlength: [250, "Announcement title cannot exceed 250 characters."],
    },

    body: {
      type: String,
      required: [true, "Announcement body is required."],
      trim: true,
      minlength: [1, "Announcement body cannot be empty."],
      maxlength: [20000, "Announcement body cannot exceed 20000 characters."],
    },

    priority: {
      type: String,
      enum: {
        values: Object.values(ANNOUNCEMENT_PRIORITIES),
        message: "Invalid announcement priority.",
      },
      default: ANNOUNCEMENT_PRIORITIES.NORMAL,
      index: true,
    },

    targetType: {
      type: String,
      enum: {
        values: Object.values(ANNOUNCEMENT_TARGET_TYPES),
        message: "Invalid announcement target type.",
      },
      required: [true, "Announcement target type is required."],
      index: true,
    },

    targetRoleIds: {
      type: [
        {
          type: Schema.Types.ObjectId,
          ref: "Role",
        },
      ],
      default: undefined,
      index: true,
    },

    targetUserIds: {
      type: [
        {
          type: Schema.Types.ObjectId,
          ref: "User",
        },
      ],
      default: undefined,
      index: true,
    },

    targetRiderIds: {
      type: [
        {
          type: Schema.Types.ObjectId,
          ref: "Rider",
        },
      ],
      default: undefined,
      index: true,
    },

    status: {
      type: String,
      enum: {
        values: Object.values(ANNOUNCEMENT_STATUSES),
        message: "Invalid announcement status.",
      },
      default: ANNOUNCEMENT_STATUSES.DRAFT,
      index: true,
    },

    publishedAt: {
      type: Date,
      index: true,
    },

    scheduledAt: {
      type: Date,
      index: true,
    },

    expiresAt: {
      type: Date,
      index: true,
    },

    attachments: {
      type: [attachmentSchema],
      default: undefined,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

/*
|--------------------------------------------------------------------------
| Indexes
|--------------------------------------------------------------------------
*/

announcementSchema.index(
  {
    status: 1,
    publishedAt: -1,
    createdAt: -1,
  },
  {
    name: "announcement_status_published_createdAt",
  },
);

announcementSchema.index(
  {
    targetType: 1,
    status: 1,
    createdAt: -1,
  },
  {
    name: "announcement_target_status_createdAt",
  },
);

announcementSchema.index(
  {
    scheduledAt: 1,
    status: 1,
  },
  {
    name: "announcement_scheduled_status",
  },
);

announcementSchema.index(
  {
    expiresAt: 1,
    status: 1,
  },
  {
    name: "announcement_expiry_status",
  },
);

/*
|--------------------------------------------------------------------------
| Model Export
|--------------------------------------------------------------------------
*/

export const Announcement = model<IAnnouncementDocument, AnnouncementModel>(
  "Announcement",
  announcementSchema,
);
