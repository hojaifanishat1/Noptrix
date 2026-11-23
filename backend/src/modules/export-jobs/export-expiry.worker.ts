import { Queue, Worker, type Job } from "bullmq";
import { getRedisClient } from "../../config/redis";
import { deleteFromCloudinary } from "../../services/cloudinary.service";
import { logger } from "../../utils/logger";
import { ExportJob } from "./export-job.model";

const QUEUE_NAME = "noptrix-export-expiry-cleanup";
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const BATCH_SIZE = 50;

interface CleanupPayload {
  requestedAt?: string;
}

let cleanupQueue: Queue<CleanupPayload> | undefined;
let cleanupWorker: Worker<CleanupPayload> | undefined;

const getCleanupQueue = (): Queue<CleanupPayload> => {
  if (!cleanupQueue) {
    cleanupQueue = new Queue<CleanupPayload>(QUEUE_NAME, {
      connection: getRedisClient(),
    });
  }

  return cleanupQueue;
};

export const processExpiredExports = async (): Promise<number> => {
  const expiredJobs = await ExportJob.find({
    status: "COMPLETED",
    expiresAt: { $lte: new Date() },
    cloudinaryPublicId: { $exists: true, $ne: "" },
  })
    .sort({ expiresAt: 1 })
    .limit(BATCH_SIZE)
    .select("_id jobId cloudinaryPublicId")
    .lean();

  let deletedCount = 0;

  for (const job of expiredJobs) {
    if (!job.cloudinaryPublicId) continue;

    try {
      // Export files are uploaded as authenticated raw assets.
      await deleteFromCloudinary(
        job.cloudinaryPublicId,
        "raw",
        "authenticated",
      );

      // Keep export history, but remove the expired file reference.
      const result = await ExportJob.updateOne(
        {
          _id: job._id,
          cloudinaryPublicId: job.cloudinaryPublicId,
        },
        {
          $unset: {
            cloudinaryPublicId: 1,
            cloudinaryFormat: 1,
          },
        },
      );

      if (result.modifiedCount > 0) deletedCount += 1;

      logger.info(
        { jobId: job.jobId },
        "Expired export file deleted.",
      );
    } catch (error) {
      logger.error(
        { jobId: job.jobId, error },
        "Expired export deletion failed; it will be retried.",
      );
    }
  }

  return deletedCount;
};

export const startExportExpiryWorker = async (): Promise<void> => {
  if (cleanupWorker) return;

  cleanupWorker = new Worker<CleanupPayload>(
    QUEUE_NAME,
    async (_job: Job<CleanupPayload>) => {
      await processExpiredExports();
    },
    {
      connection: getRedisClient(),
      concurrency: 1,
    },
  );

  cleanupWorker.on("failed", (job, error) => {
    logger.error(
      { cleanupJobId: job?.id, error },
      "Export expiry cleanup job failed.",
    );
  });

  cleanupWorker.on("error", (error) => {
    logger.error({ error }, "Export expiry cleanup worker error.");
  });

  await getCleanupQueue().upsertJobScheduler(
    "noptrix-export-expiry-hourly",
    { every: CLEANUP_INTERVAL_MS },
    {
      name: "cleanup-expired-exports",
      data: {},
      opts: {
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    },
  );

  logger.info("Export expiry cleanup worker started.");
};

export const stopExportExpiryWorker = async (): Promise<void> => {
  if (cleanupWorker) {
    await cleanupWorker.close();
    cleanupWorker = undefined;
  }

  if (cleanupQueue) {
    await cleanupQueue.close();
    cleanupQueue = undefined;
  }
};
