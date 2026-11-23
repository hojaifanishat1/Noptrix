import { Queue, type JobsOptions } from "bullmq";

import { getRedisClient } from "../config/redis";

import { logger } from "../utils/logger";

/*
|--------------------------------------------------------------------------
| Cleanup Job Types
|--------------------------------------------------------------------------
*/

export type CleanupJobName =
  | "cleanup.sessions"
  | "cleanup.otp"
  | "cleanup.tokens"
  | "cleanup.abandoned-carts"
  | "cleanup.notifications"
  | "cleanup.audit-logs"
  | "cleanup.system-logs"
  | "cleanup.temp-files"
  | "cleanup.expired-data";

export type CleanupJobEvent =
  | "sessions"
  | "otp"
  | "tokens"
  | "abandoned-carts"
  | "notifications"
  | "audit-logs"
  | "system-logs"
  | "temp-files"
  | "expired-data";

export type CleanupPriority = "low" | "normal" | "high" | "critical";

/*
|--------------------------------------------------------------------------
| Cleanup Job Data
|--------------------------------------------------------------------------
*/

export interface CleanupJobData {
  cleanupId?: string;

  event: CleanupJobEvent;

  priority: CleanupPriority;

  requestedBy?: string;

  olderThanDays?: number;

  olderThanHours?: number;

  batchSize?: number;

  dryRun?: boolean;

  timestamp: string;

  metadata?: Record<string, unknown>;
}

/*
|--------------------------------------------------------------------------
| Queue Configuration
|--------------------------------------------------------------------------
*/

const CLEANUP_QUEUE_NAME = "noptrix-cleanup-queue";

/*
|--------------------------------------------------------------------------
| Default Job Options
|--------------------------------------------------------------------------
*/

const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,

  backoff: {
    type: "exponential",
    delay: 5_000,
  },

  removeOnComplete: {
    age: 60 * 60 * 24 * 2,

    count: 2_000,
  },

  removeOnFail: {
    age: 60 * 60 * 24 * 14,

    count: 5_000,
  },
};

/*
|--------------------------------------------------------------------------
| Cleanup Queue
|--------------------------------------------------------------------------
*/

let cleanupQueue: Queue<CleanupJobData> | null = null;

/*
|--------------------------------------------------------------------------
| Get Cleanup Queue
|--------------------------------------------------------------------------
*/

const getCleanupQueue = (): Queue<CleanupJobData> => {
  if (cleanupQueue) {
    return cleanupQueue;
  }

  const redis = getRedisClient();

  cleanupQueue = new Queue<CleanupJobData>(CLEANUP_QUEUE_NAME, {
    connection: redis,

    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  });

  logger.info(
    {
      queue: CLEANUP_QUEUE_NAME,
    },
    "Cleanup queue initialized.",
  );

  return cleanupQueue;
};

/*
|--------------------------------------------------------------------------
| Build Deterministic Job ID
|--------------------------------------------------------------------------
*/

const buildCleanupJobId = (
  cleanupId: string | undefined,
  event: CleanupJobEvent,
): string => {
  return ["cleanup", cleanupId ?? "scheduled", event].join(":");
};

/*
|--------------------------------------------------------------------------
| Add Cleanup Job
|--------------------------------------------------------------------------
*/

export const addCleanupJob = async (
  jobName: CleanupJobName,
  data: CleanupJobData,
  options?: JobsOptions,
) => {
  const queue = getCleanupQueue();

  const jobId = buildCleanupJobId(data.cleanupId, data.event);

  const priority =
    data.priority === "critical"
      ? 1
      : data.priority === "high"
        ? 3
        : data.priority === "normal"
          ? 5
          : 10;

  const job = await queue.add(jobName, data, {
    ...options,

    jobId: options?.jobId ?? jobId,

    priority,
  });

  logger.info(
    {
      queue: CLEANUP_QUEUE_NAME,

      jobId: job.id,

      jobName,

      cleanupId: data.cleanupId,

      event: data.event,

      priority: data.priority,

      dryRun: data.dryRun,
    },
    "Cleanup job added.",
  );

  return job;
};

