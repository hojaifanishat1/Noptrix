import { Queue, Worker, type Job } from "bullmq";

import { getRedisClient } from "../config/redis";
import ProductModel from "../modules/products/product.model";
import { logger } from "../utils/logger";

const PRODUCT_PUBLISH_QUEUE_NAME = "noptrix-product-publish-queue";
const SCHEDULED_PUBLISH_JOB_NAME = "products.publish-due";
const SCHEDULED_PUBLISH_INTERVAL_MS = 60_000;

let productPublishQueue: Queue | null = null;
let productPublishWorker: Worker | null = null;

const getProductPublishQueue = (): Queue => {
  if (!productPublishQueue) {
    productPublishQueue = new Queue(PRODUCT_PUBLISH_QUEUE_NAME, {
      connection: getRedisClient(),
    });
  }
  return productPublishQueue;
};

const publishDueProducts = async (job: Job): Promise<void> => {
  if (job.name !== SCHEDULED_PUBLISH_JOB_NAME) {
    throw new Error(`Unsupported product publish job: ${job.name}`);
  }

  const now = new Date();
  const result = await ProductModel.updateMany(
    {
      status: "DRAFT",
      publishAt: { $lte: now },
    },
    {
      $set: {
        status: "ACTIVE",
        publishedAt: now,
      },
    },
  ).exec();

  if (result.modifiedCount > 0) {
    logger.info(
      { count: result.modifiedCount },
      "Scheduled products published.",
    );
  }
};

export const startProductPublishWorker = async (): Promise<void> => {
  const queue = getProductPublishQueue();
  await queue.upsertJobScheduler(
    "products-publish-due",
    { every: SCHEDULED_PUBLISH_INTERVAL_MS },
    {
      name: SCHEDULED_PUBLISH_JOB_NAME,
      data: {},
    },
  );

  if (productPublishWorker) return;

  productPublishWorker = new Worker(
    PRODUCT_PUBLISH_QUEUE_NAME,
    publishDueProducts,
    {
      connection: getRedisClient(),
      concurrency: 1,
    },
  );

  productPublishWorker.on("failed", (job, error) => {
    logger.error(
      { jobId: job?.id, error: error.message },
      "Scheduled product publishing failed.",
    );
  });

  productPublishWorker.on("error", (error) => {
    logger.error({ error: error.message }, "Product publish worker error.");
  });

  logger.info(
    { intervalMs: SCHEDULED_PUBLISH_INTERVAL_MS },
    "Product publish worker started.",
  );
};

export const stopProductPublishWorker = async (): Promise<void> => {
  await productPublishWorker?.close();
  productPublishWorker = null;
  await productPublishQueue?.close();
  productPublishQueue = null;
};
