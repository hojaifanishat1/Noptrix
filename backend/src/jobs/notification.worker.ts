import { Job, Worker } from "bullmq";

import { getRedisClient } from "../config/redis";

import { logger } from "../utils/logger";

import { Notification } from "../modules/notifications/notification.model";

import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_DELIVERY_STATUSES,
  NOTIFICATION_STATUSES,
  type NotificationChannel,
  type NotificationDeliveryStatus,
  type NotificationType,
} from "../modules/notifications/notification.types";

import { updateNotificationDelivery } from "../modules/notifications/notification.service";

import {
  dispatchNotification,
  getNotificationProvider,
  NOTIFICATION_CHANNELS as SERVICE_NOTIFICATION_CHANNELS,
  NOTIFICATION_TYPES as SERVICE_NOTIFICATION_TYPES,
  NOTIFICATION_STATUSES as SERVICE_NOTIFICATION_STATUSES,
  type NotificationChannel as ServiceNotificationChannel,
  type NotificationType as ServiceNotificationType,
  type NotificationStatus as ServiceNotificationStatus,
  type Notification as ServiceNotification,
} from "../services/notification.service";

import { registerEmailNotificationProvider } from "../services/notification-providers/email.provider";

import type { NotificationJobData } from "./notification.job";

/*
|--------------------------------------------------------------------------
| Configuration
|--------------------------------------------------------------------------
*/

const NOTIFICATION_QUEUE_NAME = "noptrix-notification-queue";

const WORKER_CONCURRENCY = 10;

/*
|--------------------------------------------------------------------------
| Type Adapters
|--------------------------------------------------------------------------
|
| The persisted notification module and the existing provider service
| intentionally have different legacy value conventions.
|
| This worker is the integration boundary between them.
|--------------------------------------------------------------------------
*/

const toServiceChannel = (
  channel: NotificationChannel,
): ServiceNotificationChannel => {
  switch (channel) {
    case NOTIFICATION_CHANNELS.IN_APP:
      return SERVICE_NOTIFICATION_CHANNELS.IN_APP;

    case NOTIFICATION_CHANNELS.EMAIL:
      return SERVICE_NOTIFICATION_CHANNELS.EMAIL;

    case NOTIFICATION_CHANNELS.PUSH:
      return SERVICE_NOTIFICATION_CHANNELS.PUSH;

    case NOTIFICATION_CHANNELS.SMS:
      return SERVICE_NOTIFICATION_CHANNELS.SMS;

    default:
      throw new Error(`Unsupported notification channel: ${channel}`);
  }
};

const toServiceType = (type: NotificationType): ServiceNotificationType => {
  switch (type) {
    case "JOB_APPLICATION_STATUS":
      return "job_application_status" as ServiceNotificationType;

    case "JOB_APPLICATION_INTERVIEW":
      return "job_application_interview" as ServiceNotificationType;

    case "ORDER_STATUS":
      return SERVICE_NOTIFICATION_TYPES.ORDER_PROCESSING;

    case "PAYMENT_STATUS":
      return SERVICE_NOTIFICATION_TYPES.PAYMENT_SUCCESS;

    case "DELIVERY_STATUS":
      return SERVICE_NOTIFICATION_TYPES.DELIVERY_UPDATE;

    case "PROMOTION":
      return SERVICE_NOTIFICATION_TYPES.PROMOTION;

    case "SYSTEM":
      return SERVICE_NOTIFICATION_TYPES.SYSTEM;

    default:
      throw new Error(`Unsupported persisted notification type: ${type}`);
  }
};

const toServiceStatus = (
  status:
    | typeof NOTIFICATION_STATUSES.PENDING
    | typeof NOTIFICATION_STATUSES.SENT
    | typeof NOTIFICATION_STATUSES.PARTIAL
    | typeof NOTIFICATION_STATUSES.FAILED,
): ServiceNotificationStatus => {
  switch (status) {
    case NOTIFICATION_STATUSES.PENDING:
      return SERVICE_NOTIFICATION_STATUSES.PENDING;

    case NOTIFICATION_STATUSES.SENT:
      return SERVICE_NOTIFICATION_STATUSES.SENT;

    case NOTIFICATION_STATUSES.PARTIAL:
      return SERVICE_NOTIFICATION_STATUSES.PARTIAL;

    case NOTIFICATION_STATUSES.FAILED:
      return SERVICE_NOTIFICATION_STATUSES.FAILED;

    default:
      throw new Error(`Unsupported notification status: ${status}`);
  }
};

