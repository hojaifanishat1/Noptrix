"use client";

import { useCallback, useEffect, useState } from "react";
import apiClient from "@/services/api/client";
import type { ApiResponse } from "@/types/api";
import {
  automationScheduleApi,
  type AutomationSchedule,
  type ScheduleInput,
  type ScheduleKind,
  type ScheduleRecurrence,
} from "@/services/api/automation-schedule.api";

interface AutomationRuleOption {
  _id: string;
  name: string;
  trigger: string;
  enabled: boolean;
}

interface RuleListPayload {
  items?: AutomationRuleOption[];
}

const notificationTypes = [
  "JOB_APPLICATION_STATUS",
  "JOB_APPLICATION_INTERVIEW",
  "ORDER_STATUS",
  "PAYMENT_STATUS",
  "DELIVERY_STATUS",
  "PROMOTION",
  "SYSTEM",
] as const;

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function getErrorMessage(error: unknown): string {
  const candidate = error as {
    response?: {
      data?: {
        message?: string;
        error?: string;
        errors?: Array<{
          field?: string;
          message?: string;
        }>;
      };
    };
    message?: string;
  };

  const data = candidate.response?.data;
  const message = data?.message ?? data?.error;

  if (Array.isArray(data?.errors) && data.errors.length > 0) {
    const details = data.errors
      .map((item) => {
        const field = item.field?.trim();
        const reason = item.message?.trim();

        if (!reason) return "";
        return field ? `${field}: ${reason}` : reason;
      })
      .filter(Boolean);

    if (details.length > 0) {
      return message
        ? `${message} ${details.join("; ")}`
        : details.join("; ");
    }
  }

  return message ?? candidate.message ?? "Something went wrong.";
}

