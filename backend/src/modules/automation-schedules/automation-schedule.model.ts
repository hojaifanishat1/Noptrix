import { Schema, model, models, Types } from "mongoose";

export const SCHEDULE_RECURRENCES = ["ONCE", "DAILY", "WEEKLY"] as const;
export const SCHEDULE_STATUSES = ["ACTIVE", "PAUSED", "COMPLETED"] as const;
export const SCHEDULE_KINDS = ["RULE", "NOTIFICATION"] as const;

export type ScheduleRecurrence = (typeof SCHEDULE_RECURRENCES)[number];
export type ScheduleStatus = (typeof SCHEDULE_STATUSES)[number];
export type ScheduleKind = (typeof SCHEDULE_KINDS)[number];

export interface IAutomationSchedule {
  name: string;
  description?: string;
  kind: ScheduleKind;
  recurrence: ScheduleRecurrence;
  runAt: Date;
  nextRunAt: Date | null;
  lastRunAt?: Date;
  lastError?: string;
  runCount: number;
  status: ScheduleStatus;
  ruleId?: Types.ObjectId;
  payload?: Record<string, unknown>;
  notification?: {
    recipientId: string;
    templateKey: string;
    channel: "in-app";
    notificationType:
      | "JOB_APPLICATION_STATUS"
      | "JOB_APPLICATION_INTERVIEW"
      | "ORDER_STATUS"
      | "PAYMENT_STATUS"
      | "DELIVERY_STATUS"
      | "PROMOTION"
      | "SYSTEM";
    locale?: string;
    variables?: Record<string, unknown>;
  };
  createdBy: string;
  updatedBy: string;
  lockUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AutomationScheduleSchema = new Schema<IAutomationSchedule>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 1000 },
    kind: { type: String, enum: SCHEDULE_KINDS, required: true },
    recurrence: { type: String, enum: SCHEDULE_RECURRENCES, required: true },
    runAt: { type: Date, required: true },
    nextRunAt: { type: Date, default: null, index: true },
    lastRunAt: Date,
    lastError: { type: String, maxlength: 2000 },
    runCount: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: SCHEDULE_STATUSES,
      default: "ACTIVE",
      index: true,
    },
    ruleId: { type: Schema.Types.ObjectId, ref: "AutomationRule" },
    payload: { type: Schema.Types.Mixed },
    notification: {
      recipientId: String,
      templateKey: String,
      channel: { type: String, enum: ["in-app"] },
      notificationType: {
        type: String,
        enum: [
          "JOB_APPLICATION_STATUS",
          "JOB_APPLICATION_INTERVIEW",
          "ORDER_STATUS",
          "PAYMENT_STATUS",
          "DELIVERY_STATUS",
          "PROMOTION",
          "SYSTEM",
        ],
      },
      locale: String,
      variables: Schema.Types.Mixed,
    },
    createdBy: { type: String, required: true },
    updatedBy: { type: String, required: true },
    lockUntil: Date,
  },
  { timestamps: true, versionKey: false },
);

AutomationScheduleSchema.index({ status: 1, nextRunAt: 1 });
AutomationScheduleSchema.index({ createdAt: -1 });

export const AutomationSchedule =
  models.AutomationSchedule ||
  model<IAutomationSchedule>("AutomationSchedule", AutomationScheduleSchema);