const mapDeliveryStatus = (status: unknown): NotificationDeliveryStatus => {
  switch (String(status).toLowerCase()) {
    case "sent":
      return NOTIFICATION_DELIVERY_STATUSES.SENT;

    case "delivered":
      return NOTIFICATION_DELIVERY_STATUSES.DELIVERED;

    case "failed":
      return NOTIFICATION_DELIVERY_STATUSES.FAILED;

    case "skipped":
      return NOTIFICATION_DELIVERY_STATUSES.SKIPPED;

    case "pending":
    default:
      return NOTIFICATION_DELIVERY_STATUSES.PENDING;
  }
};

/*
|--------------------------------------------------------------------------
| Legacy Delivery Status Adapter
|--------------------------------------------------------------------------
*/

const toServiceDeliveryStatus = (
  status: NotificationDeliveryStatus,
): import("../services/notification.service").NotificationDeliveryStatus => {
  switch (status) {
    case NOTIFICATION_DELIVERY_STATUSES.SENT:
      return "sent";

    case NOTIFICATION_DELIVERY_STATUSES.DELIVERED:
      return "delivered";

    case NOTIFICATION_DELIVERY_STATUSES.FAILED:
      return "failed";

    case NOTIFICATION_DELIVERY_STATUSES.SKIPPED:
      return "skipped";

    case NOTIFICATION_DELIVERY_STATUSES.PENDING:
    default:
      return "pending";
  }
};

/*
|--------------------------------------------------------------------------
| Notification Domain Mapper
|--------------------------------------------------------------------------
*/

const toServiceNotification = (
  notification: InstanceType<typeof Notification>,
): ServiceNotification => {
  return {
    id: notification._id.toString(),

    recipient: {
      userId: notification.recipientId.toString(),
    },

    type: toServiceType(notification.type),

    priority: notification.priority,

    content: {
      title: notification.title,

      body: notification.message,
    },

    channels: notification.channels
      .filter((channel) => channel !== NOTIFICATION_CHANNELS.IN_APP)
      .map(toServiceChannel),

    metadata: notification.metadata,

    status: toServiceStatus(notification.status),

    deliveries: notification.deliveries.map((delivery) => ({
      channel: toServiceChannel(delivery.channel),

      status: toServiceDeliveryStatus(delivery.status),

      errorCode: delivery.errorCode,

      errorMessage: delivery.errorMessage,

      providerMessageId: delivery.providerMessageId,

      attempts: delivery.attempts,
    })),

    readAt: notification.readAt,

    createdAt: notification.createdAt,

    updatedAt: notification.updatedAt,

    expiresAt: notification.expiresAt,

    idempotencyKey:
      notification.metadata &&
      typeof notification.metadata.eventKey === "string"
        ? notification.metadata.eventKey
        : undefined,
  };
};

/*
|--------------------------------------------------------------------------
| Process: notification.created
|--------------------------------------------------------------------------
*/

const processNotificationCreated = async (
  job: Job<NotificationJobData>,
): Promise<void> => {
  const notificationId = job.data.notificationId;

  if (!notificationId) {
    throw new Error("notification.created job requires notificationId.");
  }

  const notification = await Notification.findById(notificationId);

  if (!notification) {
    logger.warn(
      {
        notificationId,
      },
      "Notification worker could not find notification.",
    );

    return;
  }

  if (notification.status === NOTIFICATION_STATUSES.SENT) {
    return;
  }

  const domainNotification = toServiceNotification(notification);

  const dispatched = await dispatchNotification(domainNotification);

  for (const delivery of dispatched.deliveries) {
    const persistedChannel = notification.channels.find(
      (channel) => toServiceChannel(channel) === delivery.channel,
    );

    if (!persistedChannel) {
      logger.warn(
        {
          notificationId,
          channel: delivery.channel,
        },
        "Notification delivery channel could not be mapped.",
      );

      continue;
    }

    await updateNotificationDelivery({
      notificationId,
      channel: persistedChannel,
      status: mapDeliveryStatus(delivery.status),
      errorCode: delivery.errorCode,
      errorMessage: delivery.errorMessage,
      providerMessageId: delivery.providerMessageId,
    });
  }
};

/*
|--------------------------------------------------------------------------
| Process Direct Channel Jobs
|--------------------------------------------------------------------------
*/

