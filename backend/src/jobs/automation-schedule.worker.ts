import { enqueueNotificationCreated } from "./notification.job";
import { Queue, Worker, type ConnectionOptions } from "bullmq";
import { Types } from "mongoose";
import { logger } from "../utils/logger";
import { AutomationSchedule } from "../modules/automation-schedules/automation-schedule.model";
import { executeScheduledAutomationRule } from "../modules/automation/automation.service";
import { createNotification } from "../modules/notifications/notification.service";
import { renderNotificationTemplate } from "../modules/notifications/notification-template.service";

const QUEUE_NAME = "noptrix-automation-schedule-queue";
const LOCK_MS = 5 * 60 * 1000;

function getConnection(): ConnectionOptions {
  const url = process.env.REDIS_URL;

  if (url) {
    const parsed = new URL(url);
    const database = parsed.pathname.replace("/", "");

    return {
      host: parsed.hostname,
      port: Number(parsed.port || 6379),
      username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
      password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
      db: database ? Number(database) : 0,
      ...(parsed.protocol === "rediss:" ? { tls: {} } : {}),
      maxRetriesPerRequest: null,
    };
  }

  return {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: Number(process.env.REDIS_PORT || 6379),
    username: process.env.REDIS_USERNAME || undefined,
    password: process.env.REDIS_PASSWORD || undefined,
    ...(process.env.REDIS_TLS === "true" ? { tls: {} } : {}),
    maxRetriesPerRequest: null,
  };
}

const connection = getConnection();

const queue = new Queue(QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { age: 86400, count: 2000 },
    removeOnFail: { age: 604800, count: 5000 },
  },
});

let worker: Worker | null = null;

function getNextRun(
  previous: Date,
  recurrence: "ONCE" | "DAILY" | "WEEKLY",
  now: Date,
): Date | null {
  if (recurrence === "ONCE") return null;

  const next = new Date(previous);
  do {
    next.setUTCDate(
      next.getUTCDate() + (recurrence === "DAILY" ? 1 : 7),
    );
  } while (next.getTime() <= now.getTime());

  return next;
}

async function runNotification(schedule: any, scheduledAt: Date) {
  const config = schedule.notification;

  if (!config || !Types.ObjectId.isValid(config.recipientId)) {
    throw new Error("Scheduled notification recipient is missing or invalid.");
  }

  const rendered = await renderNotificationTemplate({
    key: config.templateKey,
    channel: "in-app",
    locale: config.locale ?? "en",
    variables: {
      ...(config.variables ?? {}),
      scheduleName: schedule.name,
      scheduledAt: scheduledAt.toISOString(),
    },
  });

  const notification = await createNotification({
    recipientId: config.recipientId,
    type: config.notificationType,
    priority: "normal",
    title: rendered.title,
    message: rendered.message,
    channels: ["in-app"],
    metadata: {
      automationEventId: `${schedule._id.toString()}:${scheduledAt.toISOString()}`,
      automationScheduleId: schedule._id.toString(),
      automationTemplateId: rendered.templateId,
      automationTemplateKey: rendered.key,
    },
  });

  await enqueueNotificationCreated(
    { userId: notification.recipientId.toString() },
    notification.title,
    notification.message,
    notification.priority,
    notification.metadata,
    String(notification._id),
  );
}

async function processDueSchedules() {
  const now = new Date();

  for (let index = 0; index < 50; index += 1) {
    const schedule = await AutomationSchedule.findOneAndUpdate(
      {
        status: "ACTIVE",
        nextRunAt: { $lte: now },
        $or: [
          { lockUntil: { $exists: false } },
          { lockUntil: null },
          { lockUntil: { $lte: now } },
        ],
      },
      { $set: { lockUntil: new Date(now.getTime() + LOCK_MS) } },
      { sort: { nextRunAt: 1 }, new: true },
    );

    if (!schedule) break;

    const scheduledAt = schedule.nextRunAt ?? schedule.runAt;
    const eventId = `schedule:${schedule._id.toString()}:${scheduledAt.toISOString()}`;

    try {
      if (schedule.kind === "RULE") {
        if (!schedule.ruleId) throw new Error("Scheduled rule ID is missing.");

        const result = await executeScheduledAutomationRule(
          schedule.ruleId.toString(),
          {
            ...(schedule.payload ?? {}),
            scheduleId: schedule._id.toString(),
            scheduleName: schedule.name,
            scheduledAt: scheduledAt.toISOString(),
          },
          eventId,
        );

        if (result.status === "FAILED") throw new Error(result.message);
      } else {
        await runNotification(schedule, scheduledAt);
      }

      const nextRunAt = getNextRun(scheduledAt, schedule.recurrence, now);

      await AutomationSchedule.updateOne(
        { _id: schedule._id },
        {
          $set: {
            lastRunAt: now,
            nextRunAt,
            status: nextRunAt ? "ACTIVE" : "COMPLETED",
            lockUntil: null,
          },
          $unset: { lastError: 1 },
          $inc: { runCount: 1 },
        },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown schedule error.";

      await AutomationSchedule.updateOne(
        { _id: schedule._id },
        {
          $set: {
            lastError: message.slice(0, 2000),
            lockUntil: null,
          },
        },
      );

      logger.error(
        { scheduleId: schedule._id.toString(), error },
        "Scheduled automation task failed",
      );
    }
  }
}

export async function startAutomationScheduleWorker() {
  await queue.upsertJobScheduler(
    "automation-schedules-poll",
    { every: 60_000 },
    { name: "automation-schedules.tick", data: {} },
  );

  if (worker) return;

  worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      if (job.name === "automation-schedules.tick") {
        await processDueSchedules();
      }
    },
    { connection, concurrency: 1 },
  );

  worker.on("failed", (job, error) => {
    logger.error({ jobId: job?.id, error }, "Automation schedule worker job failed");
  });

  logger.info("Automation schedule worker started.");
}

export async function stopAutomationScheduleWorker() {
  if (worker) {
    await worker.close();
    worker = null;
  }

  await queue.close();
  logger.info("Automation schedule worker stopped.");
}
