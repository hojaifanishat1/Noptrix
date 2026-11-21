"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  HardDrive,
  RefreshCw,
  Server,
  XCircle,
  Zap,
} from "lucide-react";

import {
  systemMonitoringApi,
  type SystemMonitoringEndpoint,
} from "@/services/api/system-monitoring.api";

import { OwnerAuthGuard } from "@/components/common/OwnerAuthGuard";

interface SystemMonitoringPageProps {
  title: string;
  description: string;
  endpoint: SystemMonitoringEndpoint;
}

type DataRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is DataRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const labelize = (value: string) =>
  value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const formatValue = (value: unknown): string => {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return value.toLocaleString();
  if (typeof value === "string") return value;
  return JSON.stringify(value);
};

const isStatusKey = (key: string) =>
  /status|healthy|connected|ready|running|success|enabled|initialized/i.test(key);

const statusTone = (value: unknown) => {
  const normalized = String(value).toLowerCase();

  if (
    normalized === "true" ||
    normalized === "healthy" ||
    normalized === "connected" ||
    normalized === "ready" ||
    normalized === "running" ||
    normalized === "success" ||
    normalized === "active" ||
    normalized === "enabled"
  ) {
    return "success";
  }

  if (
    normalized === "false" ||
    normalized === "unhealthy" ||
    normalized === "disconnected" ||
    normalized === "stopped" ||
    normalized === "failed" ||
    normalized === "error" ||
    normalized === "degraded" ||
    normalized === "not_ready"
  ) {
    return "danger";
  }

  return "neutral";
};

