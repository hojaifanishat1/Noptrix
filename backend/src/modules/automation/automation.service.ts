import { enqueueNotificationCreated } from "../../jobs/notification.job";
import { logger } from "../../utils/logger";
import { createNotification } from "../notifications/notification.service";
import { renderNotificationTemplateByEvent } from "../notifications/notification-template.service";
import type { AutomationAction } from "./automation.model";
import { AutomationRule, AutomationTrigger } from "./automation.model";
import { AutomationExecution } from "./automation-execution.model";
import {
  CreateAutomationRuleInput,
  UpdateAutomationRuleInput,
} from "./automation.validator";

export async function listAutomationRules(query: {
  search?: string;
  trigger?: AutomationTrigger;
  actionType?: "LOG_EVENT" | "SEND_NOTIFICATION";
  enabled?: boolean;
  page: number;
  limit: number;
}) {
  const filter: Record<string, unknown> = {};
  if (query.trigger) filter.trigger = query.trigger;
  if (query.actionType) filter["action.type"] = query.actionType;
  if (query.enabled !== undefined) filter.enabled = query.enabled;
  if (query.search) filter.name = { $regex: query.search, $options: "i" };

  const [items, total] = await Promise.all([
    AutomationRule.find(filter)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
    AutomationRule.countDocuments(filter),
  ]);

  return {
    items,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
      hasNextPage: query.page * query.limit < total,
      hasPreviousPage: query.page > 1,
    },
  };
}

export async function createAutomationRule(
  ownerId: string,
  input: CreateAutomationRuleInput,
) {
  return AutomationRule.create({
    ...input,
    createdBy: ownerId,
  });
}

export async function getAutomationRule(ruleId: string) {
  return AutomationRule.findById(ruleId).lean();
}

export async function updateAutomationRule(
  ruleId: string,
  ownerId: string,
  input: UpdateAutomationRuleInput,
) {
  return AutomationRule.findByIdAndUpdate(
    ruleId,
    { $set: { ...input, updatedBy: ownerId } },
    { new: true, runValidators: true },
  ).lean();
}

export async function deleteAutomationRule(ruleId: string) {
  const rule = await AutomationRule.findByIdAndDelete(ruleId);
  if (!rule) return false;
  return true;
}

export async function setAutomationRuleEnabled(
  ruleId: string,
  ownerId: string,
  enabled: boolean,
) {
  return AutomationRule.findByIdAndUpdate(
    ruleId,
    { $set: { enabled, updatedBy: ownerId } },
    { new: true, runValidators: true },
  ).lean();
}

function readPath(source: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[key];
  }, source);
}

