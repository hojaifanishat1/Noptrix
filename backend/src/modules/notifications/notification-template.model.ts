import { Document, Model, Schema, Types, model, models } from "mongoose";

/*
|--------------------------------------------------------------------------
| Template Status
|--------------------------------------------------------------------------
*/

export const NOTIFICATION_TEMPLATE_STATUSES = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
} as const;

export type NotificationTemplateStatus =
  (typeof NOTIFICATION_TEMPLATE_STATUSES)[keyof typeof NOTIFICATION_TEMPLATE_STATUSES];

/*
|--------------------------------------------------------------------------
| Notification Template Channels
|--------------------------------------------------------------------------
*/

export const NOTIFICATION_TEMPLATE_CHANNELS = {
  IN_APP: "in-app",
  EMAIL: "email",
  PUSH: "push",
  SMS: "sms",
} as const;

export type NotificationTemplateChannel =
  (typeof NOTIFICATION_TEMPLATE_CHANNELS)[keyof typeof NOTIFICATION_TEMPLATE_CHANNELS];

/*
|--------------------------------------------------------------------------
| Notification Template
|--------------------------------------------------------------------------
*/

export interface INotificationTemplate extends Document {
  key: string;

  name: string;

  description?: string;

  event: string;

  channel: NotificationTemplateChannel;

  locale: string;

  title: string;

  body: string;

  status: NotificationTemplateStatus;

  variables: string[];

  createdBy?: Types.ObjectId;

  updatedBy?: Types.ObjectId;

  createdAt: Date;

  updatedAt: Date;
}

/*
|--------------------------------------------------------------------------
| Schema
|--------------------------------------------------------------------------
*/

const notificationTemplateSchema = new Schema<INotificationTemplate>(
  {
    key: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      minlength: 2,
      maxlength: 150,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 200,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 1000,
    },

    event: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 100,
    },

    channel: {
      type: String,
      required: true,
      enum: Object.values(NOTIFICATION_TEMPLATE_CHANNELS),
    },

    locale: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      default: "en",
      maxlength: 20,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },

    body: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },

    status: {
      type: String,
      required: true,
      enum: Object.values(NOTIFICATION_TEMPLATE_STATUSES),
      default: NOTIFICATION_TEMPLATE_STATUSES.ACTIVE,
    },

    variables: {
      type: [
        {
          type: String,
          trim: true,
          lowercase: true,
        },
      ],
      default: [],
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
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

notificationTemplateSchema.index(
  {
    key: 1,
    channel: 1,
    locale: 1,
  },
  {
    unique: true,
  },
);

// Only one ACTIVE template per Event + Channel + Locale.
notificationTemplateSchema.index(
  {
    event: 1,
    channel: 1,
    locale: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      status: NOTIFICATION_TEMPLATE_STATUSES.ACTIVE,
    },
    name: "uniq_active_notification_template_event_channel_locale",
  },
);

notificationTemplateSchema.index({
  status: 1,
  updatedAt: -1,
});

/*
|--------------------------------------------------------------------------
| Model
|--------------------------------------------------------------------------
*/

export const NotificationTemplate: Model<INotificationTemplate> =
  models.NotificationTemplate ??
  model<INotificationTemplate>(
    "NotificationTemplate",
    notificationTemplateSchema,
  );