const processDirectChannelNotification = async (
  job: Job<NotificationJobData>,
): Promise<void> => {
  const notificationId = job.data.notificationId;

  const channel = job.data.channel;

  if (!notificationId) {
    throw new Error(`${job.name} requires notificationId.`);
  }

  if (!channel) {
    throw new Error(`${job.name} requires channel.`);
  }

  const notification = await Notification.findById(notificationId);

  if (!notification) {
    logger.warn(
      {
        notificationId,
        channel,
      },
      "Direct notification could not find notification.",
    );

    return;
  }

  const serviceChannel = toServiceChannel(channel);

  const provider = getNotificationProvider(serviceChannel);

  if (!provider) {
    throw new Error(
      `No notification provider registered for channel: ${serviceChannel}`,
    );
  }

  const domainNotification: ServiceNotification = {
    id: notification._id.toString(),

    recipient: {
      userId: notification.recipientId.toString(),

      email: job.data.recipient.email,

      phone: job.data.recipient.phone,
    },

    type: toServiceType(notification.type),

    priority: notification.priority,

    content: {
      title: notification.title,

      body: notification.message,
    },

    channels: [serviceChannel],

    metadata: notification.metadata,

    status: toServiceStatus(notification.status),

    deliveries: [],

    createdAt: notification.createdAt,

    updatedAt: notification.updatedAt,
  };

  const result = await provider.send({
    notification: domainNotification,

    channel: serviceChannel,
  });

  await updateNotificationDelivery({
    notificationId,
    channel,
    status: mapDeliveryStatus(result.status),
    errorCode: result.errorCode,
    errorMessage: result.errorMessage,
    providerMessageId: result.providerMessageId,
  });
};

/*
|--------------------------------------------------------------------------
| Process Marked Read
|--------------------------------------------------------------------------
*/

const processNotificationMarkedRead = async (
  job: Job<NotificationJobData>,
): Promise<void> => {
  const notificationId = job.data.notificationId;

  if (!notificationId) {
    throw new Error("notification.marked-read job requires notificationId.");
  }

  const notification = await Notification.findById(notificationId);

  if (!notification) {
    logger.warn(
      {
        notificationId,
      },
      "Marked-read notification not found.",
    );

    return;
  }

  notification.readAt = new Date();

  await notification.save();
};

/*
|--------------------------------------------------------------------------
| Process Bulk
|--------------------------------------------------------------------------
*/

const processBulkNotification = async (
  job: Job<NotificationJobData>,
): Promise<void> => {
  logger.info(
    {
      jobId: job.id,
      recipientCount: Array.isArray(job.data.metadata?.recipients)
        ? (job.data.metadata?.recipients as unknown[]).length
        : undefined,
      channel: job.data.channel,
    },
    "Bulk notification job received.",
  );
};

/*
|--------------------------------------------------------------------------
| Main Processor
|--------------------------------------------------------------------------
*/

const processNotificationJob = async (
  job: Job<NotificationJobData>,
): Promise<void> => {
  switch (job.name) {
    case "notification.created":
      await processNotificationCreated(job);
      return;

    case "notification.push":
    case "notification.sms":
    case "notification.email":
      await processDirectChannelNotification(job);
      return;

    case "notification.marked-read":
      await processNotificationMarkedRead(job);
      return;

    case "notification.bulk":
      await processBulkNotification(job);
      return;

    default:
      throw new Error(`Unsupported notification job: ${job.name}`);
  }
};

/*
|--------------------------------------------------------------------------
| Worker
|--------------------------------------------------------------------------
*/

let notificationWorker: Worker<NotificationJobData> | undefined;

export const startNotificationWorker = (): Worker<NotificationJobData> => {
  if (notificationWorker) {
    return notificationWorker;
  }

  registerEmailNotificationProvider();

  notificationWorker = new Worker<NotificationJobData>(
    NOTIFICATION_QUEUE_NAME,

    processNotificationJob,

    {
      connection: getRedisClient(),

      concurrency: WORKER_CONCURRENCY,

      autorun: true,
    },
  );

  notificationWorker.on("completed", (job) => {
    logger.debug(
      {
        jobId: job.id,

        jobName: job.name,
      },
      "Notification job completed.",
    );
  });

  notificationWorker.on("failed", (job, error) => {
    logger.error(
      {
        jobId: job?.id,

        jobName: job?.name,

        error,
      },
      "Notification job failed.",
    );
  });

  notificationWorker.on("error", (error) => {
    logger.error(
      {
        error,
      },
      "Notification worker error.",
    );
  });

  logger.info(
    {
      queue: NOTIFICATION_QUEUE_NAME,

      concurrency: WORKER_CONCURRENCY,
    },
    "Notification worker started.",
  );

  return notificationWorker;
};

export const stopNotificationWorker = async (): Promise<void> => {
  if (!notificationWorker) {
    return;
  }

  await notificationWorker.close();

  notificationWorker = undefined;

  logger.info("Notification worker stopped.");
};

export const getNotificationWorker = ():
  Worker<NotificationJobData> | undefined => notificationWorker;