export default function ScheduledTasksWorkspace() {
  const [items, setItems] = useState<AutomationSchedule[]>([]);
  const [rules, setRules] = useState<AutomationRuleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<ScheduleKind>("RULE");
  const [recurrence, setRecurrence] = useState<ScheduleRecurrence>("ONCE");
  const [runAt, setRunAt] = useState("");
  const [ruleId, setRuleId] = useState("");
  const [payloadJson, setPayloadJson] = useState("{}");
  const [recipientId, setRecipientId] = useState("");
  const [templateKey, setTemplateKey] = useState("");
  const [notificationType, setNotificationType] =
    useState<(typeof notificationTypes)[number]>("SYSTEM");
  const [locale, setLocale] = useState("en");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [scheduleResult, ruleResponse] = await Promise.all([
        automationScheduleApi.list({ page: 1, limit: 100 }),
        apiClient.get<ApiResponse<RuleListPayload | AutomationRuleOption[]>>(
          "/automation",
          { params: { page: 1, limit: 100 } },
        ),
      ]);

      setItems(scheduleResult.items ?? []);

      const ruleData = ruleResponse.data.data;
      const ruleItems = Array.isArray(ruleData)
        ? ruleData
        : ruleData?.items ?? [];

      setRules(ruleItems);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function resetForm() {
    setEditingId(null);
    setName("");
    setDescription("");
    setKind("RULE");
    setRecurrence("ONCE");
    setRunAt("");
    setRuleId("");
    setPayloadJson("{}");
    setRecipientId("");
    setTemplateKey("");
    setNotificationType("SYSTEM");
    setLocale("en");
  }

  function beginEdit(item: AutomationSchedule) {
    if (item.status === "COMPLETED") return;

    setEditingId(item._id);
    setName(item.name);
    setDescription(item.description ?? "");
    setKind(item.kind);
    setRecurrence(item.recurrence);
    setRunAt(
      item.runAt
        ? new Date(item.runAt).toISOString().slice(0, 16)
        : "",
    );
    setRuleId(item.ruleId ?? "");
    setPayloadJson(JSON.stringify(item.payload ?? {}, null, 2));
    setRecipientId(item.notification?.recipientId ?? "");
    setTemplateKey(item.notification?.templateKey ?? "");
    setNotificationType(
      (item.notification?.notificationType as (typeof notificationTypes)[number]) ??
        "SYSTEM",
    );
    setLocale(item.notification?.locale ?? "en");

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!runAt) {
      setError("Please select the scheduled date and time.");
      return;
    }

    let rulePayload: Record<string, unknown> | undefined;

    if (kind === "RULE") {
      try {
        const parsed: unknown = JSON.parse(payloadJson);

        if (
          parsed === null ||
          typeof parsed !== "object" ||
          Array.isArray(parsed)
        ) {
          throw new Error("Payload must be a JSON object.");
        }

        rulePayload = parsed as Record<string, unknown>;
      } catch {
        setError("Invalid JSON payload. Enter a valid JSON object.");
        return;
      }
    }

    if (kind === "RULE" && !/^[0-9a-fA-F]{24}$/.test(ruleId.trim())) {
      setError(
        `Select a valid automation rule. Current selected ID: ${JSON.stringify(ruleId)}. Available rules: ${rules.length}.`,
      );
      return;
    }

    const input: ScheduleInput = {
      name: name.trim(),
      description: description.trim() || undefined,
      kind,
      recurrence,
      runAt: new Date(runAt).toISOString(),
      ...(kind === "RULE"
        ? { ruleId, payload: rulePayload }
        : {
            notification: {
              recipientId: recipientId.trim(),
              templateKey: templateKey.trim(),
              channel: "in-app" as const,
              notificationType,
              locale: locale.trim() || "en",
            },
          }),
    };

    setSaving(true);

    try {
      if (editingId) {
        await automationScheduleApi.update(editingId, input);
        setSuccess("Scheduled task updated.");
      } else {
        await automationScheduleApi.create(input);
        setSuccess("Scheduled task created.");
      }

      resetForm();
      await load();
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(item: AutomationSchedule) {
    setError("");
    setSuccess("");

    try {
      if (item.status === "ACTIVE") {
        await automationScheduleApi.pause(item._id);
        setSuccess("Scheduled task paused.");
      } else if (item.status === "PAUSED") {
        await automationScheduleApi.resume(item._id);
        setSuccess("Scheduled task resumed.");
      }

      await load();
    } catch (statusError) {
      setError(getErrorMessage(statusError));
    }
  }

  async function remove(item: AutomationSchedule) {
    if (!window.confirm(`Delete scheduled task "${item.name}"?`)) return;

    setError("");
    setSuccess("");

    try {
      await automationScheduleApi.remove(item._id);
      setSuccess("Scheduled task deleted.");
      if (editingId === item._id) resetForm();
      await load();
    } catch (deleteError) {
      setError(getErrorMessage(deleteError));
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Scheduled Tasks</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Run automation rules or send template-based in-app notifications
          on a schedule. Times are stored in UTC.
        </p>
      </div>

      {(error || success) && (
        <div
          role="alert"
          className={`rounded-lg border p-3 text-sm ${
            error
              ? "border-red-300 bg-red-50 text-red-800"
              : "border-green-300 bg-green-50 text-green-800"
          }`}
        >
          {error || success}
        </div>
      )}

      <form
        onSubmit={submit}
        className="space-y-4 rounded-xl border bg-card p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">
            {editingId ? "Edit Scheduled Task" : "Create Scheduled Task"}
          </h2>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="text-sm underline"
            >
              Cancel edit
            </button>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-medium">Task name *</span>
            <input
              required
              minLength={2}
              maxLength={120}
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2"
              placeholder="Daily order follow-up"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium">Task type *</span>
            <select
              value={kind}
              onChange={(event) => setKind(event.target.value as ScheduleKind)}
              className="w-full rounded-md border bg-background px-3 py-2"
            >
              <option value="RULE">Run automation rule</option>
              <option value="NOTIFICATION">Send notification</option>
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium">First run time *</span>
            <input
              required
              type="datetime-local"
              value={runAt}
              onChange={(event) => setRunAt(event.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium">Repeat *</span>
            <select
              value={recurrence}
              onChange={(event) =>
                setRecurrence(event.target.value as ScheduleRecurrence)
              }
              className="w-full rounded-md border bg-background px-3 py-2"
            >
              <option value="ONCE">Once</option>
              <option value="DAILY">Every day</option>
              <option value="WEEKLY">Every week</option>
            </select>
          </label>
        </div>

        {kind === "RULE" ? (
          <>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Automation rule *</span>
            <select
              required
              value={ruleId}
              onChange={(event) => setRuleId(event.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2"
            >
              <option value="">Select a rule</option>
              {rules.map((rule) => (
                <option
                  key={String(rule._id)}
                  value={String(rule._id ?? "")}
                >
                  {rule.name} — {rule.trigger}
                  {rule.enabled ? "" : " (disabled)"}
                </option>
              ))}
            </select>
            <span className="text-xs text-muted-foreground">
              Disabled rules will be skipped when the schedule runs.
            </span>
          </label>

          <label className="block space-y-1 text-sm">
            <span className="font-medium">Rule payload (JSON)</span>
            <textarea
              rows={7}
              value={payloadJson}
              onChange={(event) => setPayloadJson(event.target.value)}
              spellCheck={false}
              className="w-full rounded-md border bg-background px-3 py-2 font-mono text-xs"
              placeholder={'{\n  "userId": "24-character-user-id"\n}'}
            />
            <span className="text-xs text-muted-foreground">
              This JSON is passed to rule conditions and actions. For
              SEND_NOTIFICATION, include the field configured in
              recipientIdPath, for example userId. Schedule metadata is
              added automatically.
            </span>
          </label>
          </>
        ) : (
          <div className="grid gap-4 rounded-lg border p-4 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="font-medium">Recipient User ID *</span>
              <input
                required
                value={recipientId}
                onChange={(event) => setRecipientId(event.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2"
                placeholder="24-character MongoDB User ID"
              />
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium">Notification template key *</span>
              <input
                required
                value={templateKey}
                onChange={(event) => setTemplateKey(event.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2"
                placeholder="e.g. order-reminder"
              />
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium">Notification type *</span>
              <select
                value={notificationType}
                onChange={(event) =>
                  setNotificationType(
                    event.target.value as (typeof notificationTypes)[number],
                  )
                }
                className="w-full rounded-md border bg-background px-3 py-2"
              >
                {notificationTypes.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium">Locale</span>
              <input
                value={locale}
                onChange={(event) => setLocale(event.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2"
                placeholder="en"
              />
            </label>

            <p className="text-xs text-muted-foreground md:col-span-2">
              Channel: In-app. The template must be active for this key and
              channel. Email, push and SMS are not enabled in this scheduler yet.
            </p>
          </div>
        )}

        <label className="block space-y-1 text-sm">
          <span className="font-medium">Description</span>
          <textarea
            rows={2}
            maxLength={1000}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2"
            placeholder="Optional notes about this task"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {saving
              ? "Saving..."
              : editingId
                ? "Save changes"
                : "Create scheduled task"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-md border px-4 py-2 text-sm"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Scheduled Tasks</h2>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="rounded-md border px-3 py-2 text-sm"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
            Loading scheduled tasks...
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
            No scheduled tasks yet.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-3">Task</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Next run (UTC)</th>
                  <th className="p-3">Repeat</th>
                  <th className="p-3">Runs</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item._id} className="border-t align-top">
                    <td className="p-3">
                      <div className="font-medium">{item.name}</div>
                      {item.description && (
                        <div className="mt-1 max-w-xs text-xs text-muted-foreground">
                          {item.description}
                        </div>
                      )}
                      {item.lastError && (
                        <div className="mt-1 max-w-xs text-xs text-red-600">
                          {item.lastError}
                        </div>
                      )}
                    </td>
                    <td className="p-3">{item.kind}</td>
                    <td className="p-3">{formatDate(item.nextRunAt)}</td>
                    <td className="p-3">{item.recurrence}</td>
                    <td className="p-3">{item.runCount}</td>
                    <td className="p-3">
                      <span className="rounded-full border px-2 py-1 text-xs">
                        {item.status}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        {item.status !== "COMPLETED" && (
                          <>
                            <button
                              type="button"
                              onClick={() => beginEdit(item)}
                              className="underline"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => void changeStatus(item)}
                              className="underline"
                            >
                              {item.status === "ACTIVE" ? "Pause" : "Resume"}
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => void remove(item)}
                          className="text-red-600 underline"
                        >
                          Delete
                        </button>
                      </div>
                      {item.lastRunAt && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          Last run: {formatDate(item.lastRunAt)}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
