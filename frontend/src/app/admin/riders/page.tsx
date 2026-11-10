
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  Bike,
  Eye,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";

import apiClient from "@/services/api/client";
import { DataTable } from "@/components/tables/DataTable";

type RiderStatus =
  | "PENDING"
  | "ACTIVE"
  | "INACTIVE"
  | "SUSPENDED"
  | "BLOCKED"
  | "TERMINATED";

type RiderType = "INTERNAL" | "CONTRACT" | "FREELANCE";

interface RiderUser {
  _id: string;
  name?: string;
  email?: string;
  phone?: string;
}

interface Rider {
  _id: string;
  userId: string | RiderUser;
  riderCode: string;
  type: RiderType;
  name: string;
  email: string;
  phone?: string;
  vehicleType?: string;
  vehicleNumber?: string;
  status: RiderStatus;
  isAvailable: boolean;
  joinedAt?: string;
  createdAt?: string;
}

interface RiderPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

const STATUSES: RiderStatus[] = [
  "PENDING",
  "ACTIVE",
  "INACTIVE",
  "SUSPENDED",
  "BLOCKED",
  "TERMINATED",
];

const TYPES: RiderType[] = [
  "INTERNAL",
  "CONTRACT",
  "FREELANCE",
];

const EMPTY_PAGINATION: RiderPagination = {
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false,
};

function getErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error
  ) {
    const response = (
      error as {
        response?: {
          data?: { message?: string };
        };
      }
    ).response;

    if (response?.data?.message) {
      return response.data.message;
    }
  }

  return error instanceof Error
    ? error.message
    : "Something went wrong.";
}

function getStatusClasses(status: RiderStatus): string {
  const classes: Record<RiderStatus, string> = {
    PENDING: "bg-amber-100 text-amber-800",
    ACTIVE: "bg-green-100 text-green-800",
    INACTIVE: "bg-gray-100 text-gray-700",
    SUSPENDED: "bg-orange-100 text-orange-800",
    BLOCKED: "bg-red-100 text-red-800",
    TERMINATED: "bg-slate-200 text-slate-800",
  };

  return classes[status];
}

