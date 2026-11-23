import { Queue, type JobsOptions } from "bullmq";

import { getRedisClient } from "../config/redis";

import { logger } from "../utils/logger";

/*
|--------------------------------------------------------------------------
| Announcement Job Types
|--------------------------------------------------------------------------
*/

export type AnnouncementJobName =
  "announcement.publish" | "announcement.expire";

export type AnnouncementJobEvent = "publish" | "expire";

export interface AnnouncementJobData {
  announcementId: string;

  event: AnnouncementJobEvent;

  timestamp: string;

  metadata?: Record<string, unknown>;
}

/*
|--------------------------------------------------------------------------
| Queue Configuration
|--------------------------------------------------------------------------
*/

const ANNOUNCEMENT_QUEUE_NAME = "noptrix-announcement-queue";

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
| Announcement Queue
|--------------------------------------------------------------------------
*/

let announcementQueue: Queue<AnnouncementJobData> | null = null;

/*
|--------------------------------------------------------------------------
| Get Announcement Queue
|--------------------------------------------------------------------------
*/

const getAnnouncementQueue = (): Queue<AnnouncementJobData> => {
  if (announcementQueue) {
    return announcementQueue;
  }

  const redis = getRedisClient();

  announcementQueue = new Queue<AnnouncementJobData>(ANNOUNCEMENT_QUEUE_NAME, {
    connection: redis,

    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  });

  logger.info(
    {
      queue: ANNOUNCEMENT_QUEUE_NAME,
    },
    "Announcement queue initialized.",
  );

  return announcementQueue;
};

/*
|--------------------------------------------------------------------------
| Build Job ID
|--------------------------------------------------------------------------
*/

const buildAnnouncementJobId = (
  announcementId: string,
  event: AnnouncementJobEvent,
): string => {
  return ["announcement", announcementId, event].join(":");
};

/*
|--------------------------------------------------------------------------
| Add Announcement Job
|--------------------------------------------------------------------------
*/

export const addAnnouncementJob = async (
  jobName: AnnouncementJobName,
  data: AnnouncementJobData,
  options?: JobsOptions,
) => {
  const queue = getAnnouncementQueue();

  const jobId = buildAnnouncementJobId(data.announcementId, data.event);

  const job = await queue.add(jobName, data, {
    ...options,

    jobId: options?.jobId ?? jobId,
  });

  logger.info(
    {
      queue: ANNOUNCEMENT_QUEUE_NAME,

      jobId: job.id,

      jobName,

      event: data.event,

      announcementId: data.announcementId,
    },
    "Announcement job added.",
  );

  return job;
};

/*
|--------------------------------------------------------------------------
| Schedule Publish
|--------------------------------------------------------------------------
*/

export const scheduleAnnouncementPublish = async (
  announcementId: string,
  scheduledAt: Date,
  metadata?: Record<string, unknown>,
) => {
  const delay = Math.max(0, scheduledAt.getTime() - Date.now());

  return addAnnouncementJob(
    "announcement.publish",
    {
      announcementId,

      event: "publish",

      timestamp: new Date().toISOString(),

      metadata,
    },
    {
      delay,
    },
  );
};

/*
|--------------------------------------------------------------------------
| Schedule Expiration
|--------------------------------------------------------------------------
*/

export const scheduleAnnouncementExpiry = async (
  announcementId: string,
  expiresAt: Date,
  metadata?: Record<string, unknown>,
) => {
  const delay = Math.max(0, expiresAt.getTime() - Date.now());

  return addAnnouncementJob(
    "announcement.expire",
    {
      announcementId,

      event: "expire",

      timestamp: new Date().toISOString(),

      metadata,
    },
    {
      delay,
    },
  );
};

/*
|--------------------------------------------------------------------------
| Queue Health
|--------------------------------------------------------------------------
*/

export const getAnnouncementQueueHealth = async () => {
  const queue = getAnnouncementQueue();

  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),

    queue.getActiveCount(),

    queue.getCompletedCount(),

    queue.getFailedCount(),

    queue.getDelayedCount(),
  ]);

  return {
    queue: ANNOUNCEMENT_QUEUE_NAME,

    waiting,

    active,

    completed,

    failed,

    delayed,
  };
};

/*
|--------------------------------------------------------------------------
| Close Announcement Queue
|--------------------------------------------------------------------------
*/

export const closeAnnouncementQueue = async (): Promise<void> => {
  if (!announcementQueue) {
    return;
  }

  await announcementQueue.close();

  announcementQueue = null;

  logger.info(
    {
      queue: ANNOUNCEMENT_QUEUE_NAME,
    },
    "Announcement queue closed.",
  );
};

/*
|--------------------------------------------------------------------------
| Remove Announcement Job
|--------------------------------------------------------------------------
*/

export const removeAnnouncementJob = async (
  announcementId: string,
  event: AnnouncementJobEvent,
): Promise<void> => {
  const queue = getAnnouncementQueue();

  const jobId = buildAnnouncementJobId(announcementId, event);

  const job = await queue.getJob(jobId);

  if (!job) {
    return;
  }

  await job.remove();

  logger.info(
    {
      queue: ANNOUNCEMENT_QUEUE_NAME,
      jobId,
      announcementId,
      event,
    },
    "Announcement job removed.",
  );
};

// Owner-only operational access; route authorization is enforced by system-monitoring.
export const getAdminAnnouncementQueue = getAnnouncementQueue;
