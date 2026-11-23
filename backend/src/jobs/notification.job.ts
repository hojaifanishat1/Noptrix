import { Queue, type JobsOptions } from "bullmq";

import { getRedisClient } from "../config/redis";

import { logger } from "../utils/logger";

/*
|--------------------------------------------------------------------------
| Notification Job Types
|--------------------------------------------------------------------------
*/

export type NotificationJobName =
  | "notification.created"
  | "notification.push"
  | "notification.sms"
  | "notification.email"
  | "notification.bulk"
  | "notification.marked-read";

export type NotificationChannel = "push" | "sms" | "email" | "in-app";

export type NotificationPriority = "low" | "normal" | "high" | "critical";

export type NotificationJobEvent =
  "created" | "push" | "sms" | "email" | "bulk" | "marked-read";

export interface NotificationRecipient {
  userId?: string;

  email?: string;

  phone?: string;

  deviceTokens?: string[];
}

export interface NotificationJobData {
  notificationId?: string;

  recipient: NotificationRecipient;

  event: NotificationJobEvent;

  channel?: NotificationChannel;

  priority: NotificationPriority;

  title?: string;

  message?: string;

  templateId?: string;

  timestamp: string;

  metadata?: Record<string, unknown>;
}

/*
|--------------------------------------------------------------------------
| Queue Configuration
|--------------------------------------------------------------------------
*/

const NOTIFICATION_QUEUE_NAME = "noptrix-notification-queue";

/*
|--------------------------------------------------------------------------
| Default Job Options
|--------------------------------------------------------------------------
*/

const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 5,

  backoff: {
    type: "exponential",
    delay: 2_000,
  },

  removeOnComplete: {
    age: 60 * 60 * 24,

    count: 2_000,
  },

  removeOnFail: {
    age: 60 * 60 * 24 * 7,

    count: 10_000,
  },
};

/*
|--------------------------------------------------------------------------
| Notification Queue
|--------------------------------------------------------------------------
*/

let notificationQueue: Queue<NotificationJobData> | null = null;

/*
|--------------------------------------------------------------------------
| Get Notification Queue
|--------------------------------------------------------------------------
*/

const getNotificationQueue = (): Queue<NotificationJobData> => {
  if (notificationQueue) {
    return notificationQueue;
  }

  const redis = getRedisClient();

  notificationQueue = new Queue<NotificationJobData>(NOTIFICATION_QUEUE_NAME, {
    connection: redis,

    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  });

  logger.info(
    {
      queue: NOTIFICATION_QUEUE_NAME,
    },
    "Notification queue initialized.",
  );

  return notificationQueue;
};

/*
|--------------------------------------------------------------------------
| Build Job ID
|--------------------------------------------------------------------------
*/

const buildNotificationJobId = (
  notificationId: string | undefined,
  event: NotificationJobEvent,
  recipient: NotificationRecipient,
): string => {
  const recipientKey =
    notificationId ??
    recipient.userId ??
    recipient.email ??
    recipient.phone ??
    "unknown";

  return ["notification", recipientKey, event].join(":");
};

/*
|--------------------------------------------------------------------------
| Add Notification Job
|--------------------------------------------------------------------------
*/

export const addNotificationJob = async (
  jobName: NotificationJobName,
  data: NotificationJobData,
  options?: JobsOptions,
) => {
  const queue = getNotificationQueue();

  const jobId = buildNotificationJobId(
    data.notificationId,
    data.event,
    data.recipient,
  );

  const job = await queue.add(jobName, data, {
    ...options,

    jobId: options?.jobId ?? jobId,

    priority:
      data.priority === "critical"
        ? 1
        : data.priority === "high"
          ? 3
          : data.priority === "normal"
            ? 5
            : 10,
  });

  logger.info(
    {
      queue: NOTIFICATION_QUEUE_NAME,

      jobId: job.id,

      jobName,

      event: data.event,

      channel: data.channel,

      priority: data.priority,

      notificationId: data.notificationId,
    },
    "Notification job added.",
  );

  return job;
};

/*
|--------------------------------------------------------------------------
| Notification Created
|--------------------------------------------------------------------------
*/

