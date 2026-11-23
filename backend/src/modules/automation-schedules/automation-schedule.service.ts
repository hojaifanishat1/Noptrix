import { Types } from "mongoose";
import { AutomationRule } from "../automation/automation.model";
import { AutomationSchedule } from "./automation-schedule.model";
import {
  createAutomationScheduleSchema,
  updateAutomationScheduleSchema,
  listAutomationSchedulesSchema,
} from "./automation-schedule.validator";

function nextOccurrence(
  date: Date,
  recurrence: "ONCE" | "DAILY" | "WEEKLY",
): Date | null {
  if (recurrence === "ONCE") return null;

  const next = new Date(date);
  if (recurrence === "DAILY") next.setUTCDate(next.getUTCDate() + 1);
  if (recurrence === "WEEKLY") next.setUTCDate(next.getUTCDate() + 7);
  return next;
}

export async function createAutomationSchedule(
  input: unknown,
  actorId: string,
) {
  const data = createAutomationScheduleSchema.parse(input);
  const runAt = new Date(data.runAt);

  if (runAt.getTime() <= Date.now()) {
    throw new Error("Schedule runAt must be in the future.");
  }

  if (data.kind === "RULE") {
    const rule = await AutomationRule.findById(data.ruleId).lean();
    if (!rule) throw new Error("Automation rule was not found.");
  }

  return AutomationSchedule.create({
    ...data,
    runAt,
    nextRunAt: runAt,
    status: "ACTIVE",
    createdBy: actorId,
    updatedBy: actorId,
  });
}

export async function listAutomationSchedules(input: unknown) {
  const query = listAutomationSchedulesSchema.parse(input);
  const filter: Record<string, unknown> = {};

  if (query.status) filter.status = query.status;
  if (query.kind) filter.kind = query.kind;

  const skip = (query.page - 1) * query.limit;
  const [items, total] = await Promise.all([
    AutomationSchedule.find(filter)
      .sort({ nextRunAt: 1, createdAt: -1 })
      .skip(skip)
      .limit(query.limit)
      .lean(),
    AutomationSchedule.countDocuments(filter),
  ]);

  return {
    items,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      pages: Math.ceil(total / query.limit),
    },
  };
}

export async function getAutomationSchedule(id: string) {
  if (!Types.ObjectId.isValid(id)) throw new Error("Invalid schedule ID.");
  const schedule = await AutomationSchedule.findById(id).lean();
  if (!schedule) throw new Error("Scheduled task was not found.");
  return schedule;
}

export async function updateAutomationSchedule(
  id: string,
  input: unknown,
  actorId: string,
) {
  if (!Types.ObjectId.isValid(id)) throw new Error("Invalid schedule ID.");

  const data = updateAutomationScheduleSchema.parse(input);
  const existing = await AutomationSchedule.findById(id);
  if (!existing) throw new Error("Scheduled task was not found.");

  if (existing.status === "COMPLETED") {
    throw new Error("Completed schedules cannot be edited.");
  }

  if (data.runAt) {
    const runAt = new Date(data.runAt);
    if (runAt.getTime() <= Date.now()) {
      throw new Error("Schedule runAt must be in the future.");
    }
    existing.runAt = runAt;
    existing.nextRunAt = runAt;
  }

  if (data.kind === "RULE" && data.ruleId) {
    const rule = await AutomationRule.findById(data.ruleId).lean();
    if (!rule) throw new Error("Automation rule was not found.");
  }

  if (data.name !== undefined) existing.name = data.name;
  if (data.description !== undefined) existing.description = data.description;
  if (data.recurrence !== undefined) existing.recurrence = data.recurrence;

  const targetKind = data.kind ?? existing.kind;

  if (data.kind !== undefined) {
    existing.kind = data.kind;
  }

  if (targetKind === "RULE") {
    existing.set("notification", undefined);

    if (data.ruleId !== undefined) {
      existing.ruleId = new Types.ObjectId(data.ruleId);
    }

    if (data.payload !== undefined) {
      existing.payload = data.payload;
    }
  } else {
    existing.set("ruleId", undefined);
    existing.set("payload", undefined);

    if (data.notification !== undefined) {
      existing.notification = data.notification;
    }
  }

  existing.updatedBy = actorId;
  await existing.save();
  return existing.toObject();
}

export async function setAutomationScheduleStatus(
  id: string,
  status: "ACTIVE" | "PAUSED",
  actorId: string,
) {
  if (!Types.ObjectId.isValid(id)) throw new Error("Invalid schedule ID.");

  const schedule = await AutomationSchedule.findById(id);
  if (!schedule) throw new Error("Scheduled task was not found.");
  if (schedule.status === "COMPLETED") {
    throw new Error("Completed schedules cannot be reactivated.");
  }

  schedule.status = status;
  schedule.updatedBy = actorId;

  if (status === "ACTIVE" && !schedule.nextRunAt) {
    schedule.nextRunAt = schedule.runAt;
  }

  await schedule.save();
  return schedule.toObject();
}

export async function deleteAutomationSchedule(id: string) {
  if (!Types.ObjectId.isValid(id)) throw new Error("Invalid schedule ID.");
  const result = await AutomationSchedule.findByIdAndDelete(id);
  if (!result) throw new Error("Scheduled task was not found.");
  return { deleted: true };
}
