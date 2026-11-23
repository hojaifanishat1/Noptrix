import { Document, Model, Schema, Types, model } from "mongoose";

export const AUTOMATION_TRIGGERS = [
  "ORDER_CREATED",
  "ORDER_CONFIRMED",
  "ORDER_CANCELLED",
  "PAYMENT_COMPLETED",
  "REFUND_REQUESTED",
  "REFUND_COMPLETED",
  "SELLER_APPROVED",
  "SELLER_SUSPENDED",
  "DELIVERY_ASSIGNED",
  "DELIVERY_COMPLETED",
] as const;

export type AutomationTrigger = (typeof AUTOMATION_TRIGGERS)[number];

export type AutomationAction =
  | {
      type: "LOG_EVENT";
      config: Record<string, unknown>;
    }
  | {
      type: "SEND_NOTIFICATION";
      config: {
        recipientIdPath: string;
        notificationType:
          | "JOB_APPLICATION_STATUS"
          | "JOB_APPLICATION_INTERVIEW"
          | "ORDER_STATUS"
          | "PAYMENT_STATUS"
          | "DELIVERY_STATUS"
          | "PROMOTION"
          | "SYSTEM";
        locale?: string;
      };
    };

export interface IAutomationRule {
  _id: Types.ObjectId;
  name: string;
  description?: string;
  trigger: AutomationTrigger;
  enabled: boolean;
  conditions: Array<{
    field: string;
    operator: "equals" | "not_equals" | "greater_than" | "less_than" | "contains";
    value: string | number | boolean;
  }>;
  action: AutomationAction;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAutomationRuleDocument extends IAutomationRule, Document {}
export type AutomationRuleModel = Model<IAutomationRuleDocument>;

const conditionSchema = new Schema(
  {
    field: { type: String, required: true, trim: true, maxlength: 100 },
    operator: {
      type: String,
      enum: ["equals", "not_equals", "greater_than", "less_than", "contains"],
      required: true,
    },
    value: { type: Schema.Types.Mixed, required: true },
  },
  { _id: false },
);

const automationRuleSchema = new Schema<IAutomationRuleDocument>(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 1000 },
    trigger: { type: String, enum: AUTOMATION_TRIGGERS, required: true, index: true },
    enabled: { type: Boolean, default: false, index: true },
    conditions: { type: [conditionSchema], default: [] },
    action: {
      type: {
        type: String,
        enum: ["LOG_EVENT", "SEND_NOTIFICATION"],
        required: true,
        default: "LOG_EVENT",
      },
      config: { type: Schema.Types.Mixed, default: {} },
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, versionKey: false },
);

automationRuleSchema.index({ enabled: 1, trigger: 1, createdAt: -1 });

export const AutomationRule = model<IAutomationRuleDocument, AutomationRuleModel>(
  "AutomationRule",
  automationRuleSchema,
);
