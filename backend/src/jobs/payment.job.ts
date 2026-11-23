import { Queue, type JobsOptions } from "bullmq";

import { getRedisClient } from "../config/redis";

import { logger } from "../utils/logger";

/*
|--------------------------------------------------------------------------
| Payment Job Types
|--------------------------------------------------------------------------
*/

export type PaymentJobName =
  | "payment.initiated"
  | "payment.processing"
  | "payment.completed"
  | "payment.failed"
  | "payment.refund.requested"
  | "payment.webhook.received";

export type PaymentJobEvent =
  | "initiated"
  | "processing"
  | "completed"
  | "failed"
  | "refund.requested"
  | "webhook.received";

export interface PaymentJobData {
  paymentId: string;

  orderId?: string;

  userId?: string;

  event: PaymentJobEvent;

  provider?: string;

  transactionId?: string;

  timestamp: string;

  metadata?: Record<string, unknown>;
}

/*
|--------------------------------------------------------------------------
| Queue Configuration
|--------------------------------------------------------------------------
*/

const PAYMENT_QUEUE_NAME = "noptrix-payment-queue";

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
    count: 1_000,
  },

  removeOnFail: {
    age: 60 * 60 * 24 * 7,
    count: 5_000,
  },
};

/*
|--------------------------------------------------------------------------
| Payment Queue
|--------------------------------------------------------------------------
*/

let paymentQueue: Queue<PaymentJobData> | null = null;

/*
|--------------------------------------------------------------------------
| Get Payment Queue
|--------------------------------------------------------------------------
*/

const getPaymentQueue = (): Queue<PaymentJobData> => {
  if (paymentQueue) {
    return paymentQueue;
  }

  const redis = getRedisClient();

  paymentQueue = new Queue<PaymentJobData>(PAYMENT_QUEUE_NAME, {
    connection: redis,
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  });

  logger.info(
    {
      queue: PAYMENT_QUEUE_NAME,
    },
    "Payment queue initialized.",
  );

  return paymentQueue;
};

/*
|--------------------------------------------------------------------------
| Build Deterministic Job ID
|--------------------------------------------------------------------------
|
| Prevents accidental duplicate jobs for the
| same payment lifecycle event.
|
|--------------------------------------------------------------------------
*/

const buildPaymentJobId = (
  paymentId: string,
  event: PaymentJobEvent,
): string => {
  return `payment:${paymentId}:${event}`;
};

/*
|--------------------------------------------------------------------------
| Add Payment Job
|--------------------------------------------------------------------------
*/

export const addPaymentJob = async (
  jobName: PaymentJobName,
  data: PaymentJobData,
  options?: JobsOptions,
) => {
  const queue = getPaymentQueue();

  const jobId = buildPaymentJobId(data.paymentId, data.event);

  const job = await queue.add(jobName, data, {
    ...options,
    jobId: options?.jobId ?? jobId,
  });

  logger.info(
    {
      queue: PAYMENT_QUEUE_NAME,

      jobId: job.id,

      jobName,

      paymentId: data.paymentId,

      orderId: data.orderId,
    },
    "Payment job added.",
  );

  return job;
};

/*
|--------------------------------------------------------------------------
| Payment Initiated
|--------------------------------------------------------------------------
*/

export const enqueuePaymentInitiated = async (
  paymentId: string,
  orderId?: string,
  userId?: string,
  provider?: string,
  metadata?: Record<string, unknown>,
) => {
  return addPaymentJob("payment.initiated", {
    paymentId,
    orderId,
    userId,
    provider,
    event: "initiated",
    timestamp: new Date().toISOString(),
    metadata,
  });
};

/*
|--------------------------------------------------------------------------
| Payment Processing
|--------------------------------------------------------------------------
*/

export const enqueuePaymentProcessing = async (
  paymentId: string,
  orderId?: string,
  userId?: string,
  provider?: string,
  transactionId?: string,
  metadata?: Record<string, unknown>,
) => {
  return addPaymentJob("payment.processing", {
    paymentId,
    orderId,
    userId,
    provider,
    transactionId,
    event: "processing",
    timestamp: new Date().toISOString(),
    metadata,
  });
};

/*
|--------------------------------------------------------------------------
| Payment Completed
|--------------------------------------------------------------------------
*/

export const enqueuePaymentCompleted = async (
  paymentId: string,
  orderId?: string,
  userId?: string,
  provider?: string,
  transactionId?: string,
  metadata?: Record<string, unknown>,
) => {
  return addPaymentJob("payment.completed", {
    paymentId,
    orderId,
    userId,
    provider,
    transactionId,
    event: "completed",
    timestamp: new Date().toISOString(),
    metadata,
  });
};

/*
|--------------------------------------------------------------------------
| Payment Failed
|--------------------------------------------------------------------------
*/

export const enqueuePaymentFailed = async (
  paymentId: string,
  orderId?: string,
  userId?: string,
  provider?: string,
  transactionId?: string,
  metadata?: Record<string, unknown>,
) => {
  return addPaymentJob("payment.failed", {
    paymentId,
    orderId,
    userId,
    provider,
    transactionId,
    event: "failed",
    timestamp: new Date().toISOString(),
    metadata,
  });
};

/*
|--------------------------------------------------------------------------
| Refund Requested
|--------------------------------------------------------------------------
*/

export const enqueuePaymentRefundRequested = async (
  paymentId: string,
  orderId?: string,
  userId?: string,
  provider?: string,
  transactionId?: string,
  metadata?: Record<string, unknown>,
) => {
  return addPaymentJob("payment.refund.requested", {
    paymentId,
    orderId,
    userId,
    provider,
    transactionId,
    event: "refund.requested",
    timestamp: new Date().toISOString(),
    metadata,
  });
};

/*
|--------------------------------------------------------------------------
| Payment Webhook
|--------------------------------------------------------------------------
*/

export const enqueuePaymentWebhookReceived = async (
  paymentId: string,
  orderId?: string,
  provider?: string,
  transactionId?: string,
  metadata?: Record<string, unknown>,
) => {
  return addPaymentJob("payment.webhook.received", {
    paymentId,
    orderId,
    provider,
    transactionId,
    event: "webhook.received",
    timestamp: new Date().toISOString(),
    metadata,
  });
};

/*
|--------------------------------------------------------------------------
| Queue Health
|--------------------------------------------------------------------------
*/

export const getPaymentQueueHealth = async () => {
  const queue = getPaymentQueue();

  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);

  return {
    queue: PAYMENT_QUEUE_NAME,

    waiting,

    active,

    completed,

    failed,

    delayed,
  };
};

/*
|--------------------------------------------------------------------------
| Close Payment Queue
|--------------------------------------------------------------------------
*/

export const closePaymentQueue = async (): Promise<void> => {
  if (!paymentQueue) {
    return;
  }

  await paymentQueue.close();

  paymentQueue = null;

  logger.info(
    {
      queue: PAYMENT_QUEUE_NAME,
    },
    "Payment queue closed.",
  );
};

// Owner-only operational access; route authorization is enforced by system-monitoring.
export const getAdminPaymentQueue = getPaymentQueue;
