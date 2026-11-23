"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, AlertCircle, CheckCircle2, Clock, History, Loader2,
  Plus, RefreshCw, Save, Search, Trash2, Zap,
} from "lucide-react";
import { automationApi } from "@/services/api/automation.api";
import {
  AUTOMATION_TRIGGERS,
  type AutomationCondition,
  type AutomationExecution,
  type AutomationRule,
  type AutomationTrigger,
  type ConditionOperator,
} from "./automation.types";

type WorkspaceKind =
  | "dashboard" | "orders" | "notifications" | "refunds"
  | "sellers" | "delivery" | "scheduled" | "logs";

const triggerGroups: Record<string, AutomationTrigger[]> = {
  orders: ["ORDER_CREATED", "ORDER_CONFIRMED", "ORDER_CANCELLED"],
  notifications: ["PAYMENT_COMPLETED", "ORDER_CREATED", "ORDER_CONFIRMED", "DELIVERY_ASSIGNED", "DELIVERY_COMPLETED"],
  refunds: ["REFUND_REQUESTED", "REFUND_COMPLETED"],
  sellers: ["SELLER_APPROVED", "SELLER_SUSPENDED"],
  delivery: ["DELIVERY_ASSIGNED", "DELIVERY_COMPLETED"],
};

const triggerLabels: Record<AutomationTrigger, string> = {
  ORDER_CREATED: "Order Created",
  ORDER_CONFIRMED: "Order Confirmed",
  ORDER_CANCELLED: "Order Cancelled",
  PAYMENT_COMPLETED: "Payment Completed",
  REFUND_REQUESTED: "Refund Requested",
  REFUND_COMPLETED: "Refund Completed",
  SELLER_APPROVED: "Seller Approved",
  SELLER_SUSPENDED: "Seller Suspended",
  DELIVERY_ASSIGNED: "Delivery Assigned",
  DELIVERY_COMPLETED: "Delivery Completed",
};

const emptyCondition = (): AutomationCondition => ({
  field: "totalAmount", operator: "greater_than", value: 0,
});

