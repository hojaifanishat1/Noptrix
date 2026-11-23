import { Types } from "mongoose";

import { ApiError } from "../../utils/ApiError";

import { Notification } from "./notification.model";

import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_DELIVERY_STATUSES,
  NOTIFICATION_PRIORITIES,
  NOTIFICATION_STATUSES,
  type CreateNotificationInput,
  type INotification,
  type NotificationChannel,
  type NotificationDelivery,
  type NotificationDeliveryStatus,
  type NotificationMetadata,
  type NotificationPriority,
  type NotificationType,
} from "./notification.types";

/*
|--------------------------------------------------------------------------
| Types
|--------------------------------------------------------------------------
*/

export interface NotificationListQuery {
  readonly page?: number;
  readonly limit?: number;
  readonly unreadOnly?: boolean;
  readonly type?: NotificationType;
}

export interface NotificationListResult {
  readonly notifications: INotification[];
  readonly pagination: {
    readonly page: number;
    readonly limit: number;
    readonly total: number;
    readonly totalPages: number;
    readonly hasNextPage: boolean;
    readonly hasPreviousPage: boolean;
  };
}

export interface NotificationSummary {
  readonly total: number;
  readonly unread: number;
  readonly read: number;
}

export interface UpdateDeliveryInput {
  readonly notificationId: string;
  readonly channel: NotificationChannel;
  readonly status: NotificationDeliveryStatus;
  readonly provider?: string;
  readonly providerMessageId?: string;
  readonly errorCode?: string;
  readonly errorMessage?: string;
}

/*
|--------------------------------------------------------------------------
| Constants
|--------------------------------------------------------------------------
*/

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/*
|--------------------------------------------------------------------------
| Validation
|--------------------------------------------------------------------------
*/

const assertObjectId = (value: string, fieldName: string): Types.ObjectId => {
  if (!Types.ObjectId.isValid(value)) {
    throw ApiError.badRequest(`Invalid ${fieldName}.`);
  }

  return new Types.ObjectId(value);
};

const normalizePagination = (page?: number, limit?: number) => {
  const normalizedPage =
    Number.isFinite(page) && page! > 0 ? Math.floor(page!) : DEFAULT_PAGE;

  const normalizedLimit =
    Number.isFinite(limit) && limit! > 0
      ? Math.min(Math.floor(limit!), MAX_LIMIT)
      : DEFAULT_LIMIT;

  return {
    page: normalizedPage,
    limit: normalizedLimit,
  };
};

/*
|--------------------------------------------------------------------------
| Default Channels
|--------------------------------------------------------------------------
*/

const normalizeChannels = (
  channels?: readonly NotificationChannel[],
): NotificationChannel[] => {
  const values =
    channels && channels.length > 0
      ? [...channels]
      : [NOTIFICATION_CHANNELS.IN_APP];

  return [...new Set(values)];
};

/*
|--------------------------------------------------------------------------
| Delivery Records
|--------------------------------------------------------------------------
*/

const buildDeliveryRecords = (
  channels: readonly NotificationChannel[],
): NotificationDelivery[] => {
  return channels.map((channel) => ({
    channel,

    status: NOTIFICATION_DELIVERY_STATUSES.PENDING,

    attempts: 0,
  }));
};

/*
|--------------------------------------------------------------------------
| Notification Creation
|--------------------------------------------------------------------------
*/

export const createNotification = async (
  input: CreateNotificationInput,
): Promise<INotification> => {
  if (!input) {
    throw ApiError.badRequest("Notification input is required.");
  }

  const recipientId =
    typeof input.recipientId === "string"
      ? assertObjectId(input.recipientId, "recipientId")
      : input.recipientId;

  if (!recipientId || !Types.ObjectId.isValid(recipientId)) {
    throw ApiError.badRequest("Invalid notification recipient.");
  }

  const title = input.title?.trim();

  const message = input.message?.trim();

  if (!title) {
    throw ApiError.badRequest("Notification title is required.");
  }

  if (!message) {
    throw ApiError.badRequest("Notification message is required.");
  }

  const channels = normalizeChannels(input.channels);

  /*
        |--------------------------------------------------------------------------
        | Idempotency
        |--------------------------------------------------------------------------
        |
        | For event-driven notifications we use
        | applicationId / orderId / paymentId
        | together with type + status where available.
        |
        | This prevents accidental duplicate notifications.
        |--------------------------------------------------------------------------
        */

  const metadata = input.metadata;

  const eventKey = buildEventKey(recipientId.toString(), input.type, metadata);

  if (eventKey) {
    const existing = await Notification.findOne({
      recipientId,
      type: input.type,
      "metadata.eventKey": eventKey,
    }).lean();

    if (existing) {
      return existing as INotification;
    }
  }

  const notification = await Notification.create({
    recipientId,

    type: input.type,

    priority: input.priority ?? NOTIFICATION_PRIORITIES.NORMAL,

    title,

    message,

    channels,

    status: NOTIFICATION_STATUSES.PENDING,

    deliveries: buildDeliveryRecords(channels),

    metadata: eventKey
      ? {
          ...(metadata ?? {}),
          eventKey,
        }
      : metadata,

    expiresAt: input.expiresAt ?? undefined,
  });

  return notification.toObject();
};

