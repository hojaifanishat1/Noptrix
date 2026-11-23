import { Worker, type Job } from "bullmq";
import { getRedisClient } from "../../config/redis";
import { logger } from "../../utils/logger";
import { ExportJob } from "./export-job.model";
import {
  EXPORT_QUEUE_NAME,
  type ExportQueuePayload,
} from "./export-job.queue";
import { processExportJob } from "./export-job.service";

let exportWorker: Worker<ExportQueuePayload> | undefined;

export const startExportWorker = (): Worker<ExportQueuePayload> => {
  if (exportWorker) return exportWorker;

  exportWorker = new Worker<ExportQueuePayload>(
    EXPORT_QUEUE_NAME,
    async (job: Job<ExportQueuePayload>) => {
      await processExportJob(job.data.exportJobId);
    },
    {
      connection: getRedisClient(),
      concurrency: 2,
    },
  );

  exportWorker.on("completed", (job) => {
    logger.info(
      { jobId: job.data.exportJobId },
      "Export job completed.",
    );
  });

  exportWorker.on("failed", async (job, error) => {
    if (!job) return;

    logger.error(
      { jobId: job.data.exportJobId, error },
      "Export job attempt failed.",
    );

    const record = await ExportJob.findOne({
      jobId: job.data.exportJobId,
    });

    if (record && job.attemptsMade >= (job.opts.attempts ?? 1)) {
      record.status = "FAILED";
      record.errorMessage = error.message.slice(0, 1000);
      await record.save();
    }
  });

  exportWorker.on("error", (error) => {
    logger.error({ error }, "Export worker error.");
  });

  return exportWorker;
};

export const stopExportWorker = async (): Promise<void> => {
  if (!exportWorker) return;
  await exportWorker.close();
  exportWorker = undefined;
};