function dateLabel(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    SUCCESS: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    SKIPPED: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    FAILED: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
    TEST: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  };
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status] ?? styles.SKIPPED}`}>
      {status}
    </span>
  );
}

export default function AutomationWorkspace({ kind }: { kind: WorkspaceKind }) {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [executions, setExecutions] = useState<AutomationExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRules, setTotalRules] = useState(0);
  const [totalExecutions, setTotalExecutions] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [editing, setEditing] = useState<AutomationRule | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [trigger, setTrigger] = useState<AutomationTrigger>("ORDER_CREATED");
  const [enabled, setEnabled] = useState(false);
  const [actionType, setActionType] = useState<"LOG_EVENT" | "SEND_NOTIFICATION">("LOG_EVENT");
  const [recipientIdPath, setRecipientIdPath] = useState("userId");
  const [notificationType, setNotificationType] = useState("SYSTEM");
  const [notificationLocale, setNotificationLocale] = useState("en");
  const [conditions, setConditions] = useState<AutomationCondition[]>([]);
  const [testPayload, setTestPayload] = useState('{\n  "totalAmount": 100,\n  "status": "CREATED"\n}');
  const [testResult, setTestResult] = useState("");

  const allowedTriggers = useMemo(
    () => triggerGroups[kind] ?? [...AUTOMATION_TRIGGERS],
    [kind],
  );

  const title: Record<WorkspaceKind, string> = {
    dashboard: "Workflow Automation",
    orders: "Order Automation",
    notifications: "Notification Automation",
    refunds: "Refund Automation",
    sellers: "Seller Automation",
    delivery: "Delivery Automation",
    scheduled: "Scheduled Workflows",
    logs: "Automation Execution Logs",
  };

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    setError("");
    try {
      if (kind === "scheduled") {
        setRules([]);
        setExecutions([]);
        return;
      }

      if (kind === "logs") {
        const result = await automationApi.getExecutions({
          page, limit: 25, ...(statusFilter ? { status: statusFilter } : {}),
        });
        setExecutions(result.items);
        setTotalExecutions(result.pagination.total);
        setTotalPages(Math.max(1, result.pagination.totalPages));
        return;
      }

      const [ruleResults, history] = await Promise.all([
        kind in triggerGroups
          ? Promise.all(allowedTriggers.map((trigger) =>
              automationApi.getRules({
                page: 1,
                limit: 100,
                search,
                trigger,
                ...(kind === "notifications"
                  ? { actionType: "SEND_NOTIFICATION" as const }
                  : {}),
              }),
            ))
          : automationApi.getRules({ page, limit: 50, search }),
        automationApi.getExecutions({ page: 1, limit: 100 }),
      ]);

      const mergedRules = kind in triggerGroups
        ? Array.from(new Map(
            (ruleResults as Awaited<ReturnType<typeof automationApi.getRules>>[])
              .flatMap((result) => result.items)
              .map((rule) => [rule._id, rule]),
          ).values())
        : (ruleResults as Awaited<ReturnType<typeof automationApi.getRules>>).items;

      const pageRules = kind === "notifications"
        ? mergedRules.filter((rule) => rule.action?.type === "SEND_NOTIFICATION")
        : mergedRules;

      setRules(pageRules);
      setTotalRules(kind in triggerGroups
        ? pageRules.length
        : (ruleResults as Awaited<ReturnType<typeof automationApi.getRules>>).pagination.total);
      setTotalPages(kind in triggerGroups
        ? 1
        : Math.max(1, (ruleResults as Awaited<ReturnType<typeof automationApi.getRules>>).pagination.totalPages));
      setExecutions(history.items);
      setTotalExecutions(history.pagination.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load automation data.");
    } finally {
      setLoading(false);
    }
  }, [kind, page, search, statusFilter, allowedTriggers]);

  useEffect(() => {
    void load(true);
  }, [load]);

  const resetForm = () => {
    setEditing(null);
    setName("");
    setDescription("");
    setTrigger(allowedTriggers[0] ?? "ORDER_CREATED");
    setEnabled(false);
    setActionType(kind === "notifications" ? "SEND_NOTIFICATION" : "LOG_EVENT");
    setRecipientIdPath("userId");
    setNotificationType("SYSTEM");
    setNotificationLocale("en");
    setConditions([]);
    setTestResult("");
    setFormOpen(true);
  };

  const editRule = (rule: AutomationRule) => {
    setEditing(rule);
    setName(rule.name);
    setDescription(rule.description ?? "");
    setTrigger(rule.trigger);
    setEnabled(rule.enabled);
    setActionType(rule.action?.type ?? "LOG_EVENT");
    setRecipientIdPath(String(rule.action?.config?.recipientIdPath ?? "userId"));
    setNotificationType(String(rule.action?.config?.notificationType ?? "SYSTEM"));
    setNotificationLocale(String(rule.action?.config?.locale ?? "en"));
    setConditions(rule.conditions ?? []);
    setTestResult("");
    setFormOpen(true);
  };

  const saveRule = async () => {
    if (name.trim().length < 2) {
      setError("Rule name must contain at least 2 characters.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const input = {
        name: name.trim(),
        description: description.trim(),
        trigger,
        enabled,
        conditions,
        action: actionType === "SEND_NOTIFICATION"
          ? {
              type: "SEND_NOTIFICATION" as const,
              config: {
                recipientIdPath: recipientIdPath.trim(),
                notificationType,
                locale: notificationLocale.trim() || "en",
              },
            }
          : { type: "LOG_EVENT" as const, config: {} },
      };
      if (editing) await automationApi.update(editing._id, input);
      else await automationApi.create(input);
      setNotice(editing ? "Automation rule updated." : "Automation rule created.");
      setFormOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save rule.");
    } finally {
      setSaving(false);
    }
  };

  const toggleRule = async (rule: AutomationRule) => {
    setBusyId(rule._id);
    setError("");
    try {
      if (rule.enabled) await automationApi.disable(rule._id);
      else await automationApi.enable(rule._id);
      setNotice(rule.enabled ? "Rule disabled." : "Rule enabled.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update rule.");
    } finally {
      setBusyId("");
    }
  };

  const deleteRule = async (rule: AutomationRule) => {
    if (!window.confirm(`Delete automation rule "${rule.name}"?`)) return;
    setBusyId(rule._id);
    setError("");
    try {
      await automationApi.remove(rule._id);
      setNotice("Automation rule deleted.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete rule.");
    } finally {
      setBusyId("");
    }
  };

  const runTest = async (rule: AutomationRule) => {
    setBusyId(rule._id);
    setError("");
    setTestResult("");
    try {
      const payload = JSON.parse(testPayload) as Record<string, unknown>;
      const result = await automationApi.test(rule._id, payload);
      setTestResult(result.matched
        ? "Dry run matched the rule conditions. No business action was executed."
        : "Dry run did not match the rule conditions. No business action was executed.");
      setNotice("Dry run completed.");
      await load();
    } catch (err) {
      setError(err instanceof SyntaxError
        ? "Test payload must be valid JSON."
        : err instanceof Error ? err.message : "Unable to test rule.");
    } finally {
      setBusyId("");
    }
  };

  const updateCondition = (
    index: number,
    patch: Partial<AutomationCondition>,
  ) => setConditions((current) =>
    current.map((item, i) => i === index ? { ...item, ...patch } : item),
  );

  const visibleRules = rules.filter((rule) =>
    allowedTriggers.includes(rule.trigger)
      && (kind !== "notifications" || rule.action?.type === "SEND_NOTIFICATION")
      && (!search || rule.name.toLowerCase().includes(search.toLowerCase())),
  );

  const activeCount = rules.filter((rule) => rule.enabled).length;

  if (kind === "scheduled") {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <header>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{title[kind]}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Configure time-based and recurring workflows.
          </p>
        </header>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <div className="flex items-center gap-2 font-semibold">
            <Clock className="h-5 w-5" /> Scheduler is not configured
          </div>
          <p className="mt-2">
            The current automation backend supports event-triggered rules only.
            Scheduled and recurring workflow execution requires a scheduler,
            persistent schedule records and a worker. No schedules can be created yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{title[kind]}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage event-triggered rules and inspect their execution history.
          </p>
        </div>
        <button
          type="button" onClick={() => void load(true)} disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-700"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </header>

      {error && (
        <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          <AlertCircle className="h-5 w-5 shrink-0" /><span>{error}</span>
        </div>
      )}
      {notice && (
        <div className="flex gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
          <CheckCircle2 className="h-5 w-5 shrink-0" /><span>{notice}</span>
        </div>
      )}

      {kind === "dashboard" && (
        <section className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "Rules loaded", value: totalRules, icon: Zap },
            { label: "Enabled rules", value: activeCount, icon: CheckCircle2 },
            { label: "Executions recorded", value: totalExecutions, icon: Activity },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-950">
              <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                {item.label}<item.icon className="h-5 w-5" />
              </div>
              <div className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{item.value}</div>
            </div>
          ))}
        </section>
      )}

      {kind === "logs" ? (
        <section className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 p-4 dark:border-gray-800">
            <h2 className="font-semibold text-gray-900 dark:text-white">Execution history</h2>
            <select
              value={statusFilter}
              onChange={(event) => { setPage(1); setStatusFilter(event.target.value); }}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            >
              <option value="">All statuses</option>
              <option value="SUCCESS">Success</option>
              <option value="SKIPPED">Skipped</option>
              <option value="FAILED">Failed</option>
              <option value="TEST">Test</option>
            </select>
          </div>
          {loading ? <div className="p-8 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div> :
            executions.length === 0 ? <p className="p-8 text-center text-sm text-gray-500">No execution records found.</p> :
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {executions.map((item) => (
                <div key={item._id} className="flex flex-wrap items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900 dark:text-white">{item.ruleName}</div>
                    <div className="mt-1 text-xs text-gray-500">{item.trigger} · {dateLabel(item.executedAt)}</div>
                    <p className="mt-2 break-words text-sm text-gray-600 dark:text-gray-300">{item.message}</p>
                  </div>
                  <StatusPill status={item.status} />
                </div>
              ))}
            </div>
          }
          <div className="flex items-center justify-between border-t border-gray-200 p-4 text-sm dark:border-gray-800">
            <span className="text-gray-500">Page {page} of {totalPages} · {totalExecutions} records</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40 dark:border-gray-700">Previous</button>
              <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40 dark:border-gray-700">Next</button>
            </div>
          </div>
        </section>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input value={search} onChange={(event) => { setPage(1); setSearch(event.target.value); }}
                placeholder="Search automation rules..."
                className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
            </div>
            <button onClick={resetForm} className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-gray-900">
              <Plus className="h-4 w-4" /> Create rule
            </button>
          </div>

          {formOpen && (
            <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-950">
              <h2 className="font-semibold text-gray-900 dark:text-white">{editing ? "Edit automation rule" : "Create automation rule"}</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1.5 text-sm">
                  <span className="font-medium text-gray-700 dark:text-gray-300">Rule name *</span>
                  <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
                </label>
                <label className="space-y-1.5 text-sm">
                  <span className="font-medium text-gray-700 dark:text-gray-300">Event trigger *</span>
                  <select value={trigger} onChange={(e) => setTrigger(e.target.value as AutomationTrigger)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900 dark:text-white">
                    {allowedTriggers.map((item) => <option key={item} value={item}>{triggerLabels[item]}</option>)}
                  </select>
                </label>
                <label className="space-y-1.5 text-sm md:col-span-2">
                  <span className="font-medium text-gray-700 dark:text-gray-300">Description</span>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={1000}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
                </label>
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Conditions (all must match)</h3>
                  <button type="button" onClick={() => setConditions((items) => [...items, emptyCondition()])}
                    disabled={conditions.length >= 20} className="rounded-lg border px-3 py-1.5 text-sm dark:border-gray-700">Add condition</button>
                </div>
                {conditions.map((condition, index) => (
                  <div key={index} className="grid gap-2 rounded-lg bg-gray-50 p-3 dark:bg-gray-900 md:grid-cols-[1fr_1fr_1fr_auto]">
                    <input aria-label="Field path" value={condition.field} onChange={(e) => updateCondition(index, { field: e.target.value })}
                      placeholder="e.g. totalAmount" className="min-w-0 rounded-lg border bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
                    <select value={condition.operator} onChange={(e) => updateCondition(index, { operator: e.target.value as ConditionOperator })}
                      className="rounded-lg border bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white">
                      <option value="equals">Equals</option><option value="not_equals">Not equals</option>
                      <option value="greater_than">Greater than</option><option value="less_than">Less than</option><option value="contains">Contains</option>
                    </select>
                    <input aria-label="Condition value" value={String(condition.value)} onChange={(e) => {
                      const raw = e.target.value;
                      const numeric = raw.trim() !== "" && Number.isFinite(Number(raw));
                      updateCondition(index, { value: numeric ? Number(raw) : raw });
                    }} className="min-w-0 rounded-lg border bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
                    <button type="button" onClick={() => setConditions((items) => items.filter((_, i) => i !== index))}
                      className="rounded-lg border px-3 py-2 text-sm text-red-600 dark:border-gray-700">Remove</button>
                  </div>
                ))}
                {conditions.length === 0 && <p className="text-sm text-gray-500">No conditions: every event with this trigger will match.</p>}
              </div>

              <div className="space-y-4 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Automation action
                  </label>
                  <select
                    value={actionType}
                    onChange={(e) => setActionType(e.target.value as "LOG_EVENT" | "SEND_NOTIFICATION")}
                    disabled={kind === "notifications"}
                    className="w-full rounded-lg border bg-white px-3 py-2 text-sm disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                  >
                    <option value="LOG_EVENT">Log Event</option>
                    <option value="SEND_NOTIFICATION">Send Notification</option>
                  </select>
                </div>

                {actionType === "SEND_NOTIFICATION" && (
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Recipient ID path
                      </label>
                      <input
                        value={recipientIdPath}
                        onChange={(e) => setRecipientIdPath(e.target.value)}
                        placeholder="userId"
                        required
                        className="w-full rounded-lg border bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Example: userId or customer.userId from the event payload.
                      </p>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Notification type
                      </label>
                      <select
                        value={notificationType}
                        onChange={(e) => setNotificationType(e.target.value)}
                        className="w-full rounded-lg border bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                      >
                        <option value="SYSTEM">System</option>
                        <option value="ORDER_STATUS">Order Status</option>
                        <option value="PAYMENT_STATUS">Payment Status</option>
                        <option value="DELIVERY_STATUS">Delivery Status</option>
                        <option value="JOB_APPLICATION_STATUS">Job Application Status</option>
                        <option value="JOB_APPLICATION_INTERVIEW">Job Application Interview</option>
                        <option value="PROMOTION">Promotion</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Template locale
                      </label>
                      <input
                        value={notificationLocale}
                        onChange={(e) => setNotificationLocale(e.target.value)}
                        placeholder="en"
                        className="w-full rounded-lg border bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                      />
                    </div>
                    <p className="self-end text-xs text-gray-500">
                      Uses the active notification template for this event. Delivery is currently in-app.
                    </p>
                  </div>
                )}
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
                Enable this rule after saving
              </label>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => void saveRule()} disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-gray-900">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {editing ? "Save changes" : "Create rule"}
                </button>
                <button onClick={() => setFormOpen(false)} className="rounded-lg border px-4 py-2 text-sm dark:border-gray-700">Cancel</button>
              </div>
            </section>
          )}

          {loading ? <div className="rounded-xl border p-10 text-center dark:border-gray-800"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div> :
            visibleRules.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center dark:border-gray-700">
                <Zap className="mx-auto h-8 w-8 text-gray-400" />
                <p className="mt-3 font-medium text-gray-900 dark:text-white">No automation rules found</p>
                <p className="mt-1 text-sm text-gray-500">Create a rule to start recording matching events.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {visibleRules.map((rule) => (
                  <article key={rule._id} className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-gray-900 dark:text-white">{rule.name}</h3>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${rule.enabled ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"}`}>
                            {rule.enabled ? "Enabled" : "Disabled"}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-gray-500">{triggerLabels[rule.trigger]}</p>
                        {rule.description && <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{rule.description}</p>}
                        <p className="mt-2 text-xs text-gray-500">
                          {rule.conditions.length} condition(s) ·
                          {rule.action?.type === "SEND_NOTIFICATION" ? " Send Notification action" : " Log Event action"} ·
                          Updated {dateLabel(rule.updatedAt)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button disabled={busyId === rule._id} onClick={() => editRule(rule)} className="rounded-lg border px-3 py-1.5 text-sm dark:border-gray-700">Edit</button>
                        <button disabled={busyId === rule._id} onClick={() => void toggleRule(rule)} className="rounded-lg border px-3 py-1.5 text-sm dark:border-gray-700">{rule.enabled ? "Disable" : "Enable"}</button>
                        <button disabled={busyId === rule._id} onClick={() => void deleteRule(rule)} aria-label="Delete rule" className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 dark:border-red-900"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </div>
                    <details className="mt-4 border-t border-gray-100 pt-3 dark:border-gray-800">
                      <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300">Test this rule (dry run)</summary>
                      <div className="mt-3 space-y-2">
                        <textarea value={testPayload} onChange={(e) => setTestPayload(e.target.value)} rows={5}
                          className="w-full rounded-lg border border-gray-300 bg-gray-50 p-3 font-mono text-xs dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
                        <button disabled={busyId === rule._id} onClick={() => void runTest(rule)}
                          className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
                          {busyId === rule._id ? "Testing..." : "Run dry test"}
                        </button>
                        {testResult && <p className="text-sm text-blue-700 dark:text-blue-300">{testResult}</p>}
                      </div>
                    </details>
                  </article>
                ))}
              </div>
            )
          }

          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Page {page} of {totalPages} · {totalRules} rules</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40 dark:border-gray-700">Previous</button>
              <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40 dark:border-gray-700">Next</button>
            </div>
          </div>
        </>
      )}

      {kind === "dashboard" && (
        <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-950">
          <div className="mb-4 flex items-center gap-2">
            <History className="h-5 w-5 text-gray-500" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Recent executions</h2>
          </div>
          {executions.slice(0, 8).length === 0
            ? <p className="text-sm text-gray-500">No automation executions recorded yet.</p>
            : <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {executions.slice(0, 8).map((item) => (
                  <div key={item._id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div><p className="text-sm font-medium text-gray-900 dark:text-white">{item.ruleName}</p><p className="text-xs text-gray-500">{item.trigger} · {dateLabel(item.executedAt)}</p></div>
                    <StatusPill status={item.status} />
                  </div>
                ))}
              </div>}
        </section>
      )}
    </div>
  );
}
