import { Queue, type JobsOptions } from "bullmq";

import { getRedisClient } from "../config/redis";

import { logger } from "../utils/logger";

/*
|--------------------------------------------------------------------------
| Order Job Types
|--------------------------------------------------------------------------
*/

export type OrderJobName =
  | "order.created"
  | "order.confirmed"
  | "order.cancelled"
  | "order.refund.requested";

export interface OrderJobData {
  orderId: string;

  userId?: string;

  event: "created" | "confirmed" | "cancelled" | "refund.requested";

  timestamp: string;

  metadata?: Record<string, unknown>;
}

/*
|--------------------------------------------------------------------------
| Queue Configuration
|--------------------------------------------------------------------------
*/

const ORDER_QUEUE_NAME = "noptrix-order-queue";

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
| Queue Factory
|--------------------------------------------------------------------------
|
| Queue creation is lazy.
|
| Redis is not required during module import.
|
|--------------------------------------------------------------------------
*/

let orderQueue: Queue<OrderJobData> | null = null;

/*
|--------------------------------------------------------------------------
| Get Order Queue
|--------------------------------------------------------------------------
*/

const getOrderQueue = (): Queue<OrderJobData> => {
  if (orderQueue) {
    return orderQueue;
  }

  const redis = getRedisClient();

  orderQueue = new Queue<OrderJobData>(ORDER_QUEUE_NAME, {
    connection: redis,
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  });

  logger.info(
    {
      queue: ORDER_QUEUE_NAME,
    },
    "Order queue initialized.",
  );

  return orderQueue;
};

/*
|--------------------------------------------------------------------------
| Add Order Job
|--------------------------------------------------------------------------
*/

export const addOrderJob = async (
  jobName: OrderJobName,
  data: OrderJobData,
  options?: JobsOptions,
) => {
  const queue = getOrderQueue();

  const job = await queue.add(jobName, data, {
    ...options,
  });

  logger.info(
    {
      queue: ORDER_QUEUE_NAME,

      jobId: job.id,

      jobName,

      orderId: data.orderId,
    },
    "Order job added.",
  );

  return job;
};

/*
|--------------------------------------------------------------------------
| Order Created
|--------------------------------------------------------------------------
*/

export const enqueueOrderCreated = async (
  orderId: string,
  userId?: string,
  metadata?: Record<string, unknown>,
) => {
  return addOrderJob("order.created", {
    orderId,

    userId,

    event: "created",

    timestamp: new Date().toISOString(),

    metadata,
  });
};

/*
|--------------------------------------------------------------------------
| Order Confirmed
|--------------------------------------------------------------------------
*/

export const enqueueOrderConfirmed = async (
  orderId: string,
  userId?: string,
  metadata?: Record<string, unknown>,
) => {
  return addOrderJob("order.confirmed", {
    orderId,

    userId,

    event: "confirmed",

    timestamp: new Date().toISOString(),

    metadata,
  });
};

/*
|--------------------------------------------------------------------------
| Order Cancelled
|--------------------------------------------------------------------------
*/

export const enqueueOrderCancelled = async (
  orderId: string,
  userId?: string,
  metadata?: Record<string, unknown>,
) => {
  return addOrderJob("order.cancelled", {
    orderId,

    userId,

    event: "cancelled",

    timestamp: new Date().toISOString(),

    metadata,
  });
};

/*
|--------------------------------------------------------------------------
| Refund Requested
|--------------------------------------------------------------------------
*/

export const enqueueRefundRequested = async (
  orderId: string,
  userId?: string,
  metadata?: Record<string, unknown>,
) => {
  return addOrderJob("order.refund.requested", {
    orderId,

    userId,

    event: "refund.requested",

    timestamp: new Date().toISOString(),

    metadata,
  });
};

/*
|--------------------------------------------------------------------------
| Queue Health
|--------------------------------------------------------------------------
*/

export const getOrderQueueHealth = async () => {
  const queue = getOrderQueue();

  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);

  return {
    queue: ORDER_QUEUE_NAME,

    waiting,

    active,

    completed,

    failed,

    delayed,
  };
};

/*
|--------------------------------------------------------------------------
| Close Order Queue
|--------------------------------------------------------------------------
*/

export const closeOrderQueue = async (): Promise<void> => {
  if (!orderQueue) {
    return;
  }

  await orderQueue.close();

  orderQueue = null;

  logger.info(
    {
      queue: ORDER_QUEUE_NAME,
    },
    "Order queue closed.",
  );
};

// Owner-only operational access; route authorization is enforced by system-monitoring.
export const getAdminOrderQueue = getOrderQueue;
