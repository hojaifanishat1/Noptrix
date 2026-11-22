"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, AlertCircle, CheckCircle2, Clock, FileText,
  RefreshCw, Search, Server, Webhook, XCircle,
} from "lucide-react";
import { OwnerAuthGuard } from "@/components/common/OwnerAuthGuard";
import activityLogsApi from "@/services/api/activity-logs.api";
import { webhookEventsApi } from "@/services/api/webhook-events.api";
import { systemMonitoringApi } from "@/services/api/system-monitoring.api";
import { systemLogsApi } from "@/services/api/system-logs.api";
import { integrationsApi } from "@/services/api/integrations.api";

type PageKind =
  | "api-logs" | "events" | "webhooks" | "queues"
  | "failed-jobs" | "export-jobs" | "integrations" | "diagnostics";

const configs: Record<PageKind, { title: string; description: string }> = {
  "api-logs": {
    title: "API Logs",
    description: "Backend system log entries originating from API requests.",
  },
  events: {
    title: "Event Logs",
    description: "Recorded application activity and business events.",
  },
  webhooks: {
    title: "Webhook Events",
    description: "Incoming webhook delivery and processing records.",
  },
  queues: {
    title: "Queue Jobs",
    description: "Live queue counts reported by the backend workers.",
  },
  "failed-jobs": {
    title: "Failed Jobs",
    description: "Current failed-job totals for each registered queue.",
  },
  "export-jobs": {
    title: "Export Jobs",
    description: "Export service capability and job-history availability.",
  },
  integrations: {
    title: "Integration Status",
    description: "Configured third-party integrations and their safe status.",
  },
  diagnostics: {
    title: "Operations Diagnostics",
    description: "Backend system diagnostics and dependency checks.",
  },
};

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function display(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function getItems(value: unknown): RecordValue[] {
  if (Array.isArray(value)) return value.filter(isRecord);
  if (!isRecord(value)) return [];
  for (const key of ["items", "data", "events", "logs", "integrations", "queues"]) {
    if (Array.isArray(value[key])) return (value[key] as unknown[]).filter(isRecord);
  }
  return [];
}

function getQueueItems(value: unknown, failedOnly = false): RecordValue[] {
  if (!isRecord(value)) return getItems(value);

  const entries = Object.entries(value).filter(([, result]) => isRecord(result));
  if (!entries.length) return getItems(value);

  const items: RecordValue[] = [];

  for (const [queue, result] of entries) {
    if (!isRecord(result)) continue;

    const response = result;
    const health: RecordValue = isRecord(response.data) ? response.data : {};
    const failed = Number(
      health.failed ?? health.failedCount ?? response.failed ?? 0
    );

    if (failedOnly) {
      if (Number.isFinite(failed) && failed > 0) {
        items.push({ queue, failed });
      }
      continue;
    }

    if (response.success === false) {
      items.push({
        queue,
        status: "error",
        error: response.error ?? "Queue health check failed",
      });
      continue;
    }

    items.push({ queue, ...health });
  }

  return items;
}

function Status({ value }: { value: unknown }) {
  const status = String(value ?? "unknown").toLowerCase();
  const good = ["active", "success", "processed", "healthy", "connected", "completed", "running", "true", "ready"].includes(status);
  const bad = ["failed", "error", "unhealthy", "disconnected", "false", "inactive"].includes(status);
  const style = good
    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
    : bad
      ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
      : "border-gray-200 bg-gray-100 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300";
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${style}`}>{display(value)}</span>;
}

function DataTable({ rows }: { rows: RecordValue[] }) {
  const columns = useMemo(
    () => Array.from(new Set(rows.flatMap((row) => Object.keys(row)))).slice(0, 12),
    [rows],
  );

  if (!rows.length) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-10 text-center dark:border-gray-800 dark:bg-gray-950">
        <CheckCircle2 className="mx-auto h-8 w-8 text-gray-400" />
        <p className="mt-3 text-sm text-gray-500">No records found.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-900 dark:text-gray-400">
            <tr>{columns.map((key) => (
              <th key={key} className="whitespace-nowrap px-4 py-3 font-semibold">
                {key.replace(/([A-Z])/g, " $1").replace(/[_-]/g, " ")}
              </th>
            ))}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {rows.map((row, index) => (
              <tr key={String(row._id ?? row.id ?? index)} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                {columns.map((key) => (
                  <td key={key} className="max-w-[320px] break-words px-4 py-3 text-gray-700 dark:text-gray-300">
                    {/status|health|state/i.test(key)
                      ? <Status value={row[key]} />
                      : display(row[key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function JsonDetails({ data }: { data: unknown }) {
  return (
    <details className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200">
        View technical response
      </summary>
      <pre className="max-h-[600px] overflow-auto border-t border-gray-200 bg-gray-950 p-4 text-xs leading-6 text-green-300 dark:border-gray-800">
        {JSON.stringify(data, null, 2)}
      </pre>
    </details>
  );
}

function WorkspaceContent({ kind }: { kind: PageKind }) {
  const config = configs[kind];
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [lastUpdated, setLastUpdated] = useState("");

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      let result: unknown;

      switch (kind) {
        case "api-logs":
          result = await systemLogsApi.getAll({ page, limit: 50, source: "API" });
          break;
        case "events":
          result = await activityLogsApi.getAll({ page, limit: 50, sortOrder: "desc" });
          break;
        case "webhooks":
          result = await webhookEventsApi.getAll({ page, limit: 50 });
          break;
        case "queues":
        case "failed-jobs":
          result = await systemMonitoringApi.get("queues");
          break;
        case "integrations":
          result = await integrationsApi.getAll({ page, limit: 50 });
          break;
        case "diagnostics":
          result = await systemMonitoringApi.get("diagnostics");
          break;
        case "export-jobs":
          result = {
            historyAvailable: false,
            message: "The current export service generates exports synchronously. It does not persist export job history.",
            nextStep: "Persistent export job history requires a job model, queue, and storage implementation.",
          };
          break;
      }

      setData(result);
      setLastUpdated(new Date().toLocaleString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load operations data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [kind, page]);

  useEffect(() => { void load(); }, [load]);

  const rows = useMemo(() => {
    const items =
      kind === "queues"
        ? getQueueItems(data)
        : kind === "failed-jobs"
          ? getQueueItems(data, true)
          : getItems(data);

    const query = search.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) =>
      JSON.stringify(item).toLowerCase().includes(query)
    );
  }, [data, kind, search]);

  const pagination = isRecord(data) && isRecord(data.pagination) ? data.pagination : null;
  const totalPages = pagination && typeof pagination.totalPages === "number" ? pagination.totalPages : 0;
  const isExport = kind === "export-jobs";

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-gray-100 p-3 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
            {kind === "webhooks" ? <Webhook className="h-6 w-6" /> :
             kind === "queues" || kind === "failed-jobs" ? <Server className="h-6 w-6" /> :
             kind === "events" ? <Activity className="h-6 w-6" /> :
             <FileText className="h-6 w-6" />}
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">{config.title}</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{config.description}</p>
            {lastUpdated && <p className="mt-2 text-xs text-gray-400">Last updated: {lastUpdated}</p>}
          </div>
        </div>
        <button type="button" onClick={() => void load(true)} disabled={loading || refreshing}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {loading && (
        <div className="rounded-xl border border-gray-200 bg-white p-10 text-center dark:border-gray-800 dark:bg-gray-950">
          <RefreshCw className="mx-auto h-7 w-7 animate-spin text-blue-500" />
          <p className="mt-3 text-sm text-gray-500">Loading operations data...</p>
        </div>
      )}

      {!loading && error && (
        <div className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <div className="min-w-0">
            <p className="font-semibold">Request failed</p>
            <p className="mt-1 break-words">{error}</p>
            <button onClick={() => void load(true)} className="mt-3 rounded-lg border border-red-300 px-3 py-1.5 font-medium">Try again</button>
          </div>
        </div>
      )}

      {!loading && !error && isExport && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <div className="flex items-center gap-2 font-semibold"><AlertCircle className="h-5 w-5" /> Export job history is not implemented</div>
          <p className="mt-2">{String((data as RecordValue)?.message ?? "")}</p>
          <p className="mt-2">{String((data as RecordValue)?.nextStep ?? "")}</p>
        </div>
      )}

      {!loading && !error && !isExport && (
        <>
          {(kind === "api-logs" || kind === "events" || kind === "webhooks" || kind === "integrations") && (
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={(event) => setSearch(event.target.value)}
                placeholder="Search loaded records..." className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
            </div>
          )}

          {kind === "failed-jobs" && (
            <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300">
              Showing queues with failed-job counts greater than zero. The current backend exposes aggregate counts, not individual failed job records or retry controls.
            </div>
          )}

          {rows.length > 0 ? <DataTable rows={rows} /> :
            isRecord(data) && !Array.isArray(data) && !("data" in data) && !("items" in data)
              ? <JsonDetails data={data} />
              : <div className="rounded-xl border border-gray-200 bg-white p-10 text-center dark:border-gray-800 dark:bg-gray-950">
                  <XCircle className="mx-auto h-8 w-8 text-gray-400" />
                  <p className="mt-3 text-sm text-gray-500">No records found.</p>
                </div>}

          {pagination && totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-gray-500">Page {page} of {totalPages} · {display(pagination.total)} records</p>
              <div className="flex gap-2">
                <button disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-40 dark:border-gray-700">Previous</button>
                <button disabled={page >= totalPages || loading} onClick={() => setPage((value) => value + 1)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-40 dark:border-gray-700">Next</button>
              </div>
            </div>
          )}
          <JsonDetails data={data} />
        </>
      )}

      <div className="flex items-center gap-2 text-xs text-gray-400">
        <Clock className="h-3.5 w-3.5" /> Data shown is returned by the connected backend endpoint.
      </div>
    </div>
  );
}

export default function OperationsWorkspace({ kind }: { kind: PageKind }) {
  return <OwnerAuthGuard><WorkspaceContent kind={kind} /></OwnerAuthGuard>;
}
