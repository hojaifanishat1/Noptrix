import { Queue, type JobsOptions } from "bullmq";

import { getRedisClient } from "../config/redis";

import { logger } from "../utils/logger";

/*
|--------------------------------------------------------------------------
| Report Job Types
|--------------------------------------------------------------------------
*/

export type ReportJobName =
  | "report.sales"
  | "report.orders"
  | "report.products"
  | "report.inventory"
  | "report.customers"
  | "report.financial"
  | "report.export";

export type ReportJobEvent =
  | "sales"
  | "orders"
  | "products"
  | "inventory"
  | "customers"
  | "financial"
  | "export";

export type ReportFormat = "json" | "csv" | "xlsx" | "pdf";

export type ReportPriority = "low" | "normal" | "high" | "critical";

/*
|--------------------------------------------------------------------------
| Report Date Range
|--------------------------------------------------------------------------
*/

export interface ReportDateRange {
  from: string;

  to: string;
}

/*
|--------------------------------------------------------------------------
| Report Filters
|--------------------------------------------------------------------------
*/

export interface ReportFilters {
  userId?: string;

  adminId?: string;

  orderId?: string;

  productId?: string;

  categoryId?: string;

  brandId?: string;

  warehouseId?: string;

  paymentMethod?: string;

  orderStatus?: string;

  paymentStatus?: string;

  deliveryStatus?: string;

  search?: string;

  [key: string]: string | number | boolean | string[] | undefined;
}

/*
|--------------------------------------------------------------------------
| Report Job Data
|--------------------------------------------------------------------------
*/

export interface ReportJobData {
  reportId?: string;

  event: ReportJobEvent;

  format: ReportFormat;

  priority: ReportPriority;

  requestedBy?: string;

  dateRange?: ReportDateRange;

  filters?: ReportFilters;

  title?: string;

  timestamp: string;

  metadata?: Record<string, unknown>;
}

/*
|--------------------------------------------------------------------------
| Queue Configuration
|--------------------------------------------------------------------------
*/

const REPORT_QUEUE_NAME = "noptrix-report-queue";

/*
|--------------------------------------------------------------------------
| Default Job Options
|--------------------------------------------------------------------------
*/

const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,

  backoff: {
    type: "exponential",
    delay: 5_000,
  },

  removeOnComplete: {
    age: 60 * 60 * 24 * 2,

    count: 1_000,
  },

  removeOnFail: {
    age: 60 * 60 * 24 * 14,

    count: 5_000,
  },
};

/*
|--------------------------------------------------------------------------
| Report Queue
|--------------------------------------------------------------------------
*/

let reportQueue: Queue<ReportJobData> | null = null;

/*
|--------------------------------------------------------------------------
| Get Report Queue
|--------------------------------------------------------------------------
*/

const getReportQueue = (): Queue<ReportJobData> => {
  if (reportQueue) {
    return reportQueue;
  }

  const redis = getRedisClient();

  reportQueue = new Queue<ReportJobData>(REPORT_QUEUE_NAME, {
    connection: redis,

    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  });

  logger.info(
    {
      queue: REPORT_QUEUE_NAME,
    },
    "Report queue initialized.",
  );

  return reportQueue;
};

/*
|--------------------------------------------------------------------------
| Build Deterministic Job ID
|--------------------------------------------------------------------------
*/

const buildReportJobId = (
  reportId: string | undefined,
  event: ReportJobEvent,
  format: ReportFormat,
): string => {
  return ["report", reportId ?? "generated", event, format].join(":");
};

/*
|--------------------------------------------------------------------------
| Add Report Job
|--------------------------------------------------------------------------
*/

export const addReportJob = async (
  jobName: ReportJobName,
  data: ReportJobData,
  options?: JobsOptions,
) => {
  const queue = getReportQueue();

  const jobId = buildReportJobId(data.reportId, data.event, data.format);

  const priority =
    data.priority === "critical"
      ? 1
      : data.priority === "high"
        ? 3
        : data.priority === "normal"
          ? 5
          : 10;

  const job = await queue.add(jobName, data, {
    ...options,

    jobId: options?.jobId ?? jobId,

    priority,
  });

  logger.info(
    {
      queue: REPORT_QUEUE_NAME,

      jobId: job.id,

      jobName,

      reportId: data.reportId,

      event: data.event,

      format: data.format,

      priority: data.priority,

      requestedBy: data.requestedBy,
    },
    "Report job added.",
  );

  return job;
};

/*
|--------------------------------------------------------------------------
| Sales Report
|--------------------------------------------------------------------------
*/

export const enqueueSalesReport = async (
  format: ReportFormat,
  options?: {
    reportId?: string;

    requestedBy?: string;

    dateRange?: ReportDateRange;

    filters?: ReportFilters;

    priority?: ReportPriority;

    metadata?: Record<string, unknown>;
  },
) => {
  return addReportJob("report.sales", {
    reportId: options?.reportId,

    event: "sales",

    format,

    priority: options?.priority ?? "normal",

    requestedBy: options?.requestedBy,

    dateRange: options?.dateRange,

    filters: options?.filters,

    title: "Sales Report",

    timestamp: new Date().toISOString(),

    metadata: options?.metadata,
  });
};

/*
|--------------------------------------------------------------------------
| Order Report
|--------------------------------------------------------------------------
*/

