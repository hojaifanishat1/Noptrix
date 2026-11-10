"use client";

import { isAxiosError } from "axios";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Bike,
  FileText,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

import {
  ridersApi,
  type Rider,
  type RiderPagination,
  type RiderStatus,
} from "@/services/api/riders.api";

const PAGE_SIZE = 20;

const EMPTY_PAGINATION: RiderPagination = {
  page: 1,
  limit: PAGE_SIZE,
  total: 0,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false,
};

const STATUSES: RiderStatus[] = [
  "PENDING",
  "ACTIVE",
  "INACTIVE",
  "SUSPENDED",
  "BLOCKED",
  "TERMINATED",
];

const STATUS_TRANSITIONS: Record<RiderStatus, RiderStatus[]> = {
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
  if (isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message ?? error.message;
  }

  return error instanceof Error ? error.message : "Something went wrong.";
}

function formatDate(value?: string): string {
  if (!value) return "—";

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
}

function formatVehicle(value?: string): string {
  return value
    ? value.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
    : "Not provided";
}

function getActionLabel(status: RiderStatus): string {
  return status === "ACTIVE"
    ? "Activate"
    : status === "INACTIVE"
      ? "Set inactive"
      : status.charAt(0) + status.slice(1).toLowerCase();
}

export default function RiderVerificationPage() {
  const [riders, setRiders] = useState<Rider[]>([]);
  const [pagination, setPagination] =
    useState<RiderPagination>(EMPTY_PAGINATION);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<RiderStatus | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState("");
  const [error, setError] = useState("");

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
      setPagination(result.pagination);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
      setRiders([]);
      setPagination(EMPTY_PAGINATION);
    } finally {
      setLoading(false);
    }
  }, [page, search, status]);

  useEffect(() => {
    void loadRiders();
  }, [loadRiders]);

  const summary = useMemo(
    () => ({
      active: riders.filter((rider) => rider.status === "ACTIVE").length,
      missingDetails: riders.filter(
        (rider) => !rider.nationalId || !rider.licenseNumber,
      ).length,
      pending: riders.filter((rider) => rider.status === "PENDING").length,
    }),
    [riders],
  );

  const updateStatus = async (rider: Rider, nextStatus: RiderStatus) => {
    let reason: string | undefined;

    if (["SUSPENDED", "BLOCKED", "TERMINATED"].includes(nextStatus)) {
      const input = window.prompt(
        `Enter a reason for ${nextStatus.toLowerCase()}:`,
      );
      if (!input?.trim()) return;
      reason = input.trim();
    }

    if (
      !window.confirm(
        `Change ${rider.name}'s status from ${rider.status} to ${nextStatus}?`,
      )
    ) {
      return;
    }

    setActionId(rider._id);
    setError("");

    try {
      await ridersApi.updateStatus(rider._id, nextStatus, reason);
      await loadRiders();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setActionId("");
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <header>
        <Link
          href="/admin/riders"
          className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Riders
        </Link>

        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-slate-100 p-3">
            <ShieldCheck className="h-6 w-6 text-slate-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-950">
              Rider Verification
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Verify rider profile details and manage status through the riders API.
            </p>
          </div>
        </div>
      </header>

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        The backend stores rider identity and license numbers, but does not
        provide document uploads or a separate background-check workflow.
        Verification details below reflect the rider profile fields currently
        available.
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard
          title="Matching riders"
          value={pagination.total}
          description="Across selected filters"
          icon={Bike}
        />
        <SummaryCard
          title="Pending on this page"
          value={summary.pending}
          description="Awaiting activation"
          icon={ShieldAlert}
        />
        <SummaryCard
          title="Missing ID or license"
          value={summary.missingDetails}
          description={`On page ${pagination.page}`}
          icon={FileText}
        />
      </div>

      <section className="rounded-xl border bg-white p-4">
        <div className="mb-3 flex items-center gap-2">
          <Search className="h-4 w-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-800">
            Search and filters
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search rider code, name, email or phone"
            className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
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
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void loadRiders()}
            disabled={loading}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </section>

      <section className="space-y-4">
        {loading && riders.length === 0 ? (
          <div className="rounded-xl border bg-white p-8 text-center text-sm text-slate-500">
            Loading rider profiles…
          </div>
        ) : !loading && riders.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            No riders found.
          </div>
        ) : (
          riders.map((rider) => (
            <article
              key={rider._id}
              className="rounded-xl border border-slate-200 bg-white p-5"
            >
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-700">
                      <Bike className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">
                        {rider.name}
                      </h3>
                      <p className="text-sm text-slate-500">
                        {rider.riderCode} · {rider.type}
                      </p>
                    </div>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[rider.status]}`}
                    >
                      {rider.status}
                    </span>
                  </div>

                  <div className="grid gap-2 text-sm text-slate-600 md:grid-cols-2">
                    <p>Email: {rider.email}</p>
                    <p>Phone: {rider.phone || "Not provided"}</p>
                    <p>Vehicle: {formatVehicle(rider.vehicleType)}</p>
                    <p>Vehicle number: {rider.vehicleNumber || "Not provided"}</p>
                    <p>
                      National ID:{" "}
                      {rider.nationalId ? "Provided" : "Missing"}
                    </p>
                    <p>
                      Driving license:{" "}
                      {rider.licenseNumber ? "Provided" : "Missing"}
                    </p>
                    <p>Profile updated: {formatDate(rider.updatedAt)}</p>
                    <p>Joined: {formatDate(rider.joinedAt)}</p>
                  </div>

                  {(rider.suspensionReason || rider.terminationReason) && (
                    <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                      Status reason:{" "}
                      {rider.suspensionReason || rider.terminationReason}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 xl:max-w-64 xl:justify-end">
                  {STATUS_TRANSITIONS[rider.status].map((nextStatus) => (
                    <button
                      key={nextStatus}
                      type="button"
                      onClick={() => void updateStatus(rider, nextStatus)}
                      disabled={actionId === rider._id}
                      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50 ${
                        nextStatus === "ACTIVE"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          : nextStatus === "BLOCKED" ||
                              nextStatus === "TERMINATED"
                            ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {nextStatus === "ACTIVE" ? (
                        <BadgeCheck className="h-4 w-4" />
                      ) : nextStatus === "BLOCKED" ||
                        nextStatus === "TERMINATED" ? (
                        <ShieldAlert className="h-4 w-4" />
                      ) : (
                        <ShieldCheck className="h-4 w-4" />
                      )}
                      {actionId === rider._id
                        ? "Saving…"
                        : getActionLabel(nextStatus)}
                    </button>
                  ))}
                </div>
              </div>
            </article>
          ))
        )}
      </section>

      <div className="flex items-center justify-between rounded-xl border bg-white px-4 py-3">
        <p className="text-sm text-slate-500">
          {pagination.total} rider{pagination.total === 1 ? "" : "s"}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((current) => current - 1)}
            disabled={loading || !pagination.hasPreviousPage}
            className="rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-slate-600">
            {pagination.page} / {pagination.totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((current) => current + 1)}
            disabled={loading || !pagination.hasNextPage}
            className="rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: number;
  description: string;
  icon: typeof Bike;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">{title}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
          <p className="mt-1 text-xs text-slate-500">{description}</p>
        </div>
        <div className="rounded-lg bg-slate-100 p-2 text-slate-700">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
