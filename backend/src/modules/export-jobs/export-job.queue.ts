import { Queue, type JobsOptions } from "bullmq";
import { getRedisClient } from "../../config/redis";

export const EXPORT_QUEUE_NAME = "noptrix-export-queue";

export interface ExportQueuePayload {
  exportJobId: string;
}

const defaultJobOptions: JobsOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 5000,
  },
  removeOnComplete: {
    age: 7 * 24 * 60 * 60,
    count: 1000,
  },
  removeOnFail: false,
};

let exportQueue: Queue<ExportQueuePayload> | undefined;

export const getExportQueue = (): Queue<ExportQueuePayload> => {
  if (!exportQueue) {
    exportQueue = new Queue<ExportQueuePayload>(EXPORT_QUEUE_NAME, {
      connection: getRedisClient(),
      defaultJobOptions,
    });
  }

  return exportQueue;
};

export const closeExportQueue = async (): Promise<void> => {
  if (!exportQueue) return;
  await exportQueue.close();
  exportQueue = undefined;
};
