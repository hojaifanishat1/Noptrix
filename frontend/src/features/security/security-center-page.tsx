"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertCircle,
  Bell,
  CheckCircle2,
  Clock3,
  Fingerprint,
  History,
  KeyRound,
  Loader2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  XCircle,
} from "lucide-react";

import {
  securityCenterApi,
  type SecurityOverview,
  type SecurityPagination,
  type SecurityRecord,
  type SecuritySession,
  type SecurityView,
} from "@/services/api/security-center.api";

const PAGE_SIZE = 20;

const PAGE_INFO: Record<
  SecurityView | "sessions",
  { title: string; description: string; icon: typeof ShieldCheck }
> = {
  sessions: {
    title: "Active Sessions",
    description:
      "Review active platform sessions and revoke sessions that should no longer have access.",
    icon: Smartphone,
  },
  "login-history": {
    title: "Login History",
    description:
      "Review recorded successful logins, failed login attempts and logout activity.",
    icon: History,
  },
  events: {
    title: "Security Events",
    description:
      "Review recorded security-related events and account security changes.",
    icon: ShieldCheck,
  },
  suspicious: {
    title: "Suspicious Activity",
    description:
      "Review recorded failed login attempts. These records are not an independent fraud verdict.",
    icon: ShieldAlert,
  },
  permissions: {
    title: "Permission Changes",
    description:
      "Review permission changes recorded by the audit logging system.",
    icon: KeyRound,
  },
  "admin-activity": {
    title: "Admin Activity",
    description:
      "Review recorded Owner, Admin and Employee actions.",
    icon: Activity,
  },
  "audit-logs": {
    title: "Audit Logs",
    description:
      "Read-only view of recorded audit log entries across the platform.",
    icon: Fingerprint,
  },
  alerts: {
    title: "Security Alerts",
    description:
      "Review security events and failed login records that may need investigation.",
    icon: Bell,
  },
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function errorMessage(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error
  ) {
    const response = (error as {
      response?: { data?: { message?: string } };
    }).response;
    if (response?.data?.message) return response.data.message;
  }

  return error instanceof Error
    ? error.message
    : "An unexpected error occurred.";
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  icon: typeof ShieldCheck;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <span className="rounded-xl bg-slate-100 p-2.5 text-slate-700">
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-3 text-3xl font-bold tabular-nums text-slate-950">
        {value}
      </p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center">
      <ShieldCheck className="mx-auto h-8 w-8 text-slate-400" />
      <p className="mt-3 text-sm font-semibold text-slate-700">
        No records found
      </p>
      <p className="mt-1 text-sm text-slate-500">{message}</p>
    </div>
  );
}

