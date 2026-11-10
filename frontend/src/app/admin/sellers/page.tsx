
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  CheckCircle2,
  Clock,
  RefreshCw,
  Search,
  ShieldAlert,
  Store,
  Users,
  Eye,
} from "lucide-react";

import { DataTable } from "@/components/tables/DataTable";
import {
  sellersApi,
  type Seller,
  type SellerStatus,
  type SellerType,
  type SellerPagination,
} from "@/services/api/sellers.api";

const STATUSES: SellerStatus[] = [
  "PENDING",
  "ACTIVE",
  "INACTIVE",
  "SUSPENDED",
  "REJECTED",
];

const TYPES: SellerType[] = ["INDIVIDUAL", "BUSINESS"];

const EMPTY_PAGINATION: SellerPagination = {
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false,
};

function getErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "response" in error) {
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

function formatDate(value?: string): string {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString();
}

function statusClasses(status: SellerStatus): string {
  const classes: Record<SellerStatus, string> = {
    PENDING: "bg-amber-100 text-amber-800",
    ACTIVE: "bg-green-100 text-green-800",
    INACTIVE: "bg-slate-100 text-slate-700",
    SUSPENDED: "bg-orange-100 text-orange-800",
    REJECTED: "bg-red-100 text-red-800",
  };

  return classes[status];
}

function StatusBadge({ status }: { status: SellerStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClasses(status)}`}
    >
      {status}
    </span>
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
  icon: typeof Store;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">
          {title}
        </p>

        <div className="rounded-lg bg-muted p-2 text-foreground">
          <Icon className="h-5 w-5" />
        </div>
      </div>

      <p className="mt-3 text-2xl font-bold text-foreground">
        {value.toLocaleString()}
      </p>

      <p className="mt-1 text-xs text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

export default function AdminSellersPage() {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [pagination, setPagination] =
    useState<SellerPagination>(EMPTY_PAGINATION);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionId, setActionId] = useState("");

  const loadSellers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await sellersApi.list({
        page,
        limit: 20,
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(status ? { status: status as SellerStatus } : {}),
        ...(type ? { type: type as SellerType } : {}),
      });

      setSellers(result.sellers ?? []);
      setPagination(result.pagination ?? EMPTY_PAGINATION);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
      setSellers([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, status, type]);

  useEffect(() => {
    void loadSellers();
  }, [loadSellers]);

  const changeStatus = async (
    seller: Seller,
    nextStatus: SellerStatus,
  ) => {
    if (seller.status === nextStatus) return;

    let reason: string | undefined;

    if (nextStatus === "SUSPENDED" || nextStatus === "REJECTED") {
      const value = window.prompt(
        `Enter the reason for ${nextStatus.toLowerCase()}:`,
      );

      if (!value?.trim()) return;

      reason = value.trim();
    }

    const confirmed = window.confirm(
      `Change ${seller.businessName}'s status from ${seller.status} to ${nextStatus}?`,
    );

    if (!confirmed) return;

    setActionId(seller._id);

    try {
      await sellersApi.updateStatus(
        seller._id,
        nextStatus,
        reason,
      );

      await loadSellers();
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

  const activeCount = sellers.filter(
    (seller) => seller.status === "ACTIVE",
  ).length;

  const pendingCount = sellers.filter(
    (seller) => seller.status === "PENDING",
  ).length;

  const suspendedCount = sellers.filter(
    (seller) => seller.status === "SUSPENDED",
  ).length;

  const columns = [
    {
      key: "seller",
      header: "Seller",
      cell: (seller: Seller) => (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Store className="h-5 w-5" />
          </div>

          <div className="min-w-0">
            <p className="font-semibold text-foreground">
              {seller.businessName}
            </p>

            <p className="text-xs text-muted-foreground">
              {seller.sellerCode}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "contact",
      header: "Contact",
      cell: (seller: Seller) => (
        <div>
          <p className="text-sm text-foreground">
            {seller.email}
          </p>

          <p className="text-xs text-muted-foreground">
            {seller.phone || "No phone"}
          </p>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      cell: (seller: Seller) => (
        <span className="text-sm text-muted-foreground">
          {seller.type}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (seller: Seller) => (
        <StatusBadge status={seller.status} />
      ),
    },
    {
      key: "verified",
      header: "Verified",
      cell: (seller: Seller) => (
        <div>
          <p className="text-sm text-foreground">
            {formatDate(seller.verifiedAt)}
          </p>

          <p className="text-xs text-muted-foreground">
            {seller.verifiedBy?.name || "—"}
          </p>
        </div>
      ),
    },
    {
      key: "joined",
      header: "Created",
      cell: (seller: Seller) => (
        <span className="text-sm text-muted-foreground">
          {formatDate(seller.createdAt)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (seller: Seller) => (
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/sellers/${seller._id}`}
            title="View seller"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted"
          >
            <Eye className="h-4 w-4" />
          </Link>

          <select
            aria-label={`Change status for ${seller.businessName}`}
            value={seller.status}
            disabled={
              actionId === seller._id ||
              seller.status === "REJECTED"
            }
            onChange={(event) =>
              void changeStatus(
                seller,
                event.target.value as SellerStatus,
              )
            }
            className="h-8 max-w-36 rounded-lg border border-border bg-background px-2 text-xs disabled:opacity-50"
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
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-foreground" />

            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Seller Management
            </h1>
          </div>

          <p className="mt-1 text-sm text-muted-foreground">
            Manage seller accounts, business information and account status.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/seller-applications"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-semibold hover:bg-muted"
          >
            <Users className="h-4 w-4" />
            Applications
          </Link>

          <button
            type="button"
            onClick={() => void loadSellers()}
            disabled={loading}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-semibold hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Total Sellers"
          value={pagination.total}
          description="Matching seller accounts"
          icon={Store}
        />

        <SummaryCard
          title="Active"
          value={activeCount}
          description="On the current page"
          icon={CheckCircle2}
        />

        <SummaryCard
          title="Pending"
          value={pendingCount}
          description="On the current page"
          icon={Clock}
        />

        <SummaryCard
          title="Suspended"
          value={suspendedCount}
          description="On the current page"
          icon={ShieldAlert}
        />
      </div>

      <section className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />

          <h2 className="text-sm font-semibold text-foreground">
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
            placeholder="Search seller, email, phone or code..."
            className="h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-foreground"
          />

          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
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
            className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
          >
            <option value="">All seller types</option>

            {TYPES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={resetFilters}
            className="h-10 rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted"
          >
            Reset filters
          </button>
        </div>
      </section>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          <p>{error}</p>

          {error.toLowerCase().includes("permission") ||
          error.includes("403") ? (
            <p className="mt-2">
              Your Admin account may not have access to this endpoint.
              The Backend seller routes currently require Owner access.
            </p>
          ) : null}

          <button
            type="button"
            onClick={() => void loadSellers()}
            className="mt-2 font-semibold underline"
          >
            Retry
          </button>
        </div>
      )}

      <section className="space-y-3">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-bold text-foreground">
              Seller Directory
            </h2>

            <p className="text-sm text-muted-foreground">
              {pagination.total} seller(s) found
            </p>
          </div>

          <p className="text-xs text-muted-foreground">
            Page {pagination.page} of {Math.max(pagination.totalPages, 1)}
          </p>
        </div>

        <DataTable
          columns={columns}
          data={sellers}
          getRowKey={(seller) => seller._id}
          loading={loading}
          loadingRows={8}
          emptyMessage="No sellers found. Try changing your filters."
        />

        <div className="flex flex-col justify-between gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center">
          <p className="text-sm text-muted-foreground">
            Showing {sellers.length ? (page - 1) * 20 + 1 : 0}
            {" – "}
            {(page - 1) * 20 + sellers.length}
            {" of "}
            {pagination.total}
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!pagination.hasPreviousPage || loading}
              onClick={() =>
                setPage((current) => Math.max(1, current - 1))
              }
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>

            <button
              type="button"
              disabled={!pagination.hasNextPage || loading}
              onClick={() => setPage((current) => current + 1)}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
