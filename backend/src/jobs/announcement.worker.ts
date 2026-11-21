import { Worker, type Job } from "bullmq";

import { getRedisClient } from "../config/redis";

import { logger } from "../utils/logger";

import {
  publishScheduledAnnouncement,
  refreshExpiredAnnouncement,
} from "../modules/communication/announcements/announcement.service";

import type { AnnouncementJobData } from "./announcement.job";

/*
|--------------------------------------------------------------------------
| Queue Configuration
|--------------------------------------------------------------------------
*/

const ANNOUNCEMENT_QUEUE_NAME = "noptrix-announcement-queue";

/*
|--------------------------------------------------------------------------
| Worker
|--------------------------------------------------------------------------
*/

let announcementWorker: Worker<AnnouncementJobData> | null = null;

/*
|--------------------------------------------------------------------------
| Process Announcement Job
|--------------------------------------------------------------------------
*/

const processAnnouncementJob = async (
  job: Job<AnnouncementJobData>,
): Promise<void> => {
  const { announcementId, event } = job.data;

  logger.info(
    {
      jobId: job.id,
      jobName: job.name,
      announcementId,
      event,
    },
    "Processing announcement job.",
  );

  switch (event) {
    case "publish": {
      await publishScheduledAnnouncement(announcementId);

      logger.info(
        {
          announcementId,
        },
        "Scheduled announcement published.",
      );

      return;
    }

    case "expire": {
      await refreshExpiredAnnouncement(announcementId);

      logger.info(
        {
          announcementId,
        },
        "Announcement expiry job completed.",
      );

      return;
    }

    default: {
      const exhaustiveEvent: never = event;

      throw new Error(
        `Unsupported announcement job event: ${String(exhaustiveEvent)}`,
      );
    }
  }
};

/*
|--------------------------------------------------------------------------
| Start Worker
|--------------------------------------------------------------------------
*/

export const startAnnouncementWorker = (): Worker<AnnouncementJobData> => {
  if (announcementWorker) {
    return announcementWorker;
  }

  const redis = getRedisClient();

  announcementWorker = new Worker<AnnouncementJobData>(
    ANNOUNCEMENT_QUEUE_NAME,
    processAnnouncementJob,
    {
      connection: redis,

      concurrency: 5,
    },
  );

  announcementWorker.on("completed", (job) => {
    logger.info(
      {
        queue: ANNOUNCEMENT_QUEUE_NAME,

        jobId: job.id,

        jobName: job.name,
      },
      "Announcement job completed.",
    );
  });

  announcementWorker.on("failed", (job, error) => {
    logger.error(
      {
        queue: ANNOUNCEMENT_QUEUE_NAME,

        jobId: job?.id,

        jobName: job?.name,

        error: error.message,
      },
      "Announcement job failed.",
    );
  });

  announcementWorker.on("error", (error) => {
    logger.error(
      {
        queue: ANNOUNCEMENT_QUEUE_NAME,

        error: error.message,
      },
      "Announcement worker error.",
    );
  });

  logger.info(
    {
      queue: ANNOUNCEMENT_QUEUE_NAME,

      concurrency: 5,
    },
    "Announcement worker started.",
  );

  return announcementWorker;
};

/*
|--------------------------------------------------------------------------
| Stop Worker
|--------------------------------------------------------------------------
*/

export const stopAnnouncementWorker = async (): Promise<void> => {
  if (!announcementWorker) {
    return;
  }

  await announcementWorker.close();

  announcementWorker = null;

  logger.info(
    {
      queue: ANNOUNCEMENT_QUEUE_NAME,
    },
    "Announcement worker stopped.",
  );
};

export const getAnnouncementWorker = () => announcementWorker;
