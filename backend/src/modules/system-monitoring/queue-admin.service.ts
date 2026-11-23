import type { Queue } from "bullmq";

import { getAdminEmailQueue } from "../../jobs/email.job";
import { getAdminAnnouncementQueue } from "../../jobs/announcement.job";
import { getAdminCleanupQueue } from "../../jobs/cleanup.job";
import { getAdminNotificationQueue } from "../../jobs/notification.job";
import { getAdminPaymentQueue } from "../../jobs/payment.job";
import { getAdminReportQueue } from "../../jobs/report.job";
import { getAdminOrderQueue } from "../../jobs/order.job";

const QUEUES: Record<string, () => Queue<any>> = {
  email: getAdminEmailQueue,
  announcement: getAdminAnnouncementQueue,
  cleanup: getAdminCleanupQueue,
  notification: getAdminNotificationQueue,
  payment: getAdminPaymentQueue,
  report: getAdminReportQueue,
  order: getAdminOrderQueue,
};

export const ADMIN_QUEUE_NAMES = Object.keys(QUEUES);

const getQueue = (name: string): Queue<any> => {
  const factory = QUEUES[name];

  if (!factory) {
    throw new Error(`Unsupported queue: ${name}`);
  }

  return factory();
};

const toJobSummary = async (queueName: string, job: any) => {
  const state = await job.getState();

  return {
    id: String(job.id),
    queue: queueName,
    name: job.name,
    state,
    progress: job.progress,
    attemptsMade: job.attemptsMade,
    maxAttempts: job.opts?.attempts ?? 1,
    timestamp: job.timestamp,
    processedOn: job.processedOn ?? null,
    finishedOn: job.finishedOn ?? null,
    delay: job.delay ?? 0,
    failedReason: state === "failed" ? job.failedReason : undefined,
    stacktrace: state === "failed" ? job.stacktrace : undefined,
  };
};

export const getAdminQueueJobs = async (input: {
  queue?: string;
  state?: string;
  page?: number;
  limit?: number;
}) => {
  const page = Math.max(1, input.page ?? 1);
  const limit = Math.min(100, Math.max(1, input.limit ?? 25));
  const start = (page - 1) * limit;
  const end = start + limit - 1;

  const states = ["waiting", "active", "completed", "failed", "delayed", "paused", "waiting-children"];
  const selectedState = input.state && input.state !== "all" ? input.state : undefined;

  if (selectedState && !states.includes(selectedState)) {
    throw new Error("Invalid queue state.");
  }

  const queueNames = input.queue ? [input.queue] : ADMIN_QUEUE_NAMES;

  const results = await Promise.all(
    queueNames.map(async (queueName) => {
      const queue = getQueue(queueName);
      const jobs = await queue.getJobs(
        selectedState ? [selectedState as any] : states as any,
        start,
        end,
        true,
      );

      const summaries = await Promise.all(
        jobs.map((job) => toJobSummary(queueName, job)),
      );

      return summaries;
    }),
  );

  const items = results.flat().sort(
    (a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0),
  );

  return {
    items,
    page,
    limit,
    queues: queueNames,
  };
};

export const getAdminFailedJobs = async (input: {
  queue?: string;
  page?: number;
  limit?: number;
}) => getAdminQueueJobs({
  ...input,
  state: "failed",
});

export const retryAdminFailedJob = async (
  queueName: string,
  jobId: string,
) => {
  if (!/^[a-zA-Z0-9:_-]{1,200}$/.test(jobId)) {
    throw new Error("Invalid job ID.");
  }

  const queue = getQueue(queueName);
  const job = await queue.getJob(jobId);

  if (!job) {
    throw new Error("Job not found.");
  }

  const state = await job.getState();

  if (state !== "failed") {
    throw new Error("Only failed jobs can be retried.");
  }

  await job.retry();

  return {
    id: String(job.id),
    queue: queueName,
    state: "waiting",
    message: "Failed job queued for retry.",
  };
};
