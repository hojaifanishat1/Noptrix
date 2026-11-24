"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bike,
  RefreshCw,
  Search,
  ShieldCheck,
  ShieldAlert,
  Ban,
  CheckCircle2,
} from "lucide-react";

import {
  ridersApi,
  type Rider,
  type RiderStatus,
} from "@/services/api/riders.api";

const PAGE_SIZE = 20;

const STATUSES: RiderStatus[] = [
  "PENDING",
  "ACTIVE",
  "INACTIVE",
  "SUSPENDED",
  "BLOCKED",
  "TERMINATED",
];

const TRANSITIONS: Record<RiderStatus, RiderStatus[]> = {
  PENDING: ["ACTIVE", "INACTIVE", "BLOCKED"],
  ACTIVE: ["INACTIVE", "SUSPENDED", "BLOCKED", "TERMINATED"],
  INACTIVE: ["ACTIVE", "SUSPENDED", "TERMINATED"],
  SUSPENDED: ["ACTIVE", "INACTIVE", "BLOCKED", "TERMINATED"],
  BLOCKED: ["ACTIVE", "TERMINATED"],
  TERMINATED: [],
};

const STATUS_STYLES: Record<RiderStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  ACTIVE: "bg-green-100 text-green-800",
  INACTIVE: "bg-gray-100 text-gray-700",
  SUSPENDED: "bg-orange-100 text-orange-800",
  BLOCKED: "bg-red-100 text-red-800",
  TERMINATED: "bg-slate-200 text-slate-800",
};

function getErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error
  ) {
    const response = (
      error as { response?: { data?: { message?: string } } }
    ).response;

    return response?.data?.message ?? "Request failed.";
  }

  return error instanceof Error
    ? error.message
    : "Something went wrong.";
}

function formatDate(value?: string): string {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString();
}

function getActionLabel(status: RiderStatus): string {
  const labels: Record<RiderStatus, string> = {
    PENDING: "Pending",
    ACTIVE: "Activate",
    INACTIVE: "Set inactive",
    SUSPENDED: "Suspend",
    BLOCKED: "Block",
    TERMINATED: "Terminate",
  };

  return labels[status];
}

