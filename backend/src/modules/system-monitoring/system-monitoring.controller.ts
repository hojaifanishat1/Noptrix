import type { Request, Response } from "express";

import {
  getSystemOverview,
  getApiHealth,
  getDatabaseHealth,
  getRedisHealth,
  getQueueOverview,
  getWorkerOverview,
  getEmailHealth,
  getSmsHealth,
  getPushHealth,
  getSocketHealth,
  getSystemErrors,
  getSystemDiagnostics,
} from "./system-monitoring.service";

const respond = (
  res: Response,
  data: unknown,
): void => {
  res.status(200).json({
    success: true,
    data,
  });
};

const handle = (
  callback: () => Promise<unknown> | unknown,
) => async (_req: Request, res: Response): Promise<void> => {
  try {
    respond(res, await callback());
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "System monitoring request failed",
    });
  }
};

export const systemOverviewController = handle(getSystemOverview);
export const apiHealthController = handle(getApiHealth);
export const databaseHealthController = handle(getDatabaseHealth);
export const redisHealthController = handle(getRedisHealth);
export const queueOverviewController = handle(getQueueOverview);
export const workerOverviewController = handle(getWorkerOverview);
export const emailHealthController = handle(getEmailHealth);
export const smsHealthController = handle(getSmsHealth);
export const pushHealthController = handle(getPushHealth);
export const socketHealthController = handle(getSocketHealth);
export const systemErrorsController = handle(getSystemErrors);
export const systemDiagnosticsController = handle(getSystemDiagnostics);


import {
  getAdminQueueJobs,
  getAdminFailedJobs,
  retryAdminFailedJob,
} from "./queue-admin.service";

const parsePositiveInt = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const adminQueueJobsController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const data = await getAdminQueueJobs({
      queue: typeof req.query.queue === "string" ? req.query.queue : undefined,
      state: typeof req.query.state === "string" ? req.query.state : undefined,
      page: parsePositiveInt(req.query.page, 1),
      limit: parsePositiveInt(req.query.limit, 25),
    });

    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Unable to retrieve queue jobs.",
    });
  }
};

export const adminFailedJobsController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const data = await getAdminFailedJobs({
      queue: typeof req.query.queue === "string" ? req.query.queue : undefined,
      page: parsePositiveInt(req.query.page, 1),
      limit: parsePositiveInt(req.query.limit, 25),
    });

    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Unable to retrieve failed jobs.",
    });
  }
};

export const retryAdminFailedJobController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const queue = req.params.queue;
    const jobId = req.params.jobId;

    if (typeof queue !== "string" || typeof jobId !== "string") {
      res.status(400).json({
        success: false,
        message: "Invalid queue name or job ID.",
      });
      return;
    }

    const data = await retryAdminFailedJob(queue, jobId);

    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Unable to retry failed job.",
    });
  }
};