function StatusBadge({ status }: { status: RiderStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusClasses(status)}`}
    >
      {status}
    </span>
  );
}

function getUserId(userId: Rider["userId"]): string {
  return typeof userId === "string"
    ? userId
    : userId?._id ?? "";
}

function formatDate(value?: string): string {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString();
}

export default function OwnerRidersPage() {
  const [riders, setRiders] = useState<Rider[]>([]);
  const [pagination, setPagination] =
    useState<RiderPagination>(EMPTY_PAGINATION);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionId, setActionId] = useState("");

  const loadRiders = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await apiClient.get<{
        data: {
          riders: Rider[];
          pagination: RiderPagination;
        };
      }>("/riders", {
        params: {
          page,
          limit: 20,
          ...(search.trim()
            ? { search: search.trim() }
            : {}),
          ...(status ? { status } : {}),
          ...(type ? { type } : {}),
        },
      });

      const result = response.data.data;

      setRiders(result.riders ?? []);
      setPagination(result.pagination ?? EMPTY_PAGINATION);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
      setRiders([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, status, type]);

  useEffect(() => {
    void loadRiders();
  }, [loadRiders]);

  const changeStatus = async (
    rider: Rider,
    nextStatus: RiderStatus,
  ) => {
    if (rider.status === nextStatus) return;

    let reason: string | undefined;

    if (
      ["SUSPENDED", "BLOCKED", "TERMINATED"].includes(nextStatus)
    ) {
      const value = window.prompt(
        `Enter reason for ${nextStatus.toLowerCase()}:`,
      );

      if (!value?.trim()) return;

      reason = value.trim();
    }

    const confirmed = window.confirm(
      `Change ${rider.name}'s status from ${rider.status} to ${nextStatus}?`,
    );

    if (!confirmed) return;

    setActionId(rider._id);

    try {
      await apiClient.patch(`/riders/${rider._id}/status`, {
        status: nextStatus,
        ...(reason ? { reason } : {}),
      });

      await loadRiders();
    } catch (requestError) {
      window.alert(getErrorMessage(requestError));
    } finally {
      setActionId("");
    }
  };

  const resetFilters = () => {
    setSearch("");
    setStatus("");
    setType("");
    setPage(1);
  };

  const activeCount = riders.filter(
    (rider) => rider.status === "ACTIVE",
  ).length;

  const pendingCount = riders.filter(
    (rider) => rider.status === "PENDING",
  ).length;

  const availableCount = riders.filter(
    (rider) =>
      rider.status === "ACTIVE" && rider.isAvailable,
  ).length;

  const columns = [
    {
      key: "rider",
      header: "Rider",
      cell: (rider: Rider) => (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
            <Bike className="h-5 w-5" />
          </div>

          <div className="min-w-0">
            <p className="font-semibold text-slate-900">
              {rider.name}
            </p>
            <p className="text-xs text-slate-500">
              {rider.riderCode}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "contact",
      header: "Contact",
      cell: (rider: Rider) => (
        <div>
          <p className="text-sm text-slate-800">
            {rider.email}
          </p>
          <p className="text-xs text-slate-500">
            {rider.phone || "No phone"}
          </p>
        </div>
      ),
    },
    {
      key: "vehicle",
      header: "Vehicle",
      cell: (rider: Rider) => (
        <div>
          <p className="text-sm text-slate-800">
            {rider.vehicleType || "—"}
          </p>
          <p className="text-xs text-slate-500">
            {rider.vehicleNumber || "No registration"}
          </p>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      cell: (rider: Rider) => (
        <span className="text-sm text-slate-700">
          {rider.type}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (rider: Rider) => (
        <div className="space-y-1">
          <StatusBadge status={rider.status} />
          {rider.status === "ACTIVE" && (
            <p className="text-xs text-slate-500">
              {rider.isAvailable ? "Available" : "Unavailable"}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "joined",
      header: "Joined",
      cell: (rider: Rider) => (
        <span className="text-sm text-slate-600">
          {formatDate(rider.joinedAt || rider.createdAt)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (rider: Rider) => (
        <div className="flex items-center gap-2">
          <Link
            href={`/owner/riders/${rider._id}`}
            title="View rider"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border text-slate-600 hover:bg-slate-50"
          >
            <Eye className="h-4 w-4" />
          </Link>

          <select
            aria-label={`Change status for ${rider.name}`}
            value={rider.status}
            disabled={
              actionId === rider._id ||
              rider.status === "TERMINATED"
            }
            onChange={(event) =>
              void changeStatus(
                rider,
                event.target.value as RiderStatus,
              )
            }
            className="h-8 max-w-32 rounded-lg border bg-white px-2 text-xs disabled:opacity-50"
          >
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <Bike className="h-6 w-6 text-slate-700" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              Riders
            </h1>
          </div>

          <p className="mt-1 text-sm text-slate-500">
            Manage rider profiles, recruitment, availability and status.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void loadRiders()}
            disabled={loading}
            className="inline-flex h-10 items-center gap-2 rounded-lg border bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>

          <Link
            href="/admin/riders/new"
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-700"
          >
            <Plus className="h-4 w-4" />
            Add Rider
          </Link>
        </div>
      </header>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Total Riders"
          value={pagination.total}
          icon={Users}
          description="Matching riders"
        />

        <SummaryCard
          title="Active on this page"
          value={activeCount}
          icon={Activity}
          description="Currently active"
        />

        <SummaryCard
          title="Pending on this page"
          value={pendingCount}
          icon={ShieldCheck}
          description="Awaiting verification"
        />

        <SummaryCard
          title="Available on this page"
          value={availableCount}
          icon={Bike}
          description="Ready for assignments"
        />
      </div>

      {/* Filters */}
      <section className="rounded-xl border bg-white p-4">
        <div className="mb-3 flex items-center gap-2">
          <Search className="h-4 w-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-800">
            Search and filters
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search name, email, phone or code..."
            className="h-10 rounded-lg border px-3 text-sm outline-none focus:border-slate-400"
          />

          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            className="h-10 rounded-lg border bg-white px-3 text-sm"
          >
            <option value="">All statuses</option>
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>

          <select
            value={type}
            onChange={(event) => {
              setType(event.target.value);
              setPage(1);
            }}
            className="h-10 rounded-lg border bg-white px-3 text-sm"
          >
            <option value="">All rider types</option>
            {TYPES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={resetFilters}
            className="h-10 rounded-lg border px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Reset filters
          </button>
        </div>
      </section>

      {/* Error */}
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void loadRiders()}
            className="mt-2 font-semibold underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Rider table */}
      <section className="space-y-3">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Rider Directory
            </h2>
            <p className="text-sm text-slate-500">
              {pagination.total} rider(s) found
            </p>
          </div>

          <p className="text-xs text-slate-500">
            Page {pagination.page} of {Math.max(pagination.totalPages, 1)}
          </p>
        </div>

        <DataTable
          columns={columns}
          data={riders}
          getRowKey={(rider) => rider._id}
          loading={loading}
          loadingRows={8}
          emptyMessage="No riders found. Try changing your filters."
        />

        {/* Pagination */}
        <div className="flex flex-col justify-between gap-3 rounded-xl border bg-white p-4 sm:flex-row sm:items-center">
          <p className="text-sm text-slate-500">
            Showing {riders.length ? (page - 1) * 20 + 1 : 0}
            {" – "}
            {(page - 1) * 20 + riders.length}
            {" of "}
            {pagination.total}
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!pagination.hasPreviousPage || loading}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="rounded-lg border px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>

            <button
              type="button"
              disabled={!pagination.hasNextPage || loading}
              onClick={() => setPage((current) => current + 1)}
              className="rounded-lg border px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  icon: Icon,
  description,
}: {
  title: string;
  value: number;
  icon: typeof Users;
  description: string;
}) {
  return (
    <div className="rounded-xl border bg-white p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">
          {title}
        </p>
        <div className="rounded-lg bg-slate-100 p-2 text-slate-700">
          <Icon className="h-5 w-5" />
        </div>
      </div>

      <p className="mt-3 text-2xl font-bold text-slate-950">
        {value}
      </p>

      <p className="mt-1 text-xs text-slate-500">
        {description}
      </p>
    </div>
  );
}