export default function RiderStatusPage() {
  const [riders, setRiders] = useState<Rider[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<RiderStatus | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadRiders = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await ridersApi.list({
        page,
        limit: PAGE_SIZE,
        ...(status !== "ALL" ? { status } : {}),
        ...(search.trim() ? { search: search.trim() } : {}),
      });

      setRiders(result.riders);
      setTotal(result.pagination.total);
      setTotalPages(Math.max(1, result.pagination.totalPages));
    } catch (requestError) {
      setError(getErrorMessage(requestError));
      setRiders([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [page, search, status]);

  useEffect(() => {
    void loadRiders();
  }, [loadRiders]);

  const counts = useMemo(() => {
    const result: Record<RiderStatus, number> = {
      PENDING: 0,
      ACTIVE: 0,
      INACTIVE: 0,
      SUSPENDED: 0,
      BLOCKED: 0,
      TERMINATED: 0,
    };

    for (const rider of riders) {
      result[rider.status] += 1;
    }

    return result;
  }, [riders]);

  async function changeStatus(
    rider: Rider,
    nextStatus: RiderStatus,
  ) {
    if (!TRANSITIONS[rider.status].includes(nextStatus)) {
      return;
    }

    let reason: string | undefined;

    if (["SUSPENDED", "BLOCKED", "TERMINATED"].includes(nextStatus)) {
      const value = window.prompt(
        `Enter the reason for ${nextStatus.toLowerCase()}:`,
      );

      if (!value?.trim()) {
        return;
      }

      reason = value.trim();
    }

    const confirmed = window.confirm(
      `Change ${rider.name}'s status from ${rider.status} to ${nextStatus}?`,
    );

    if (!confirmed) return;

    setActionId(rider._id);
    setError("");
    setSuccess("");

    try {
      await ridersApi.updateStatus(
        rider._id,
        nextStatus,
        reason,
      );

      setSuccess(
        `${rider.name}'s status changed to ${nextStatus}.`,
      );

      await loadRiders();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setActionId("");
    }
  }

  return (
    <main className="space-y-6 p-4 sm:p-6">
      <header>
        <Link
          href="/admin/riders"
          className="mb-3 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Riders
        </Link>

        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-xl bg-slate-100 p-3">
            <ShieldCheck className="h-6 w-6 text-slate-700" />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-slate-950">
              Rider Status Management
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Review rider account statuses and manage permitted status transitions.
            </p>
          </div>
        </div>
      </header>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800"
        >
          {success}
        </div>
      )}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {STATUSES.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => {
              setStatus(item);
              setPage(1);
            }}
            className={`rounded-xl border p-4 text-left transition ${
              status === item
                ? "border-slate-900 bg-slate-50 ring-1 ring-slate-900"
                : "border-slate-200 bg-white hover:bg-slate-50"
            }`}
          >
            <p className="text-xs font-medium text-slate-500">
              {item}
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {counts[item]}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Current page
            </p>
          </button>
        ))}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center gap-2">
          <Search className="h-4 w-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-800">
            Search and filters
          </h2>
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search name, email, rider code or phone"
            className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-500"
          />

          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as RiderStatus | "ALL");
              setPage(1);
            }}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="ALL">All statuses</option>
            {STATUSES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => void loadRiders()}
            disabled={loading}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b p-4">
          <div>
            <h2 className="font-semibold text-slate-900">
              Rider accounts
            </h2>
            <p className="text-xs text-slate-500">
              {total} matching riders
            </p>
          </div>

          <span className="text-xs text-slate-500">
            Page {page} of {totalPages}
          </span>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Loading riders...
          </div>
        ) : riders.length === 0 ? (
          <div className="p-10 text-center">
            <Bike className="mx-auto mb-3 h-8 w-8 text-slate-300" />
            <p className="font-medium text-slate-700">
              No riders found
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Try changing the search or status filter.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {riders.map((rider) => {
              const nextStatuses = TRANSITIONS[rider.status];

              return (
                <article
                  key={rider._id}
                  className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="rounded-full bg-slate-100 p-3">
                      <Bike className="h-5 w-5 text-slate-600" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-slate-900">
                          {rider.name}
                        </h3>

                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[rider.status]}`}
                        >
                          {rider.status}
                        </span>
                      </div>

                      <p className="mt-1 text-sm text-slate-500">
                        {rider.riderCode} · {rider.type}
                      </p>

                      <p className="mt-1 break-all text-sm text-slate-600">
                        {rider.email}
                        {rider.phone ? ` · ${rider.phone}` : ""}
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        Joined: {formatDate(rider.joinedAt)}
                      </p>

                      <Link
                        href={`/admin/riders/${rider._id}`}
                        className="mt-2 inline-block text-sm font-medium text-blue-700 hover:underline"
                      >
                        View rider details
                      </Link>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    {nextStatuses.length === 0 ? (
                      <span className="text-xs text-slate-400">
                        No further status transitions
                      </span>
                    ) : (
                      nextStatuses.map((nextStatus) => (
                        <button
                          key={nextStatus}
                          type="button"
                          disabled={actionId === rider._id}
                          onClick={() =>
                            void changeStatus(rider, nextStatus)
                          }
                          className={`inline-flex min-h-9 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                            nextStatus === "ACTIVE"
                              ? "border-green-200 text-green-700 hover:bg-green-50"
                              : ["SUSPENDED", "BLOCKED", "TERMINATED"].includes(nextStatus)
                                ? "border-red-200 text-red-700 hover:bg-red-50"
                                : "border-slate-200 text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          {nextStatus === "ACTIVE" ? (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          ) : nextStatus === "SUSPENDED" ||
                            nextStatus === "BLOCKED" ||
                            nextStatus === "TERMINATED" ? (
                            <Ban className="h-3.5 w-3.5" />
                          ) : (
                            <ShieldAlert className="h-3.5 w-3.5" />
                          )}

                          {actionId === rider._id
                            ? "Saving..."
                            : getActionLabel(nextStatus)}
                        </button>
                      ))
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-between border-t p-4">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            className="rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-40"
          >
            Previous
          </button>

          <span className="text-xs text-slate-500">
            Page {page} / {totalPages}
          </span>

          <button
            type="button"
            disabled={page >= totalPages || loading}
            onClick={() =>
              setPage((current) => Math.min(totalPages, current + 1))
            }
            className="rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </section>
    </main>
  );
}