function RecordTable({ records }: { records: SecurityRecord[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full min-w-[850px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Date / Time</th>
            <th className="px-4 py-3">Action</th>
            <th className="px-4 py-3">Actor</th>
            <th className="px-4 py-3">Resource</th>
            <th className="px-4 py-3">IP Address</th>
            <th className="px-4 py-3">Result</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {records.map((record) => (
            <tr key={record._id} className="hover:bg-slate-50">
              <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                {formatDate(record.createdAt)}
              </td>
              <td className="px-4 py-3">
                <span className="font-semibold text-slate-900">
                  {record.action}
                </span>
                {record.description && (
                  <p className="mt-1 max-w-xs truncate text-xs text-slate-500">
                    {record.description}
                  </p>
                )}
              </td>
              <td className="px-4 py-3">
                <span className="font-medium text-slate-800">
                  {record.actorType}
                </span>
                <p className="mt-1 max-w-[150px] truncate text-xs text-slate-500">
                  {record.actorId ?? "Unknown actor"}
                </p>
              </td>
              <td className="px-4 py-3 text-slate-600">
                {record.resource}
                {record.resourceId && (
                  <p className="mt-1 max-w-[150px] truncate text-xs text-slate-400">
                    {record.resourceId}
                  </p>
                )}
              </td>
              <td className="px-4 py-3 text-slate-600">
                {record.ipAddress ?? "—"}
              </td>
              <td className="px-4 py-3">
                {record.success ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Success
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
                    <XCircle className="h-3.5 w-3.5" />
                    Failed
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SessionTable({
  sessions,
  revokingId,
  onRevoke,
}: {
  sessions: SecuritySession[];
  revokingId: string;
  onRevoke: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Account</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">IP Address</th>
            <th className="px-4 py-3">Device / Browser</th>
            <th className="px-4 py-3">Last Activity</th>
            <th className="px-4 py-3">Expires</th>
            <th className="px-4 py-3">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sessions.map((session) => (
            <tr key={session.sessionId} className="hover:bg-slate-50">
              <td className="px-4 py-3">
                <p className="font-semibold text-slate-900">
                  {session.name}
                </p>
                <p className="text-xs text-slate-500">
                  {session.email ?? session.phone ?? session.userId}
                </p>
              </td>
              <td className="px-4 py-3 text-slate-600">
                {session.accountType}
              </td>
              <td className="px-4 py-3 text-slate-600">
                {session.ipAddress ?? "—"}
              </td>
              <td className="max-w-[220px] px-4 py-3 text-xs text-slate-600">
                <p className="line-clamp-2 break-words">
                  {session.userAgent ?? "Unknown device"}
                </p>
                {session.deviceId && (
                  <p className="mt-1 truncate text-slate-400">
                    Device: {session.deviceId}
                  </p>
                )}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                {formatDate(session.lastUsedAt)}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                {formatDate(session.expiresAt)}
              </td>
              <td className="px-4 py-3">
                <button
                  type="button"
                  disabled={revokingId === session.sessionId}
                  onClick={() => onRevoke(session.sessionId)}
                  className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                >
                  {revokingId === session.sessionId && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  )}
                  Revoke
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function SecurityCenterPage({
  view,
}: {
  view: SecurityView | "sessions";
}) {
  const info = PAGE_INFO[view];
  const Icon = info.icon;

  const [overview, setOverview] = useState<SecurityOverview | null>(null);
  const [records, setRecords] = useState<SecurityRecord[]>([]);
  const [sessions, setSessions] = useState<SecuritySession[]>([]);
  const [pagination, setPagination] = useState<SecurityPagination | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revokingId, setRevokingId] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const overviewPromise = securityCenterApi.getOverview();

      if (view === "sessions") {
        const [summary, activeSessions] = await Promise.all([
          overviewPromise,
          securityCenterApi.getSessions(),
        ]);
        setOverview(summary);
        setSessions(activeSessions);
        setRecords([]);
        setPagination(null);
      } else {
        const [summary, result] = await Promise.all([
          overviewPromise,
          securityCenterApi.getRecords(view, page, PAGE_SIZE),
        ]);
        setOverview(summary);
        setRecords(result.items);
        setPagination(result.pagination);
        setSessions([]);
      }
    } catch (loadError) {
      setError(errorMessage(loadError));
      setRecords([]);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [view, page]);

  useEffect(() => {
    void load();
  }, [load]);

  async function revokeSession(sessionId: string) {
    const confirmed = window.confirm(
      "Revoke this session? The account will need to authenticate again on that device.",
    );

    if (!confirmed) return;

    setRevokingId(sessionId);
    setNotice("");
    setError("");

    try {
      await securityCenterApi.revokeSession(sessionId);
      setNotice("Session revoked successfully.");
      await load();
    } catch (revokeError) {
      setError(errorMessage(revokeError));
    } finally {
      setRevokingId("");
    }
  }

  const totalPages = Math.max(1, pagination?.totalPages ?? 1);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-slate-900 p-3 text-white shadow-sm">
              <Icon className="h-7 w-7" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                  {info.title}
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Owner only
                </span>
              </div>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
                {info.description}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-100 disabled:opacity-50 sm:self-center"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </header>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Unable to load Security Center</p>
              <p className="mt-1 break-words">{error}</p>
            </div>
          </div>
        )}

        {notice && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            {notice}
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Active Sessions"
            value={overview?.activeSessions ?? "—"}
            icon={Smartphone}
          />
          <StatCard
            label="Failed Logins · 24h"
            value={overview?.failedLogins24h ?? "—"}
            icon={ShieldAlert}
          />
          <StatCard
            label="Security Events · 24h"
            value={overview?.securityEvents24h ?? "—"}
            icon={Activity}
          />
          <StatCard
            label="Permission Changes · 24h"
            value={overview?.permissionChanges24h ?? "—"}
            icon={KeyRound}
          />
        </section>

        {view === "suspicious" && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-semibold">Investigation note</p>
            <p className="mt-1">
              This page displays failed login records available in the audit
              log. It does not independently classify an account, IP address
              or device as malicious.
            </p>
          </div>
        )}

        {view === "alerts" && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            <p className="font-semibold">Recorded-event alerts</p>
            <p className="mt-1">
              Alerts shown here are derived from recorded security events and
              failed logins. A separate alert acknowledgement or notification
              workflow is not yet configured.
            </p>
          </div>
        )}

        {view === "sessions" ? (
          loading ? (
            <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white py-16 text-slate-500">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading active sessions…
            </div>
          ) : sessions.length ? (
            <SessionTable
              sessions={sessions}
              revokingId={revokingId}
              onRevoke={(id) => void revokeSession(id)}
            />
          ) : (
            <EmptyState message="There are no active sessions to display." />
          )
        ) : loading ? (
          <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white py-16 text-slate-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading security records…
          </div>
        ) : records.length ? (
          <>
            <RecordTable records={records} />

            <div className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center">
              <p className="text-sm text-slate-500">
                {pagination?.total.toLocaleString() ?? 0} records · Page {page} of{" "}
                {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages || loading}
                  onClick={() =>
                    setPage((current) => Math.min(totalPages, current + 1))
                  }
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        ) : (
          <EmptyState message="No matching audit records have been recorded yet." />
        )}

        <footer className="flex items-center gap-2 text-xs text-slate-400">
          <Clock3 className="h-3.5 w-3.5" />
          {overview?.generatedAt
            ? `Summary refreshed ${formatDate(overview.generatedAt)}`
            : "Summary not yet loaded"}
        </footer>
      </div>
    </main>
  );
}
