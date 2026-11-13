import crypto from "crypto";

import { ApiError } from "../utils/ApiError";
import { logger } from "../utils/logger";

/*
|--------------------------------------------------------------------------
| Notification Channels
|--------------------------------------------------------------------------
*/

export const NOTIFICATION_CHANNELS = {
  IN_APP: "in_app",
  EMAIL: "email",
  SMS: "sms",
  PUSH: "push",
} as const;

export type NotificationChannel =
  (typeof NOTIFICATION_CHANNELS)[keyof typeof NOTIFICATION_CHANNELS];

/*
|--------------------------------------------------------------------------
| Notification Types
|--------------------------------------------------------------------------
*/

export const NOTIFICATION_TYPES = {
  SYSTEM: "system",
  SECURITY: "security",
  ACCOUNT: "account",

  ORDER_CREATED: "order_created",
  ORDER_CONFIRMED: "order_confirmed",
  ORDER_PROCESSING: "order_processing",
  ORDER_SHIPPED: "order_shipped",
  ORDER_DELIVERED: "order_delivered",
  ORDER_CANCELLED: "order_cancelled",

  PAYMENT_SUCCESS: "payment_success",
  PAYMENT_FAILED: "payment_failed",
  PAYMENT_REFUNDED: "payment_refunded",

  PRODUCT: "product",
  INVENTORY: "inventory",
  PROMOTION: "promotion",

  RIDER_ASSIGNED: "rider_assigned",
  DELIVERY_UPDATE: "delivery_update",

  ADMIN: "admin",
} as const;