export const enqueueNotificationCreated = async (
  recipient: NotificationRecipient,
  title?: string,
  message?: string,
  priority: NotificationPriority = "normal",
  metadata?: Record<string, unknown>,
  notificationId?: string,
) => {
  return addNotificationJob("notification.created", {
    notificationId,

    recipient,

    event: "created",

    priority,

    title,

    message,

    timestamp: new Date().toISOString(),

    metadata,
  });
};

/*
|--------------------------------------------------------------------------
| Push Notification
|--------------------------------------------------------------------------
*/

export const enqueuePushNotification = async (
  recipient: NotificationRecipient,
  title: string,
  message: string,
  priority: NotificationPriority = "normal",
  notificationId?: string,
  metadata?: Record<string, unknown>,
) => {
  return addNotificationJob("notification.push", {
    notificationId,

    recipient,

    event: "push",

    channel: "push",

    priority,

    title,

    message,

    timestamp: new Date().toISOString(),

    metadata,
  });
};

/*
|--------------------------------------------------------------------------
| SMS Notification
|--------------------------------------------------------------------------
*/

export const enqueueSmsNotification = async (
  recipient: NotificationRecipient,
  message: string,
  priority: NotificationPriority = "normal",
  notificationId?: string,
  metadata?: Record<string, unknown>,
) => {
  return addNotificationJob("notification.sms", {
    notificationId,

    recipient,

    event: "sms",

    channel: "sms",

    priority,

    message,

    timestamp: new Date().toISOString(),

    metadata,
  });
};

/*
|--------------------------------------------------------------------------
| Email Notification
|--------------------------------------------------------------------------
*/

export const enqueueEmailNotification = async (
  recipient: NotificationRecipient,
  title: string,
  message: string,
  priority: NotificationPriority = "normal",
  templateId?: string,
  notificationId?: string,
  metadata?: Record<string, unknown>,
) => {
  return addNotificationJob("notification.email", {
    notificationId,

    recipient,

    event: "email",

    channel: "email",

    priority,

    title,

    message,

    templateId,

    timestamp: new Date().toISOString(),

    metadata,
  });
};

/*
|--------------------------------------------------------------------------
| Bulk Notification
|--------------------------------------------------------------------------
*/

export const enqueueBulkNotification = async (
  recipients: NotificationRecipient[],
  title: string,
  message: string,
  channel: NotificationChannel,
  priority: NotificationPriority = "normal",
  metadata?: Record<string, unknown>,
) => {
  return Promise.all(
    recipients.map((recipient) =>
      addNotificationJob("notification.bulk", {
        recipient,

        event: "bulk",

        channel,

        priority,

        title,

        message,

        timestamp: new Date().toISOString(),

        metadata,
      }),
    ),
  );
};

/*
|--------------------------------------------------------------------------
| Mark Notification As Read
|--------------------------------------------------------------------------
*/

export const enqueueNotificationMarkedRead = async (
  notificationId: string,
  userId: string,
  metadata?: Record<string, unknown>,
) => {
  return addNotificationJob("notification.marked-read", {
    notificationId,

    recipient: {
      userId,
    },

    event: "marked-read",

    priority: "low",

    timestamp: new Date().toISOString(),

    metadata,
  });
};

/*
|--------------------------------------------------------------------------
| Queue Health
|--------------------------------------------------------------------------
*/

export const getNotificationQueueHealth = async () => {
  const queue = getNotificationQueue();

  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),

    queue.getActiveCount(),

    queue.getCompletedCount(),

    queue.getFailedCount(),

    queue.getDelayedCount(),
  ]);

  return {
    queue: NOTIFICATION_QUEUE_NAME,

    waiting,

    active,

    completed,

    failed,

    delayed,
  };
};

/*
|--------------------------------------------------------------------------
| Close Notification Queue
|--------------------------------------------------------------------------
*/

export const closeNotificationQueue = async (): Promise<void> => {
  if (!notificationQueue) {
    return;
  }

  await notificationQueue.close();

  notificationQueue = null;

  logger.info(
    {
      queue: NOTIFICATION_QUEUE_NAME,
    },
    "Notification queue closed.",
  );
};

// Owner-only operational access; route authorization is enforced by system-monitoring.
export const getAdminNotificationQueue = getNotificationQueue;