function StatusBadge({ value }: { value: unknown }) {
  const tone = statusTone(value);

  const styles =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
      : tone === "danger"
        ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
        : "border-gray-200 bg-gray-100 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300";

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${styles}`}>
      {formatValue(value)}
    </span>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: unknown;
  icon: typeof Activity;
}) {
  const status = isStatusKey(label);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-gray-500 dark:text-gray-400">{labelize(label)}</p>
        <Icon className="h-5 w-5 text-gray-400" />
      </div>
      <div className="mt-3">
        {status ? (
          <StatusBadge value={value} />
        ) : (
          <p className="break-words text-2xl font-bold text-gray-900 dark:text-white">
            {formatValue(value)}
          </p>
        )}
      </div>
    </div>
  );
}

function ObjectSection({
  title,
  value,
}: {
  title: string;
  value: DataRecord;
}) {
  const entries = Object.entries(value);
  const scalarEntries = entries.filter(
    ([, item]) => !isRecord(item) && !Array.isArray(item),
  );
  const nestedEntries = entries.filter(
    ([, item]) => isRecord(item) || Array.isArray(item),
  );

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
      <h3 className="mb-4 font-semibold text-gray-900 dark:text-white">
        {labelize(title)}
      </h3>

      {scalarEntries.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {scalarEntries.map(([key, item]) => (
            <div
              key={key}
              className="min-w-0 rounded-lg bg-gray-50 p-3 dark:bg-gray-900"
            >
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {labelize(key)}
              </p>
              <div className="mt-2 break-words text-sm font-medium text-gray-900 dark:text-gray-100">
                {isStatusKey(key) ? (
                  <StatusBadge value={item} />
                ) : (
                  formatValue(item)
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {nestedEntries.map(([key, item]) => (
        <div key={key} className="mt-4">
          {isRecord(item) ? (
            <ObjectSection title={key} value={item} />
          ) : Array.isArray(item) ? (
            <ArraySection title={key} value={item} />
          ) : null}
        </div>
      ))}
    </section>
  );
}

function ArraySection({
  title,
  value,
}: {
  title: string;
  value: unknown[];
}) {
  if (value.length === 0) {
    return (
      <section className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
        <h3 className="font-semibold text-gray-900 dark:text-white">
          {labelize(title)}
        </h3>
        <p className="mt-3 text-sm text-gray-500">No records found.</p>
      </section>
    );
  }

  if (value.every(isRecord)) {
    const columns = Array.from(
      new Set(value.flatMap((item) => Object.keys(item))),
    );

    return (
      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
        <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-800">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            {labelize(title)}
          </h3>
          <p className="mt-1 text-xs text-gray-500">{value.length} records</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-900 dark:text-gray-400">
              <tr>
                {columns.map((column) => (
                  <th key={column} className="px-4 py-3 font-semibold">
                    {labelize(column)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {value.map((item, index) => (
                <tr key={index}>
                  {columns.map((column) => (
                    <td key={column} className="max-w-xs break-words px-4 py-3 text-gray-700 dark:text-gray-300">
                      {isStatusKey(column) ? (
                        <StatusBadge value={item[column]} />
                      ) : (
                        formatValue(item[column])
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  return (
    <ObjectSection
      title={title}
      value={Object.fromEntries(value.map((item, index) => [String(index + 1), item]))}
    />
  );
}

function TechnicalDetails({ data }: { data: unknown }) {
  return (
    <details className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200">
        Technical response (JSON)
      </summary>
      <pre className="max-h-[600px] overflow-auto border-t border-gray-200 bg-gray-950 p-4 text-xs leading-6 text-green-300 dark:border-gray-800">
        {JSON.stringify(data, null, 2)}
      </pre>
    </details>
  );
}

function DashboardContent({
  title,
  description,
  endpoint,
}: SystemMonitoringPageProps) {
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const loadData = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    else setLoading(true);

    setError(null);

    try {
      const result = await systemMonitoringApi.get(endpoint);
      setData(result);
      setLastUpdated(new Date().toLocaleString());
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load system monitoring data.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [endpoint]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const root = isRecord(data) ? data : null;

  const rootEntries = root
    ? Object.entries(root).filter(
        ([, value]) => !isRecord(value) && !Array.isArray(value),
      )
    : [];

  const sections = root
    ? Object.entries(root).filter(
        ([, value]) => isRecord(value) || Array.isArray(value),
      )
    : [];

  const iconFor = (key: string) => {
    if (/database|mongo/i.test(key)) return Database;
    if (/redis|cache/i.test(key)) return Zap;
    if (/memory|process|runtime/i.test(key)) return Cpu;
    if (/queue|worker/i.test(key)) return Activity;
    if (/socket/i.test(key)) return Server;
    return HardDrive;
  };

  const overallStatus =
    root?.status ??
    root?.healthy ??
    root?.success ??
    (error ? "unhealthy" : "unknown");

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              {title}
            </h1>
            {data !== null && <StatusBadge value={overallStatus} />}
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {description}
          </p>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            {lastUpdated ? `Last updated: ${lastUpdated}` : "Waiting for monitoring data"}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadData(true)}
          disabled={loading || refreshing}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {loading && (
        <div className="rounded-xl border border-gray-200 bg-white p-10 text-center dark:border-gray-800 dark:bg-gray-950">
          <RefreshCw className="mx-auto h-7 w-7 animate-spin text-blue-500" />
          <p className="mt-3 text-sm text-gray-500">Loading monitoring data...</p>
        </div>
      )}

      {!loading && error && (
        <div className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Monitoring request failed</p>
            <p className="mt-1 break-words">{error}</p>
            <p className="mt-2 text-xs">
              Check backend availability and Owner secret verification.
            </p>
            <button
              type="button"
              onClick={() => void loadData(true)}
              className="mt-3 rounded-lg border border-red-300 px-3 py-1.5 font-medium hover:bg-red-100 dark:border-red-800 dark:hover:bg-red-900"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {!loading && !error && root && (
        <>
          {rootEntries.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {rootEntries.map(([key, value]) => (
                <MetricCard
                  key={key}
                  label={key}
                  value={value}
                  icon={iconFor(key)}
                />
              ))}
            </div>
          )}

          {sections.map(([key, value]) =>
            isRecord(value) ? (
              <ObjectSection key={key} title={key} value={value} />
            ) : Array.isArray(value) ? (
              <ArraySection key={key} title={key} value={value} />
            ) : null,
          )}

          <TechnicalDetails data={data} />
        </>
      )}

      {!loading && !error && data !== null && !root && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
          <div className="flex items-center gap-2 text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-semibold">Monitoring data received</span>
          </div>
          <TechnicalDetails data={data} />
        </div>
      )}

      {!loading && !error && data === null && (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center dark:border-gray-800 dark:bg-gray-950">
          <XCircle className="mx-auto h-7 w-7 text-gray-400" />
          <p className="mt-3 text-sm text-gray-500">
            No monitoring data returned by the server.
          </p>
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-gray-400">
        <Clock className="h-3.5 w-3.5" />
        Manual refresh available. Values reflect the latest backend response.
      </div>
    </div>
  );
}

export default function SystemMonitoringPage(
  props: SystemMonitoringPageProps,
) {
  return (
    <OwnerAuthGuard>
      <DashboardContent {...props} />
    </OwnerAuthGuard>
  );
}
