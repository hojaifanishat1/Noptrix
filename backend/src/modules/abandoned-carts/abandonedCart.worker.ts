import { Queue, Worker } from "bullmq";
import { getRedisClient } from "../../config/redis";
import { logger } from "../../utils/logger";
import {
  detectAbandonedCarts,
  expireAbandonedCarts,
  sendDueAbandonedCartEmails,
} from "./abandonedCart.service";

const QUEUE_NAME = "noptrix-abandoned-cart-queue";
const SCHEDULE_EVERY_MS = 15 * 60 * 1000;

let queue: Queue | null = null;
let worker: Worker | null = null;

export async function startAbandonedCartWorker() {
  if (worker) return;

  const connection = getRedisClient();

  queue = new Queue(QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: { age: 86400, count: 500 },
      removeOnFail: { age: 604800, count: 2000 },
    },
  });

  worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      if (job.name !== "abandoned-cart.process") return;

      const detection = await detectAbandonedCarts({
        olderThanMinutes: 60,
        batchSize: 200,
      });

      const emails = await sendDueAbandonedCartEmails({
        batchSize: 100,
      });

      const expiry = await expireAbandonedCarts(500);

      logger.info(
        { detection, emails, expiry, jobId: job.id },
        "Abandoned-cart processing completed",
      );

      return { detection, emails, expiry };
    },
    {
      connection,
      concurrency: 1,
    },
  );

  worker.on("failed", (job, error) => {
    logger.error(
      { jobId: job?.id, error },
      "Abandoned-cart processing job failed",
    );
  });

  worker.on("error", (error) => {
    logger.error({ error }, "Abandoned-cart worker error");
  });

  await queue.add(
    "abandoned-cart.process",
    {},
    {
      jobId: "abandoned-cart-initial-run",
    },
  );

  // This BullMQ version's JobsOptions does not support repeat scheduling.
  // Register this function with the project's existing scheduler/cron mechanism.
  logger.info(
    { intervalMs: SCHEDULE_EVERY_MS },
    "Abandoned-cart recurring schedule must be registered externally",
  );

  logger.info(
    { queue: QUEUE_NAME, intervalMinutes: 15 },
    "Abandoned-cart worker started",
  );
}

export async function enqueueAbandonedCartProcessing() {
  if (!queue) {
    throw new Error("Abandoned-cart worker has not been started");
  }

  return queue.add(
    "abandoned-cart.process",
    {},
    {
      jobId: `abandoned-cart-process-${Date.now()}`,
    },
  );
}

export async function closeAbandonedCartWorker() {
  if (worker) {
    await worker.close();
    worker = null;
  }

  if (queue) {
    await queue.close();
    queue = null;
  }
}

export const getAbandonedCartWorker = () => worker;
