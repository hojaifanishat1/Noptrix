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