/*
|--------------------------------------------------------------------------
| Cleanup Sessions
|--------------------------------------------------------------------------
*/

export const enqueueSessionCleanup = async (options?: {
  cleanupId?: string;

  olderThanHours?: number;

  batchSize?: number;

  dryRun?: boolean;

  priority?: CleanupPriority;

  metadata?: Record<string, unknown>;
}) => {
  return addCleanupJob("cleanup.sessions", {
    cleanupId: options?.cleanupId,

    event: "sessions",

    priority: options?.priority ?? "normal",

    olderThanHours: options?.olderThanHours ?? 24 * 30,

    batchSize: options?.batchSize ?? 500,

    dryRun: options?.dryRun ?? false,

    timestamp: new Date().toISOString(),

    metadata: options?.metadata,
  });
};

/*
|--------------------------------------------------------------------------
| Cleanup OTP
|--------------------------------------------------------------------------
*/

export const enqueueOtpCleanup = async (options?: {
  cleanupId?: string;

  olderThanHours?: number;

  batchSize?: number;

  dryRun?: boolean;

  priority?: CleanupPriority;

  metadata?: Record<string, unknown>;
}) => {
  return addCleanupJob("cleanup.otp", {
    cleanupId: options?.cleanupId,

    event: "otp",

    priority: options?.priority ?? "high",

    olderThanHours: options?.olderThanHours ?? 24,

    batchSize: options?.batchSize ?? 1_000,

    dryRun: options?.dryRun ?? false,

    timestamp: new Date().toISOString(),

    metadata: options?.metadata,
  });
};

/*
|--------------------------------------------------------------------------
| Cleanup Tokens
|--------------------------------------------------------------------------
*/

export const enqueueTokenCleanup = async (options?: {
  cleanupId?: string;

  olderThanHours?: number;

  batchSize?: number;

  dryRun?: boolean;

  priority?: CleanupPriority;

  metadata?: Record<string, unknown>;
}) => {
  return addCleanupJob("cleanup.tokens", {
    cleanupId: options?.cleanupId,

    event: "tokens",

    priority: options?.priority ?? "normal",

    olderThanHours: options?.olderThanHours ?? 24 * 7,

    batchSize: options?.batchSize ?? 1_000,

    dryRun: options?.dryRun ?? false,

    timestamp: new Date().toISOString(),

    metadata: options?.metadata,
  });
};

/*
|--------------------------------------------------------------------------
| Cleanup Abandoned Carts
|--------------------------------------------------------------------------
*/

export const enqueueAbandonedCartCleanup = async (options?: {
  cleanupId?: string;

  olderThanDays?: number;

  batchSize?: number;

  dryRun?: boolean;

  priority?: CleanupPriority;

  metadata?: Record<string, unknown>;
}) => {
  return addCleanupJob("cleanup.abandoned-carts", {
    cleanupId: options?.cleanupId,

    event: "abandoned-carts",

    priority: options?.priority ?? "low",

    olderThanDays: options?.olderThanDays ?? 30,

    batchSize: options?.batchSize ?? 500,

    dryRun: options?.dryRun ?? false,

    timestamp: new Date().toISOString(),

    metadata: options?.metadata,
  });
};

/*
|--------------------------------------------------------------------------
| Cleanup Notifications
|--------------------------------------------------------------------------
*/

export const enqueueNotificationCleanup = async (options?: {
  cleanupId?: string;

  olderThanDays?: number;

  batchSize?: number;

  dryRun?: boolean;

  priority?: CleanupPriority;

  metadata?: Record<string, unknown>;
}) => {
  return addCleanupJob("cleanup.notifications", {
    cleanupId: options?.cleanupId,

    event: "notifications",

    priority: options?.priority ?? "low",

    olderThanDays: options?.olderThanDays ?? 90,

    batchSize: options?.batchSize ?? 1_000,

    dryRun: options?.dryRun ?? false,

    timestamp: new Date().toISOString(),

    metadata: options?.metadata,
  });
};

/*
|--------------------------------------------------------------------------
| Cleanup Audit Logs
|--------------------------------------------------------------------------
*/

