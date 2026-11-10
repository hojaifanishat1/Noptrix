"use client";

import { isAxiosError } from "axios";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Bike,
  CheckCircle2,
  Clock3,
  FileCheck,
  RefreshCw,
  Search,
  ShieldAlert,
} from "lucide-react";

import {
  ridersApi,
  type Rider,
  type RiderPagination,
} from "@/services/api/riders.api";
import { jobApplicationsApi } from "@/services/api/job-applications.api";
import type { JobApplication } from "@/features/job-applications/job-application.types";

const PAGE_SIZE = 20;

const EMPTY_PAGINATION: RiderPagination = {
  page: 1,
  limit: PAGE_SIZE,
  total: 0,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false,
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

export default function RiderApplicationsPage() {
  const [riders, setRiders] = useState<Rider[]>([]);
  const [conversionRequests, setConversionRequests] = useState<JobApplication[]>([]);
  const [pagination, setPagination] =
    useState<RiderPagination>(EMPTY_PAGINATION);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState("");
  const [error, setError] = useState("");

  const loadApplications = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [result, requestResult] = await Promise.all([
        ridersApi.list({
          page,
          limit: PAGE_SIZE,
          status: "PENDING",
          ...(search.trim() ? { search: search.trim() } : {}),
        }),
        jobApplicationsApi.getAll({
          page: 1,
          limit: 100,
          status: "SELECTED",
          riderConversionRequested: true,
        }),
      ]);

      setRiders(result.riders);
      setPagination(result.pagination);
      setConversionRequests(requestResult.applications);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
      setRiders([]);
      setConversionRequests([]);
      setPagination(EMPTY_PAGINATION);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  const approveConversion = async (application: JobApplication) => {
    const riderCode = window.prompt(
      "Enter a unique Rider Code (example: RID-0001):",
    );
    if (!riderCode?.trim()) return;

    if (!window.confirm(`Approve ${application.name} as a PENDING rider?`)) {
      return;
    }

    setActionId(application._id);
    setError("");
    try {
      await ridersApi.convertApplication(application._id, {
        riderCode: riderCode.trim(),
      });
      await loadApplications();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setActionId("");
    }
  };

  useEffect(() => {
    void loadApplications();
  }, [loadApplications]);

  const changeStatus = async (rider: Rider, action: "activate" | "block") => {
    let reason: string | undefined;

    if (action === "block") {
      const input = window.prompt("Enter a reason for blocking this rider:");
      if (!input?.trim()) return;
      reason = input.trim();
    }

    const nextStatus = action === "activate" ? "ACTIVE" : "BLOCKED";
    if (
      !window.confirm(
        `${action === "activate" ? "Activate" : "Block"} ${rider.name}?`,
      )
    ) {
      return;
    }

    setActionId(rider._id);
    setError("");

    try {
      await ridersApi.updateStatus(rider._id, nextStatus, reason);
      await loadApplications();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setActionId("");
    }
  };

  const missingDocuments = riders.filter(
    (rider) => !rider.nationalId || !rider.licenseNumber,
  ).length;

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
            <FileCheck className="h-6 w-6 text-slate-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-950">
              Rider Applications
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Pending rider profiles from the rider management API.
            </p>
          </div>
        </div>
      </header>

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        The backend does not have a separate application record or rejection
        status. This page lists riders with <strong>PENDING</strong> status;
        activating sets their status to <strong>ACTIVE</strong>, while blocking
        sets it to <strong>BLOCKED</strong>.
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
          title="Pending riders"
          value={pagination.total}
          description="Matching pending profiles"
          icon={Bike}
        />
        <SummaryCard
          title="Missing ID or license"
          value={missingDocuments}
          description="On this page"
          icon={ShieldAlert}
        />
        <SummaryCard
          title="Loaded"
          value={riders.length}
          description={`Page ${pagination.page} of ${pagination.totalPages}`}
          icon={Clock3}
        />
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-slate-900">
          Rider conversion requests ({conversionRequests.length})
        </h2>
        {conversionRequests.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white p-5 text-sm text-slate-500">
            No selected applicants are waiting for owner approval.
          </div>
        ) : (
          conversionRequests.map((application) => (
            <article
              key={application._id}
              className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <h3 className="font-semibold text-slate-900">{application.name}</h3>
                <p className="text-sm text-slate-500">
                  {application.email} · {application.phone || "No phone"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {typeof application.vacancyId === "string"
                    ? "Rider vacancy"
                    : application.vacancyId.title}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void approveConversion(application)}
                disabled={actionId === application._id}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
              >
                {actionId === application._id ? "Approving…" : "Approve as pending rider"}
              </button>
            </article>
          ))
        )}
      </section>

      <section className="rounded-xl border bg-white p-4">
        <div className="mb-3 flex items-center gap-2">
          <Search className="h-4 w-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-800">
            Search pending riders
          </h2>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search name, email, phone or rider code"
            className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
          />
          <button
            type="button"
            onClick={() => void loadApplications()}
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
            Loading pending riders…
          </div>
        ) : !loading && riders.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            No pending riders found.
          </div>
        ) : (
          riders.map((rider) => (
            <article
              key={rider._id}
              className="rounded-xl border border-slate-200 bg-white p-5"
            >
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
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
                  </div>

                  <div className="grid gap-2 text-sm text-slate-600 md:grid-cols-2">
                    <p>Email: {rider.email}</p>
                    <p>Phone: {rider.phone || "Not provided"}</p>
                    <p>Vehicle: {formatVehicle(rider.vehicleType)}</p>
                    <p>Vehicle number: {rider.vehicleNumber || "Not provided"}</p>
                    <p>National ID: {rider.nationalId || "Not provided"}</p>
                    <p>License: {rider.licenseNumber || "Not provided"}</p>
                    <p>Created: {formatDate(rider.createdAt)}</p>
                  </div>

                  {rider.notes && (
                    <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                      {rider.notes}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void changeStatus(rider, "activate")}
                    disabled={actionId === rider._id}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {actionId === rider._id ? "Saving…" : "Activate rider"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void changeStatus(rider, "block")}
                    disabled={actionId === rider._id}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                  >
                    <ShieldAlert className="h-4 w-4" />
                    Block rider
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </section>

      <Pagination
        pagination={pagination}
        disabled={loading}
        onChange={setPage}
      />
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

function Pagination({
  pagination,
  disabled,
  onChange,
}: {
  pagination: RiderPagination;
  disabled: boolean;
  onChange: (page: number) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border bg-white px-4 py-3">
      <p className="text-sm text-slate-500">
        {pagination.total} pending rider{pagination.total === 1 ? "" : "s"}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(pagination.page - 1)}
          disabled={disabled || !pagination.hasPreviousPage}
          className="rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50"
        >
          Previous
        </button>
        <span className="text-sm text-slate-600">
          {pagination.page} / {pagination.totalPages}
        </span>
        <button
          type="button"
          onClick={() => onChange(pagination.page + 1)}
          disabled={disabled || !pagination.hasNextPage}
          className="rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}
