import mongoose from "mongoose";

import { env } from "../../config/env";
import { getRedisState, isRedisHealthy } from "../../config/redis";

import {
  checkEmailService,
} from "../../services/email.service";

import {
  checkSmsService,
} from "../../services/sms.service";

import {
  checkPushService,
} from "../../services/push.service";

import {
  getEmailQueueHealth,
} from "../../jobs/email.job";

import {
  getAnnouncementQueueHealth,
} from "../../jobs/announcement.job";

import {
  getCleanupQueueHealth,
} from "../../jobs/cleanup.job";

import {
  getNotificationQueueHealth,
} from "../../jobs/notification.job";

import {
  getPaymentQueueHealth,
} from "../../jobs/payment.job";

import {
  getReportQueueHealth,
} from "../../jobs/report.job";

import {
  getOrderQueueHealth,
} from "../../jobs/order.job";

import { SystemLog } from "../system-logs/system-log.model";

const startedAt = new Date();

const safeCheck = async <T>(
  callback: () => Promise<T> | T,
): Promise<{ success: boolean; data?: T; error?: string }> => {
  try {
    return {
      success: true,
      data: await callback(),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Health check failed",
    };
  }
};

export const getSystemOverview = async () => {
  const [database, redis, email, sms, push, queues] = await Promise.all([
    safeCheck(async () => {
      const db = mongoose.connection.db;

      if (mongoose.connection.readyState !== 1 || !db) {
        throw new Error("MongoDB connection is not ready");
      }

      await db.admin().ping();

      return {
        connected: true,
        readyState: mongoose.connection.readyState,
        database: mongoose.connection.name,
      };
    }),

    safeCheck(async () => ({
      ...getRedisState(),
      healthy: isRedisHealthy(),
    })),

    safeCheck(() => checkEmailService()),
    safeCheck(() => checkSmsService()),
    safeCheck(() => checkPushService()),

    safeCheck(() => getQueueOverview()),
  ]);

  const dependencies = {
    database,
    redis,
    email,
    sms,
    push,
    queues,
  };

  const dependencyChecks = [
    database.success && database.data,
    redis.success && redis.data?.healthy,
  ];

  const healthy = dependencyChecks.every(Boolean);

  return {
    success: true,
    service: "NOPTRIX API",
    status: healthy ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    startedAt: startedAt.toISOString(),
    environment: env.NODE_ENV,
    dependencies,
  };
};

export const getDatabaseHealth = async () =>
  safeCheck(async () => {
    const db = mongoose.connection.db;

    if (mongoose.connection.readyState !== 1 || !db) {
      throw new Error("MongoDB is not connected");
    }

    const started = Date.now();
    await db.admin().ping();

    return {
      connected: true,
      database: mongoose.connection.name,
      readyState: mongoose.connection.readyState,
      latencyMs: Date.now() - started,
    };
  });

export const getRedisHealth = async () =>
  safeCheck(async () => {
    const state = getRedisState();

    return {
      ...state,
      healthy: isRedisHealthy(),
    };
  });

export const getQueueOverview = async () => {
  const queueChecks = await Promise.all([
    safeCheck(() => getEmailQueueHealth()),
    safeCheck(() => getAnnouncementQueueHealth()),
    safeCheck(() => getCleanupQueueHealth()),
    safeCheck(() => getNotificationQueueHealth()),
    safeCheck(() => getPaymentQueueHealth()),
    safeCheck(() => getReportQueueHealth()),
    safeCheck(() => getOrderQueueHealth()),
  ]);

  const names = [
    "email",
    "announcement",
    "cleanup",
    "notification",
    "payment",
    "report",
    "order",
  ];

  return Object.fromEntries(
    names.map((name, index) => [name, queueChecks[index]]),
  );
};

export const getApiHealth = async () => ({
  success: true,
  status: "healthy",
  service: "NOPTRIX API",
  timestamp: new Date().toISOString(),
  uptimeSeconds: Math.floor(process.uptime()),
  nodeVersion: process.version,
  environment: env.NODE_ENV,
  memory: process.memoryUsage(),
});

export const getWorkerOverview = async () => ({
  productPublish: {
    status: "runtime_status_not_exposed",
    running: null,
  },
  notification: {
    status: "runtime_status_not_exposed",
    running: null,
  },
  announcement: {
    status: "runtime_status_not_exposed",
    running: null,
  },
  abandonedCart: {
    status: "runtime_status_not_exposed",
    running: null,
  },
  note: "Worker runtime getters will be connected in the next implementation step.",
});

export const getEmailHealth = async () => safeCheck(() => checkEmailService());

export const getSmsHealth = async () => safeCheck(() => checkSmsService());

export const getPushHealth = async () => safeCheck(() => checkPushService());

export const getSocketHealth = async () => ({
  success: true,
  status: "not_exposed",
  message: "Socket namespace metrics are not exposed by the current socket modules.",
});

export const getSystemErrors = async () => {
  const items = await SystemLog.find({
    level: { $in: ["ERROR", "FATAL"] },
  })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean()
    .exec();

  return {
    success: true,
    totalReturned: items.length,
    items,
  };
};

export const getSystemDiagnostics = async () => {
  const [database, redis, queues] = await Promise.all([
    getDatabaseHealth(),
    getRedisHealth(),
    safeCheck(() => getQueueOverview()),
  ]);

  return {
    success: true,
    timestamp: new Date().toISOString(),
    process: {
      pid: process.pid,
      uptimeSeconds: Math.floor(process.uptime()),
      nodeVersion: process.version,
      platform: process.platform,
      memory: process.memoryUsage(),
    },
    database,
    redis,
    queues,
  };
};