/*
|--------------------------------------------------------------------------
| Event Key
|--------------------------------------------------------------------------
*/

const buildEventKey = (
  recipientId: string,
  type: NotificationType,
  metadata?: NotificationMetadata,
): string | undefined => {
  if (!metadata) {
    return undefined;
  }

  const entityId =
    metadata.automationEventId ??
    metadata.applicationId ??
    metadata.orderId ??
    metadata.paymentId ??
    metadata.deliveryId;

  if (!entityId) {
    return undefined;
  }

  const eventStatus = metadata.status ?? "default";

  const previousStatus = metadata.previousStatus ?? "none";

  return [recipientId, type, entityId, previousStatus, eventStatus].join(":");
};

/*
|--------------------------------------------------------------------------
| Get Notification
|--------------------------------------------------------------------------
*/

export const getNotificationById = async (
  notificationId: string,
): Promise<INotification> => {
  const _id = assertObjectId(notificationId, "notificationId");

  const notification = await Notification.findById(_id).lean();

  if (!notification) {
    throw ApiError.notFound("Notification not found.");
  }

  return notification;
};

/*
|--------------------------------------------------------------------------
| Get User Notification
|--------------------------------------------------------------------------
*/

export const getUserNotification = async (
  userId: string,
  notificationId: string,
): Promise<INotification> => {
  const recipientId = assertObjectId(userId, "userId");

  const _id = assertObjectId(notificationId, "notificationId");

  const notification = await Notification.findOne({
    _id,
    recipientId,
  }).lean();

  if (!notification) {
    throw ApiError.notFound("Notification not found.");
  }

  return notification;
};

/*
|--------------------------------------------------------------------------
| List User Notifications
|--------------------------------------------------------------------------
*/

