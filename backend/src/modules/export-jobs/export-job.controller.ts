import type { Request, Response } from "express";
import {
  createExportJob,
  getExportDatasetCatalog,
  getExportJobs,
  getExportDownloadUrl,
  retryExportJob,
} from "./export-job.service";

const sendError = (res: Response, error: unknown): void => {
  res.status(400).json({
    success: false,
    message: error instanceof Error ? error.message : "Export request failed.",
  });
};

export const exportDatasetCatalogController = (
  _req: Request,
  res: Response,
): void => {
  res.status(200).json({
    success: true,
    data: getExportDatasetCatalog(),
  });
};

export const createExportJobController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const requestedBy = req.ownerAuth?.userId;

    if (!requestedBy) {
      res.status(401).json({ success: false, message: "Owner authentication required." });
      return;
    }

    const { dataset, format, from, to } = req.body ?? {};

    if (
      typeof dataset !== "string" ||
      !["csv", "xlsx", "json"].includes(format)
    ) {
      res.status(400).json({
        success: false,
        message: "A valid dataset and export format are required.",
      });
      return;
    }

    const data = await createExportJob({
      dataset,
      format,
      requestedBy,
      from: typeof from === "string" ? from : undefined,
      to: typeof to === "string" ? to : undefined,
    });

    res.status(202).json({
      success: true,
      message: "Export job queued successfully.",
      data,
    });
  } catch (error) {
    sendError(res, error);
  }
};

export const getExportJobsController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 25;
    const search = typeof req.query.search === "string"
      ? req.query.search
      : undefined;

    const data = await getExportJobs({ page, limit, search });

    res.status(200).json({ success: true, ...data });
  } catch (error) {
    sendError(res, error);
  }
};

export const getExportDownloadController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const jobId = req.params.jobId;

    if (typeof jobId !== "string") {
      res.status(400).json({ success: false, message: "Invalid export job ID." });
      return;
    }

    const url = await getExportDownloadUrl(jobId);
    res.status(200).json({
      success: true,
      data: { url },
    });
  } catch (error) {
    sendError(res, error);
  }
};

export const retryExportJobController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const jobId = req.params.jobId;

    if (typeof jobId !== "string") {
      res.status(400).json({ success: false, message: "Invalid export job ID." });
      return;
    }

    const data = await retryExportJob(jobId);
    res.status(202).json({
      success: true,
      message: "Export job queued for retry.",
      data,
    });
  } catch (error) {
    sendError(res, error);
  }
};