async function executeAutomationAction(
  action: AutomationAction,
  trigger: AutomationTrigger,
  payload: Record<string, unknown>,
  eventId: string,
): Promise<{ status: "SUCCESS" | "SKIPPED"; message: string }> {
  if (action.type === "LOG_EVENT") {
    return {
      status: "SUCCESS",
      message: "Automation rule matched. Event logged successfully.",
    };
  }

  const recipientValue = readPath(
    payload,
    action.config.recipientIdPath,
  );

  if (
    typeof recipientValue !== "string" ||
    !/^[0-9a-fA-F]{24}$/.test(recipientValue)
  ) {
    return {
      status: "SKIPPED",
      message: `Notification skipped: recipient was not found at payload path "${action.config.recipientIdPath}".`,
    };
  }

  const rendered = await renderNotificationTemplateByEvent({
    event: trigger,
    channel: "in-app",
    locale: action.config.locale ?? "en",
    variables: payload,
  });

  if (!rendered) {
    return {
      status: "SKIPPED",
      message: `Notification skipped: no active in-app template is configured for event "${trigger}".`,
    };
  }

  const notification = await createNotification({
    recipientId: recipientValue,
    type: action.config.notificationType,
    priority: "normal",
    title: rendered.title,
    message: rendered.message,
    channels: ["in-app"],
    metadata: {
      ...payload,
      automationEventId: `${eventId}:${trigger}`,
      automationTemplateId: rendered.templateId,
      automationTemplateKey: rendered.key,
      automationRuleEvent: trigger,
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

  return {
    status: "SUCCESS",
    message: `In-app notification created using template "${rendered.key}".`,
  };
}

function conditionMatches(
  condition: { field: string; operator: string; value: unknown },
  payload: Record<string, unknown>,
): boolean {
  const actual = readPath(payload, condition.field);
  const expected = condition.value;

  switch (condition.operator) {
    case "equals": return actual === expected;
    case "not_equals": return actual !== expected;
    case "greater_than": return typeof actual === "number" && typeof expected === "number" && actual > expected;
    case "less_than": return typeof actual === "number" && typeof expected === "number" && actual < expected;
    case "contains":
      return typeof actual === "string" && typeof expected === "string"
        ? actual.includes(expected)
        : Array.isArray(actual) && actual.includes(expected);
    default: return false;
  }
}

/**
 * Dispatches a committed domain event to enabled automation rules.
 * Current supported action is LOG_EVENT only; no business mutation is performed.
 * Failures are isolated so automation cannot fail the originating business operation.
 */
export async function dispatchAutomationEvent(
  trigger: AutomationTrigger,
  payload: Record<string, unknown>,
  eventId: string,
): Promise<void> {
  try {
    const rules = await AutomationRule.find({
      trigger,
      enabled: true,
    }).lean();

    for (const rule of rules) {
      const matched = rule.conditions.every((condition) =>
        conditionMatches(condition, payload),
      );

      try {
        let status: "SUCCESS" | "SKIPPED" | "FAILED" = "SKIPPED";
        let message = "Automation rule conditions did not match.";

        if (matched) {
          try {
            const result = await executeAutomationAction(
              rule.action,
              trigger,
              payload,
              eventId,
            );
            status = result.status;
            message = result.message;
          } catch (actionError) {
            status = "FAILED";
            message = actionError instanceof Error
              ? `Automation action failed: ${actionError.message}`
              : "Automation action failed.";

            logger.error(
              { trigger, eventId, ruleId: rule._id.toString(), error: actionError },
              "Automation action execution failed",
            );
          }
        }

        await AutomationExecution.create({
          ruleId: rule._id,
          ruleName: rule.name,
          trigger,
          eventId,
          status,
          message,
          payload,
        });
      } catch (error) {
        // A duplicate means this rule already processed this domain event.
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === 11000
        ) {
          continue;
        }

        logger.error(
          { trigger, eventId, ruleId: rule._id.toString(), error },
          "Automation execution could not be recorded",
        );
      }
    }
  } catch (error) {
    logger.error(
      { trigger, eventId, error },
      "Automation event dispatch failed",
    );
  }
}

export async function testAutomationRule(
  ruleId: string,
  payload: Record<string, unknown>,
) {
  const rule = await AutomationRule.findById(ruleId).lean();
  if (!rule) return null;

  const matched = rule.conditions.every((condition) =>
    conditionMatches(condition, payload),
  );

  const execution = await AutomationExecution.create({
    ruleId: rule._id,
    ruleName: rule.name,
    trigger: rule.trigger,
    status: "TEST",
    message: matched
      ? "Dry run matched the conditions. No action or notification was executed."
      : "Dry run did not match the rule conditions.",
    payload,
  });

  return { matched, execution };
}

export async function listAutomationExecutions(query: {
  page: number;
  limit: number;
  status?: string;
}) {
  const filter: Record<string, unknown> = {};
  if (query.status) filter.status = query.status;

  const [items, total] = await Promise.all([
    AutomationExecution.find(filter)
      .sort({ executedAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
    AutomationExecution.countDocuments(filter),
  ]);

  return {
    items,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

/**
 * Executes one specific automation rule from a scheduled task.
 * It deliberately does not dispatch the trigger to every rule.
 */
export async function executeScheduledAutomationRule(
  ruleId: string,
  payload: Record<string, unknown>,
  eventId: string,
): Promise<{ status: "SUCCESS" | "SKIPPED" | "FAILED"; message: string }> {
  const rule = await AutomationRule.findById(ruleId);

  if (!rule) {
    return { status: "FAILED", message: "Scheduled automation rule was not found." };
  }

  if (!rule.enabled) {
    return { status: "SKIPPED", message: "Automation rule is disabled." };
  }

  const previousExecution = await AutomationExecution.findOne({
    ruleId: rule._id,
    eventId,
  }).lean();

  // Do not repeat a scheduled action already completed successfully or skipped.
  if (
    previousExecution &&
    (previousExecution.status === "SUCCESS" ||
      previousExecution.status === "SKIPPED")
  ) {
    return {
      status: previousExecution.status,
      message: previousExecution.message,
    };
  }

  const saveExecution = async (
    status: "SUCCESS" | "SKIPPED" | "FAILED",
    message: string,
  ) => {
    await AutomationExecution.findOneAndUpdate(
      { ruleId: rule._id, eventId },
      {
        $set: {
          ruleName: rule.name,
          trigger: rule.trigger,
          status,
          message,
          payload,
          executedAt: new Date(),
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      },
    );
  };

  const matched = rule.conditions.every((condition) =>
    conditionMatches(condition, payload),
  );

  if (!matched) {
    const message = "Scheduled rule conditions did not match.";
    await saveExecution("SKIPPED", message);
    return { status: "SKIPPED", message };
  }

  try {
    const result = await executeAutomationAction(
      rule.action,
      rule.trigger,
      payload,
      eventId,
    );

    await saveExecution(result.status, result.message);
    return result;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown execution error.";

    await saveExecution("FAILED", `Scheduled action failed: ${message}`);
    return { status: "FAILED", message };
  }
}