export const listUserNotifications = async (
  userId: string,
  query: NotificationListQuery = {},
): Promise<NotificationListResult> => {
  const recipientId = assertObjectId(userId, "userId");

  const { page, limit } = normalizePagination(query.page, query.limit);

  const filter: Record<string, unknown> = {
    recipientId,
  };

  if (query.unreadOnly) {
    filter.readAt = null;
  }

  if (query.type) {
    filter.type = query.type;
  }

  filter.$or = [
    {
      expiresAt: null,
    },
    {
      expiresAt: {
        $gt: new Date(),
      },
    },
  ];

  const skip = (page - 1) * limit;

  const [notifications, total] = await Promise.all([
    Notification.find(filter)
      .sort({
        createdAt: -1,
      })
      .skip(skip)
      .limit(limit)
      .lean(),

    Notification.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    notifications,

    pagination: {
      page,
      limit,
      total,
      totalPages,

      hasNextPage: page < totalPages,

      hasPreviousPage: page > 1,
    },
  };
};

/*
|--------------------------------------------------------------------------
| Notification Summary
|--------------------------------------------------------------------------
*/

export const getUserNotificationSummary = async (
  userId: string,
): Promise<NotificationSummary> => {
  const recipientId = assertObjectId(userId, "userId");

  const activeFilter = {
    recipientId,

    $or: [
      {
        expiresAt: null,
      },
      {
        expiresAt: {
          $gt: new Date(),
        },
      },
    ],
  };

  const [total, unread] = await Promise.all([
    Notification.countDocuments(activeFilter),

    Notification.countDocuments({
      ...activeFilter,

      readAt: null,
    }),
  ]);

  return {
    total,

    unread,

    read: Math.max(total - unread, 0),
  };
};

/*
|--------------------------------------------------------------------------
| Mark One Notification As Read
|--------------------------------------------------------------------------
*/

export const markNotificationAsRead = async (
  userId: string,
  notificationId: string,
): Promise<INotification> => {
  const recipientId = assertObjectId(userId, "userId");

  const _id = assertObjectId(notificationId, "notificationId");

  const notification = await Notification.findOneAndUpdate(
    {
      _id,
      recipientId,
    },
    {
      $set: {
        readAt: new Date(),
      },
    },
    {
      new: true,
    },
  ).lean();

  if (!notification) {
    throw ApiError.notFound("Notification not found.");
  }

  return notification;
};

/*
|--------------------------------------------------------------------------
| Mark One Notification As Unread
|--------------------------------------------------------------------------
*/

export const markNotificationAsUnread = async (
  userId: string,
  notificationId: string,
): Promise<INotification> => {
  const recipientId = assertObjectId(userId, "userId");

  const _id = assertObjectId(notificationId, "notificationId");

  const notification = await Notification.findOneAndUpdate(
    {
      _id,
      recipientId,
    },
    {
      $set: {
        readAt: null,
      },
    },
    {
      new: true,
    },
  ).lean();

  if (!notification) {
    throw ApiError.notFound("Notification not found.");
  }

  return notification;
};

/*
|--------------------------------------------------------------------------
| Mark All As Read
|--------------------------------------------------------------------------
*/

export const markAllNotificationsAsRead = async (
  userId: string,
): Promise<number> => {
  const recipientId = assertObjectId(userId, "userId");

  const result = await Notification.updateMany(
    {
      recipientId,
      readAt: null,

      $or: [
        {
          expiresAt: null,
        },
        {
          expiresAt: {
            $gt: new Date(),
          },
        },
      ],
    },
    {
      $set: {
        readAt: new Date(),
      },
    },
  );

  return result.modifiedCount;
};

/*
|--------------------------------------------------------------------------
| Delete Notification
|--------------------------------------------------------------------------
*/

export const deleteUserNotification = async (
  userId: string,
  notificationId: string,
): Promise<void> => {
  const recipientId = assertObjectId(userId, "userId");

  const _id = assertObjectId(notificationId, "notificationId");

  const result = await Notification.deleteOne({
    _id,
    recipientId,
  });

  if (result.deletedCount === 0) {
    throw ApiError.notFound("Notification not found.");
  }
};

/*
|--------------------------------------------------------------------------
| Update Delivery
|--------------------------------------------------------------------------
*/

export const updateNotificationDelivery = async (
  input: UpdateDeliveryInput,
): Promise<INotification> => {
  const _id = assertObjectId(input.notificationId, "notificationId");

  const notification = await Notification.findById(_id);

  if (!notification) {
    throw ApiError.notFound("Notification not found.");
  }

  const delivery = notification.deliveries.find(
    (item) => item.channel === input.channel,
  );

  if (!delivery) {
    throw ApiError.notFound("Notification delivery channel not found.");
  }

  delivery.status = input.status;

  delivery.attempts += 1;

  if (input.provider) {
    delivery.provider = input.provider;
  }

  if (input.providerMessageId) {
    delivery.providerMessageId = input.providerMessageId;
  }

  if (input.errorCode) {
    delivery.errorCode = input.errorCode;
  }

  if (input.errorMessage) {
    delivery.errorMessage = input.errorMessage;
  }

  const now = new Date();

  if (input.status === NOTIFICATION_DELIVERY_STATUSES.SENT) {
    delivery.sentAt = now;
  }

  if (input.status === NOTIFICATION_DELIVERY_STATUSES.DELIVERED) {
    delivery.deliveredAt = now;
  }

  if (input.status === NOTIFICATION_DELIVERY_STATUSES.FAILED) {
    delivery.failedAt = now;
  }

  notification.status = calculateNotificationStatus(notification.deliveries);

  await notification.save();

  return notification.toObject();
};

/*
|--------------------------------------------------------------------------
| Calculate Notification Status
|--------------------------------------------------------------------------
*/

const calculateNotificationStatus = (
  deliveries: readonly NotificationDelivery[],
): NotificationPriority extends never
  ? never
  : (typeof NOTIFICATION_STATUSES)[keyof typeof NOTIFICATION_STATUSES] => {
  if (deliveries.length === 0) {
    return NOTIFICATION_STATUSES.PENDING;
  }

  const successful = deliveries.filter(
    (delivery) =>
      delivery.status === NOTIFICATION_DELIVERY_STATUSES.SENT ||
      delivery.status === NOTIFICATION_DELIVERY_STATUSES.DELIVERED,
  ).length;

  const failed = deliveries.filter(
    (delivery) => delivery.status === NOTIFICATION_DELIVERY_STATUSES.FAILED,
  ).length;

  const pending = deliveries.filter(
    (delivery) => delivery.status === NOTIFICATION_DELIVERY_STATUSES.PENDING,
  ).length;

  if (successful === deliveries.length) {
    return NOTIFICATION_STATUSES.SENT;
  }

  if (failed === deliveries.length) {
    return NOTIFICATION_STATUSES.FAILED;
  }

  if (successful > 0 && pending === 0) {
    return NOTIFICATION_STATUSES.PARTIAL;
  }

  return NOTIFICATION_STATUSES.PENDING;
};

/*
|--------------------------------------------------------------------------
| Retry Failed Delivery
|--------------------------------------------------------------------------
*/

export const resetFailedNotificationDelivery = async (
  notificationId: string,
  channel: NotificationChannel,
): Promise<INotification> => {
  const _id = assertObjectId(notificationId, "notificationId");

  const notification = await Notification.findById(_id);

  if (!notification) {
    throw ApiError.notFound("Notification not found.");
  }

  const delivery = notification.deliveries.find(
    (item) => item.channel === channel,
  );

  if (!delivery) {
    throw ApiError.notFound("Notification delivery channel not found.");
  }

  if (delivery.status !== NOTIFICATION_DELIVERY_STATUSES.FAILED) {
    throw ApiError.badRequest(
      "Only failed notification deliveries can be retried.",
    );
  }

  delivery.status = NOTIFICATION_DELIVERY_STATUSES.PENDING;

  delivery.errorCode = undefined;

  delivery.errorMessage = undefined;

  delivery.failedAt = undefined;

  await notification.save();

  return notification.toObject();
};
