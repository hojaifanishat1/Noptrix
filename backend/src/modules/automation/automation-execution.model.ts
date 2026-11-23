import { Document, Schema, Types, model } from "mongoose";

export interface IAutomationExecution {
  _id: Types.ObjectId;
  ruleId: Types.ObjectId;
  ruleName: string;
  trigger: string;
  status: "SUCCESS" | "SKIPPED" | "FAILED" | "TEST";
  eventId?: string;
  message: string;
  payload?: Record<string, unknown>;
  executedAt: Date;
}

export interface IAutomationExecutionDocument extends IAutomationExecution, Document {}

const automationExecutionSchema = new Schema<IAutomationExecutionDocument>(
  {
    ruleId: { type: Schema.Types.ObjectId, ref: "AutomationRule", required: true, index: true },
    ruleName: { type: String, required: true },
    trigger: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ["SUCCESS", "SKIPPED", "FAILED", "TEST"],
      required: true,
      index: true,
    },
    eventId: { type: String, index: true },
    message: { type: String, required: true, maxlength: 1000 },
    payload: { type: Schema.Types.Mixed },
    executedAt: { type: Date, default: Date.now, index: true },
  },
  { versionKey: false },
);

automationExecutionSchema.index({ ruleId: 1, executedAt: -1 });
automationExecutionSchema.index(
  { ruleId: 1, eventId: 1 },
  {
    unique: true,
    partialFilterExpression: { eventId: { $type: "string" } },
  },
);

export const AutomationExecution = model<IAutomationExecutionDocument>(
  "AutomationExecution",
  automationExecutionSchema,
);