export const enqueueAuditLogCleanup = async (options?: {
  cleanupId?: string;

  olderThanDays?: number;

  batchSize?: number;

  dryRun?: boolean;

  priority?: CleanupPriority;

  metadata?: Record<string, unknown>;
}) => {
  return addCleanupJob("cleanup.audit-logs", {
    cleanupId: options?.cleanupId,

    event: "audit-logs",

    priority: options?.priority ?? "low",

    olderThanDays: options?.olderThanDays ?? 365,

    batchSize: options?.batchSize ?? 500,

    dryRun: options?.dryRun ?? false,

    timestamp: new Date().toISOString(),

    metadata: options?.metadata,
  });
};

/*
|--------------------------------------------------------------------------
| Cleanup System Logs
|--------------------------------------------------------------------------
*/

export const enqueueSystemLogCleanup = async (options?: {
  cleanupId?: string;

  olderThanDays?: number;

  batchSize?: number;

  dryRun?: boolean;

  priority?: CleanupPriority;

  metadata?: Record<string, unknown>;
}) => {
  return addCleanupJob("cleanup.system-logs", {
    cleanupId: options?.cleanupId,

    event: "system-logs",

    priority: options?.priority ?? "low",

    olderThanDays: options?.olderThanDays ?? 30,

    batchSize: options?.batchSize ?? 1_000,

    dryRun: options?.dryRun ?? false,

    timestamp: new Date().toISOString(),

    metadata: options?.metadata,
  });
};

/*
|--------------------------------------------------------------------------
| Cleanup Temporary Files
|--------------------------------------------------------------------------
*/

export const enqueueTempFileCleanup = async (options?: {
  cleanupId?: string;

  olderThanHours?: number;

  batchSize?: number;

  dryRun?: boolean;

  priority?: CleanupPriority;

  metadata?: Record<string, unknown>;
}) => {
  return addCleanupJob("cleanup.temp-files", {
    cleanupId: options?.cleanupId,

    event: "temp-files",

    priority: options?.priority ?? "normal",

    olderThanHours: options?.olderThanHours ?? 24,

    batchSize: options?.batchSize ?? 500,

    dryRun: options?.dryRun ?? false,

    timestamp: new Date().toISOString(),

    metadata: options?.metadata,
  });
};

/*
|--------------------------------------------------------------------------
| Generic Expired Data Cleanup
|--------------------------------------------------------------------------
*/

export const enqueueExpiredDataCleanup = async (options?: {
  cleanupId?: string;

  olderThanDays?: number;

  batchSize?: number;

  dryRun?: boolean;

  priority?: CleanupPriority;

  metadata?: Record<string, unknown>;
}) => {
  return addCleanupJob("cleanup.expired-data", {
    cleanupId: options?.cleanupId,

    event: "expired-data",

    priority: options?.priority ?? "normal",

    olderThanDays: options?.olderThanDays ?? 30,

    batchSize: options?.batchSize ?? 500,

    dryRun: options?.dryRun ?? false,

    timestamp: new Date().toISOString(),

    metadata: options?.metadata,
  });
};

/*
|--------------------------------------------------------------------------
| Queue Health
|--------------------------------------------------------------------------
*/

export const getCleanupQueueHealth = async () => {
  const queue = getCleanupQueue();

  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),

    queue.getActiveCount(),

    queue.getCompletedCount(),

    queue.getFailedCount(),

    queue.getDelayedCount(),
  ]);

  return {
    queue: CLEANUP_QUEUE_NAME,

    waiting,

    active,

    completed,

    failed,

    delayed,
  };
};

/*
|--------------------------------------------------------------------------
| Close Cleanup Queue
|--------------------------------------------------------------------------
*/

export const closeCleanupQueue = async (): Promise<void> => {
  if (!cleanupQueue) {
    return;
  }

  await cleanupQueue.close();

  cleanupQueue = null;

  logger.info(
    {
      queue: CLEANUP_QUEUE_NAME,
    },
    "Cleanup queue closed.",
  );
};

// Owner-only operational access; route authorization is enforced by system-monitoring.
export const getAdminCleanupQueue = getCleanupQueue;