export type NotificationType =
  (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

/*
|--------------------------------------------------------------------------
| Notification Priority
|--------------------------------------------------------------------------
*/

export const NOTIFICATION_PRIORITIES = {
  LOW: "low",
  NORMAL: "normal",
  HIGH: "high",
  CRITICAL: "critical",
} as const;

export type NotificationPriority =
  (typeof NOTIFICATION_PRIORITIES)[keyof typeof NOTIFICATION_PRIORITIES];

/*
|--------------------------------------------------------------------------
| Notification Status
|--------------------------------------------------------------------------
*/

export const NOTIFICATION_STATUSES = {
  PENDING: "pending",
  PROCESSING: "processing",
  SENT: "sent",
  PARTIAL: "partial",
  FAILED: "failed",
  CANCELLED: "cancelled",
} as const;

export type NotificationStatus =
  (typeof NOTIFICATION_STATUSES)[keyof typeof NOTIFICATION_STATUSES];

/*
|--------------------------------------------------------------------------
| Delivery Status
|--------------------------------------------------------------------------
*/

export const NOTIFICATION_DELIVERY_STATUSES = {
  PENDING: "pending",
  SENT: "sent",
  DELIVERED: "delivered",
  FAILED: "failed",
  SKIPPED: "skipped",
} as const;

export type NotificationDeliveryStatus =
  (typeof NOTIFICATION_DELIVERY_STATUSES)[keyof typeof NOTIFICATION_DELIVERY_STATUSES];

/*
|--------------------------------------------------------------------------
| Notification Metadata
|--------------------------------------------------------------------------
*/

export interface NotificationMetadata {
  readonly orderId?: string;
  readonly paymentId?: string;
  readonly invoiceId?: string;
  readonly productId?: string;
  readonly riderId?: string;
  readonly adminId?: string;

  readonly actionUrl?: string;

  readonly [key: string]: unknown;
}

/*
|--------------------------------------------------------------------------
| Notification Recipient
|--------------------------------------------------------------------------
*/

export interface NotificationRecipient {
  readonly userId?: string;
  readonly adminId?: string;
  readonly email?: string;
  readonly phone?: string;
  readonly pushToken?: string;
}

/*
|--------------------------------------------------------------------------
| Notification Content
|--------------------------------------------------------------------------
*/

export interface NotificationContent {
  readonly title: string;
  readonly body: string;

  readonly shortBody?: string;

  readonly templateId?: string;
  readonly templateVariables?: Readonly<Record<string, unknown>>;
}

/*
|--------------------------------------------------------------------------
| Channel Delivery Result
|--------------------------------------------------------------------------
*/

export interface NotificationChannelResult {
  readonly channel: NotificationChannel;
  readonly status: NotificationDeliveryStatus;
  readonly provider?: string;

  readonly providerMessageId?: string;

  readonly sentAt?: Date;
  readonly deliveredAt?: Date;

  readonly errorCode?: string;
  readonly errorMessage?: string;
}

/*
|--------------------------------------------------------------------------
| Notification
|--------------------------------------------------------------------------
*/

export interface Notification {
  readonly id: string;

  readonly recipient: NotificationRecipient;

  readonly type: NotificationType;
  readonly priority: NotificationPriority;

  readonly content: NotificationContent;

  readonly channels: readonly NotificationChannel[];

  readonly metadata?: NotificationMetadata;

  readonly status: NotificationStatus;

  readonly deliveries: readonly NotificationChannelResult[];

  readonly readAt?: Date;

  readonly createdAt: Date;
  readonly updatedAt: Date;

  readonly expiresAt?: Date;

  readonly idempotencyKey?: string;
}

/*
|--------------------------------------------------------------------------
| Create Notification Input
|--------------------------------------------------------------------------
*/

export interface CreateNotificationInput {
  readonly recipient: NotificationRecipient;

  readonly type: NotificationType;

  readonly priority?: NotificationPriority;

  readonly content: NotificationContent;

  readonly channels?: readonly NotificationChannel[];

  readonly metadata?: NotificationMetadata;

  readonly expiresAt?: Date;

  readonly idempotencyKey?: string;
}

/*
|--------------------------------------------------------------------------
| Notification Provider Adapter
|--------------------------------------------------------------------------
|
| Actual Email / SMS / Push providers are intentionally outside this file.
| Later:
|
| email.service.ts
| sms.service.ts
| push.service.ts
|
| can be connected through adapters without rewriting notification logic.
|--------------------------------------------------------------------------
*/

export interface NotificationProviderContext {
  readonly notification: Notification;
  readonly channel: NotificationChannel;
}

export interface NotificationProviderAdapter {
  readonly channel: NotificationChannel;

  send(
    context: NotificationProviderContext,
  ): Promise<NotificationChannelResult>;
}

/*
|--------------------------------------------------------------------------
| Internal Provider Registry
|--------------------------------------------------------------------------
*/

const providerRegistry = new Map<
  NotificationChannel,
  NotificationProviderAdapter
>();

/*
|--------------------------------------------------------------------------
| Defaults
|--------------------------------------------------------------------------
*/

const DEFAULT_PRIORITY: NotificationPriority = NOTIFICATION_PRIORITIES.NORMAL;

const DEFAULT_CHANNELS: readonly NotificationChannel[] = [
  NOTIFICATION_CHANNELS.IN_APP,
];

const MAX_TITLE_LENGTH = 200;
const MAX_BODY_LENGTH = 5000;
const MAX_CHANNELS = 4;

/*
|--------------------------------------------------------------------------
| Validation Helpers
|--------------------------------------------------------------------------
*/

const isNonEmptyString = (value: unknown): value is string => {
  return typeof value === "string" && value.trim().length > 0;
};

const assertNonEmptyString = (value: unknown, fieldName: string): string => {
  if (!isNonEmptyString(value)) {
    throw ApiError.badRequest(`${fieldName} is required.`, {
      code: "INVALID_NOTIFICATION_FIELD",
      details: {
        field: fieldName,
      },
    });
  }

  return value.trim();
};

const isValidChannel = (value: unknown): value is NotificationChannel => {
  return (
    typeof value === "string" &&
    Object.values(NOTIFICATION_CHANNELS).includes(value as NotificationChannel)
  );
};

const isValidType = (value: unknown): value is NotificationType => {
  return (
    typeof value === "string" &&
    Object.values(NOTIFICATION_TYPES).includes(value as NotificationType)
  );
};

const isValidPriority = (value: unknown): value is NotificationPriority => {
  return (
    typeof value === "string" &&
    Object.values(NOTIFICATION_PRIORITIES).includes(
      value as NotificationPriority,
    )
  );
};

const assertNotificationRecipient = (
  recipient: NotificationRecipient,
): void => {
  if (!recipient || typeof recipient !== "object") {
    throw ApiError.badRequest("Notification recipient is required.", {
      code: "INVALID_NOTIFICATION_RECIPIENT",
    });
  }

  const hasRecipientIdentifier =
    isNonEmptyString(recipient.userId) ||
    isNonEmptyString(recipient.adminId) ||
    isNonEmptyString(recipient.email) ||
    isNonEmptyString(recipient.phone) ||
    isNonEmptyString(recipient.pushToken);

  if (!hasRecipientIdentifier) {
    throw ApiError.badRequest(
      "At least one notification recipient identifier is required.",
      {
        code: "INVALID_NOTIFICATION_RECIPIENT",
      },
    );
  }
};

const assertNotificationContent = (content: NotificationContent): void => {
  const title = assertNonEmptyString(content?.title, "Notification title");

  const body = assertNonEmptyString(content?.body, "Notification body");

  if (title.length > MAX_TITLE_LENGTH) {
    throw ApiError.badRequest(
      `Notification title cannot exceed ${MAX_TITLE_LENGTH} characters.`,
      {
        code: "NOTIFICATION_TITLE_TOO_LONG",
      },
    );
  }

  if (body.length > MAX_BODY_LENGTH) {
    throw ApiError.badRequest(
      `Notification body cannot exceed ${MAX_BODY_LENGTH} characters.`,
      {
        code: "NOTIFICATION_BODY_TOO_LONG",
      },
    );
  }
};

const normalizeChannels = (
  channels?: readonly NotificationChannel[],
): readonly NotificationChannel[] => {
  const requestedChannels =
    channels && channels.length > 0 ? channels : DEFAULT_CHANNELS;

  if (requestedChannels.length > MAX_CHANNELS) {
    throw ApiError.badRequest(
      `A notification can use a maximum of ${MAX_CHANNELS} channels.`,
      {
        code: "TOO_MANY_NOTIFICATION_CHANNELS",
      },
    );
  }

  const uniqueChannels = [...new Set(requestedChannels)];

  for (const channel of uniqueChannels) {
    if (!isValidChannel(channel)) {
      throw ApiError.badRequest(
        `Unsupported notification channel: ${String(channel)}.`,
        {
          code: "INVALID_NOTIFICATION_CHANNEL",
          details: {
            channel,
          },
        },
      );
    }
  }

  return uniqueChannels;
};

/*
|--------------------------------------------------------------------------
| ID / Idempotency Helpers
|--------------------------------------------------------------------------
*/

const generateNotificationId = (): string => {
  return `ntf_${crypto.randomUUID()}`;
};

const generateIdempotencyKey = (input: CreateNotificationInput): string => {
  const payload = JSON.stringify({
    recipient: input.recipient,
    type: input.type,
    content: input.content,
    channels: input.channels ?? DEFAULT_CHANNELS,
    metadata: input.metadata ?? {},
  });

  return crypto.createHash("sha256").update(payload).digest("hex");
};

/*
|--------------------------------------------------------------------------
| In-Memory Idempotency Registry
|--------------------------------------------------------------------------
|
| This is intentionally lightweight.
|
| Production persistence should later move to Redis / MongoDB.
|--------------------------------------------------------------------------
*/

const idempotencyRegistry = new Map<string, Notification>();

/*
|--------------------------------------------------------------------------
| Notification Creation
|--------------------------------------------------------------------------
*/

export const createNotification = (
  input: CreateNotificationInput,
): Notification => {
  if (!input || typeof input !== "object") {
    throw ApiError.badRequest("Notification input is required.", {
      code: "INVALID_NOTIFICATION_INPUT",
    });
  }

  assertNotificationRecipient(input.recipient);

  if (!isValidType(input.type)) {
    throw ApiError.badRequest(
      `Unsupported notification type: ${String(input.type)}.`,
      {
        code: "INVALID_NOTIFICATION_TYPE",
      },
    );
  }

  const priority = input.priority ?? DEFAULT_PRIORITY;

  if (!isValidPriority(priority)) {
    throw ApiError.badRequest(
      `Unsupported notification priority: ${String(priority)}.`,
      {
        code: "INVALID_NOTIFICATION_PRIORITY",
      },
    );
  }

  assertNotificationContent(input.content);

  const channels = normalizeChannels(input.channels);

  const idempotencyKey =
    input.idempotencyKey?.trim() || generateIdempotencyKey(input);

  const existingNotification = idempotencyRegistry.get(idempotencyKey);

  if (existingNotification) {
    return existingNotification;
  }

  const now = new Date();

  const notification: Notification = {
    id: generateNotificationId(),

    recipient: input.recipient,

    type: input.type,
    priority,

    content: input.content,

    channels,

    metadata: input.metadata,

    status: NOTIFICATION_STATUSES.PENDING,

    deliveries: channels.map((channel): NotificationChannelResult => ({
      channel,
      status: NOTIFICATION_DELIVERY_STATUSES.PENDING,
    })),

    createdAt: now,
    updatedAt: now,

    expiresAt: input.expiresAt,

    idempotencyKey,
  };

  idempotencyRegistry.set(idempotencyKey, notification);

  return notification;
};

/*
|--------------------------------------------------------------------------
| Provider Registration
|--------------------------------------------------------------------------
*/

export const registerNotificationProvider = (
  adapter: NotificationProviderAdapter,
): void => {
  if (!adapter || typeof adapter !== "object") {
    throw ApiError.badRequest("Notification provider adapter is required.", {
      code: "INVALID_NOTIFICATION_PROVIDER",
    });
  }

  if (!isValidChannel(adapter.channel)) {
    throw ApiError.badRequest("Notification provider channel is invalid.", {
      code: "INVALID_NOTIFICATION_PROVIDER_CHANNEL",
    });
  }

  if (typeof adapter.send !== "function") {
    throw ApiError.badRequest("Notification provider must implement send().", {
      code: "INVALID_NOTIFICATION_PROVIDER",
    });
  }

  providerRegistry.set(adapter.channel, adapter);

  logger.info(`Notification provider registered: ${adapter.channel}`);
};

/*
|--------------------------------------------------------------------------
| Provider Removal
|--------------------------------------------------------------------------
*/

export const unregisterNotificationProvider = (
  channel: NotificationChannel,
): boolean => {
  return providerRegistry.delete(channel);
};

/*
|--------------------------------------------------------------------------
| Provider Lookup
|--------------------------------------------------------------------------
*/

export const getNotificationProvider = (
  channel: NotificationChannel,
): NotificationProviderAdapter | undefined => {
  return providerRegistry.get(channel);
};

/*
|--------------------------------------------------------------------------
| Provider Availability
|--------------------------------------------------------------------------
*/

export const isNotificationChannelAvailable = (
  channel: NotificationChannel,
): boolean => {
  return providerRegistry.has(channel);
};

/*
|--------------------------------------------------------------------------
| Notification Dispatch
|--------------------------------------------------------------------------
*/

export const dispatchNotification = async (
  notification: Notification,
): Promise<Notification> => {
  if (!notification) {
    throw ApiError.badRequest("Notification is required.", {
      code: "INVALID_NOTIFICATION",
    });
  }

  const deliveries: NotificationChannelResult[] = [];

  let successfulDeliveries = 0;
  let failedDeliveries = 0;

  for (const channel of notification.channels) {
    const provider = providerRegistry.get(channel);

    if (!provider) {
      const unavailableResult: NotificationChannelResult = {
        channel,
        status: NOTIFICATION_DELIVERY_STATUSES.SKIPPED,
        errorCode: "NOTIFICATION_PROVIDER_UNAVAILABLE",
        errorMessage: `No provider registered for channel: ${channel}.`,
      };

      deliveries.push(unavailableResult);

      continue;
    }

    try {
      const result = await provider.send({
        notification,
        channel,
      });

      deliveries.push(result);

      if (
        result.status === NOTIFICATION_DELIVERY_STATUSES.SENT ||
        result.status === NOTIFICATION_DELIVERY_STATUSES.DELIVERED
      ) {
        successfulDeliveries += 1;
      } else if (result.status === NOTIFICATION_DELIVERY_STATUSES.FAILED) {
        failedDeliveries += 1;
      }
    } catch (error) {
      failedDeliveries += 1;

      deliveries.push({
        channel,
        status: NOTIFICATION_DELIVERY_STATUSES.FAILED,
        errorCode: "NOTIFICATION_PROVIDER_ERROR",
        errorMessage:
          error instanceof Error
            ? error.message
            : "Unknown notification provider error.",
      });

      logger.error(`Notification delivery failed for channel: ${channel}`);
    }
  }

  const updatedAt = new Date();

  const activeDeliveries = deliveries.filter(
    (delivery) =>
      delivery.status !== NOTIFICATION_DELIVERY_STATUSES.SKIPPED,
  );

  let status: NotificationStatus;

  if (
    activeDeliveries.length > 0 &&
    successfulDeliveries === activeDeliveries.length
  ) {
    status = NOTIFICATION_STATUSES.SENT;
  } else if (
    activeDeliveries.length > 0 &&
    failedDeliveries === activeDeliveries.length
  ) {
    status = NOTIFICATION_STATUSES.FAILED;
  } else if (successfulDeliveries > 0 && failedDeliveries > 0) {
    status = NOTIFICATION_STATUSES.PARTIAL;
  } else {
    status = NOTIFICATION_STATUSES.PENDING;
  }

  return {
    ...notification,
    status,
    deliveries,
    updatedAt,
  };
};

/*
|--------------------------------------------------------------------------
| Mark As Read
|--------------------------------------------------------------------------
*/

export const markNotificationAsRead = (
  notification: Notification,
): Notification => {
  if (!notification) {
    throw ApiError.badRequest("Notification is required.", {
      code: "INVALID_NOTIFICATION",
    });
  }

  const now = new Date();

  return {
    ...notification,
    readAt: notification.readAt ?? now,
    updatedAt: now,
  };
};

/*
|--------------------------------------------------------------------------
| Mark As Unread
|--------------------------------------------------------------------------
*/

export const markNotificationAsUnread = (
  notification: Notification,
): Notification => {
  if (!notification) {
    throw ApiError.badRequest("Notification is required.", {
      code: "INVALID_NOTIFICATION",
    });
  }

  return {
    ...notification,
    readAt: undefined,
    updatedAt: new Date(),
  };
};

/*
|--------------------------------------------------------------------------
| Read State
|--------------------------------------------------------------------------
*/

export const isNotificationRead = (notification: Notification): boolean => {
  return notification.readAt !== undefined;
};

/*
|--------------------------------------------------------------------------
| Expiration
|--------------------------------------------------------------------------
*/

export const isNotificationExpired = (
  notification: Notification,
  now = new Date(),
): boolean => {
  if (!notification.expiresAt) {
    return false;
  }

  return notification.expiresAt.getTime() <= now.getTime();
};

/*
|--------------------------------------------------------------------------
| Cancel Notification
|--------------------------------------------------------------------------
*/

export const cancelNotification = (
  notification: Notification,
): Notification => {
  if (!notification) {
    throw ApiError.badRequest("Notification is required.", {
      code: "INVALID_NOTIFICATION",
    });
  }

  if (notification.status === NOTIFICATION_STATUSES.SENT) {
    throw ApiError.conflict("A sent notification cannot be cancelled.", {
      code: "NOTIFICATION_ALREADY_SENT",
    });
  }

  return {
    ...notification,
    status: NOTIFICATION_STATUSES.CANCELLED,
    updatedAt: new Date(),
  };
};

/*
|--------------------------------------------------------------------------
| Notification Summary
|--------------------------------------------------------------------------
*/

export interface NotificationSummary {
  readonly id: string;
  readonly type: NotificationType;
  readonly priority: NotificationPriority;
  readonly status: NotificationStatus;

  readonly isRead: boolean;
  readonly isExpired: boolean;

  readonly totalChannels: number;
  readonly successfulChannels: number;
  readonly failedChannels: number;

  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export const getNotificationSummary = (
  notification: Notification,
): NotificationSummary => {
  const successfulChannels = notification.deliveries.filter(
    (delivery) =>
      delivery.status === NOTIFICATION_DELIVERY_STATUSES.SENT ||
      delivery.status === NOTIFICATION_DELIVERY_STATUSES.DELIVERED,
  ).length;

  const failedChannels = notification.deliveries.filter(
    (delivery) => delivery.status === NOTIFICATION_DELIVERY_STATUSES.FAILED,
  ).length;

  return {
    id: notification.id,

    type: notification.type,
    priority: notification.priority,
    status: notification.status,

    isRead: isNotificationRead(notification),

    isExpired: isNotificationExpired(notification),

    totalChannels: notification.channels.length,

    successfulChannels,
    failedChannels,

    createdAt: notification.createdAt,
    updatedAt: notification.updatedAt,
  };
};

/*
|--------------------------------------------------------------------------
| Service Health
|--------------------------------------------------------------------------
*/

export interface NotificationServiceHealth {
  readonly service: "notification";
  readonly healthy: boolean;

  readonly registeredChannels: readonly NotificationChannel[];

  readonly timestamp: Date;
}

export const checkNotificationService = (): NotificationServiceHealth => {
  const registeredChannels = [...providerRegistry.keys()];

  return {
    service: "notification",

    healthy: true,

    registeredChannels,

    timestamp: new Date(),
  };
};

/*
|--------------------------------------------------------------------------
| Service Initialization
|--------------------------------------------------------------------------
*/

export const initializeNotificationService = (): NotificationServiceHealth => {
  const health = checkNotificationService();

  logger.info(
    `Notification service initialized. Registered channels: ${
      health.registeredChannels.join(", ") || "none"
    }`,
  );

  return health;
};