export const enqueueOrderReport = async (
  format: ReportFormat,
  options?: {
    reportId?: string;

    requestedBy?: string;

    dateRange?: ReportDateRange;

    filters?: ReportFilters;

    priority?: ReportPriority;

    metadata?: Record<string, unknown>;
  },
) => {
  return addReportJob("report.orders", {
    reportId: options?.reportId,

    event: "orders",

    format,

    priority: options?.priority ?? "normal",

    requestedBy: options?.requestedBy,

    dateRange: options?.dateRange,

    filters: options?.filters,

    title: "Order Report",

    timestamp: new Date().toISOString(),

    metadata: options?.metadata,
  });
};

/*
|--------------------------------------------------------------------------
| Product Report
|--------------------------------------------------------------------------
*/

export const enqueueProductReport = async (
  format: ReportFormat,
  options?: {
    reportId?: string;

    requestedBy?: string;

    filters?: ReportFilters;

    priority?: ReportPriority;

    metadata?: Record<string, unknown>;
  },
) => {
  return addReportJob("report.products", {
    reportId: options?.reportId,

    event: "products",

    format,

    priority: options?.priority ?? "normal",

    requestedBy: options?.requestedBy,

    filters: options?.filters,

    title: "Product Report",

    timestamp: new Date().toISOString(),

    metadata: options?.metadata,
  });
};

/*
|--------------------------------------------------------------------------
| Inventory Report
|--------------------------------------------------------------------------
*/

export const enqueueInventoryReport = async (
  format: ReportFormat,
  options?: {
    reportId?: string;

    requestedBy?: string;

    filters?: ReportFilters;

    priority?: ReportPriority;

    metadata?: Record<string, unknown>;
  },
) => {
  return addReportJob("report.inventory", {
    reportId: options?.reportId,

    event: "inventory",

    format,

    priority: options?.priority ?? "normal",

    requestedBy: options?.requestedBy,

    filters: options?.filters,

    title: "Inventory Report",

    timestamp: new Date().toISOString(),

    metadata: options?.metadata,
  });
};

/*
|--------------------------------------------------------------------------
| Customer Report
|--------------------------------------------------------------------------
*/

export const enqueueCustomerReport = async (
  format: ReportFormat,
  options?: {
    reportId?: string;

    requestedBy?: string;

    dateRange?: ReportDateRange;

    filters?: ReportFilters;

    priority?: ReportPriority;

    metadata?: Record<string, unknown>;
  },
) => {
  return addReportJob("report.customers", {
    reportId: options?.reportId,

    event: "customers",

    format,

    priority: options?.priority ?? "normal",

    requestedBy: options?.requestedBy,

    dateRange: options?.dateRange,

    filters: options?.filters,

    title: "Customer Report",

    timestamp: new Date().toISOString(),

    metadata: options?.metadata,
  });
};

/*
|--------------------------------------------------------------------------
| Financial Report
|--------------------------------------------------------------------------
*/

export const enqueueFinancialReport = async (
  format: ReportFormat,
  options?: {
    reportId?: string;

    requestedBy?: string;

    dateRange?: ReportDateRange;

    filters?: ReportFilters;

    priority?: ReportPriority;

    metadata?: Record<string, unknown>;
  },
) => {
  return addReportJob("report.financial", {
    reportId: options?.reportId,

    event: "financial",

    format,

    priority: options?.priority ?? "high",

    requestedBy: options?.requestedBy,

    dateRange: options?.dateRange,

    filters: options?.filters,

    title: "Financial Report",

    timestamp: new Date().toISOString(),

    metadata: options?.metadata,
  });
};

/*
|--------------------------------------------------------------------------
| Generic Export Report
|--------------------------------------------------------------------------
*/

export const enqueueReportExport = async (
  format: ReportFormat,
  options?: {
    reportId?: string;

    requestedBy?: string;

    dateRange?: ReportDateRange;

    filters?: ReportFilters;

    priority?: ReportPriority;

    metadata?: Record<string, unknown>;
  },
) => {
  return addReportJob("report.export", {
    reportId: options?.reportId,

    event: "export",

    format,

    priority: options?.priority ?? "normal",

    requestedBy: options?.requestedBy,

    dateRange: options?.dateRange,

    filters: options?.filters,

    title: "Report Export",

    timestamp: new Date().toISOString(),

    metadata: options?.metadata,
  });
};

/*
|--------------------------------------------------------------------------
| Queue Health
|--------------------------------------------------------------------------
*/

export const getReportQueueHealth = async () => {
  const queue = getReportQueue();

  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),

    queue.getActiveCount(),

    queue.getCompletedCount(),

    queue.getFailedCount(),

    queue.getDelayedCount(),
  ]);

  return {
    queue: REPORT_QUEUE_NAME,

    waiting,

    active,

    completed,

    failed,

    delayed,
  };
};

/*
|--------------------------------------------------------------------------
| Close Report Queue
|--------------------------------------------------------------------------
*/

export const closeReportQueue = async (): Promise<void> => {
  if (!reportQueue) {
    return;
  }

  await reportQueue.close();

  reportQueue = null;

  logger.info(
    {
      queue: REPORT_QUEUE_NAME,
    },
    "Report queue closed.",
  );
};

// Owner-only operational access; route authorization is enforced by system-monitoring.
export const getAdminReportQueue = getReportQueue;
