"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Building2,
  CheckCircle2,
  Clock,
  Eye,
  RefreshCw,
  Search,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import { DataTable } from "@/components/tables/DataTable";
import {
  sellersApi,
  type Seller,
  type SellerPagination,
} from "@/services/api/sellers.api";

const EMPTY_PAGINATION: SellerPagination = {
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
        response?: { data?: { message?: string } };
      }
    ).response;

    if (response?.data?.message) return response.data.message;
  }

  return error instanceof Error ? error.message : "Something went wrong.";
}

function formatDate(value?: string): string {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString();
}

function getStatusClasses(status: Seller["status"]): string {
  const classes: Record<Seller["status"], string> = {
    PENDING: "bg-amber-100 text-amber-800",
    ACTIVE: "bg-green-100 text-green-800",
    INACTIVE: "bg-slate-100 text-slate-700",
    SUSPENDED: "bg-orange-100 text-orange-800",
    REJECTED: "bg-red-100 text-red-800",
  };

  return classes[status];
}

function StatusBadge({ status }: { status: Seller["status"] }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusClasses(status)}`}
    >
      {status.replaceAll("_", " ")}
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
  icon: typeof Building2;
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

function DetailItem({
  label,
  value,
}: {
  label: string;
  value?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 break-words text-sm text-foreground">
        {value || "—"}
      </p>
    </div>
  );
}

export default function SellerVerificationPage() {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [pagination, setPagination] =
    useState<SellerPagination>(EMPTY_PAGINATION);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionId, setActionId] = useState("");

  const [selected, setSelected] = useState<Seller | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  const loadSellers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await sellersApi.list({
        page,
        limit: 20,
        status: "PENDING",
        ...(search.trim() ? { search: search.trim() } : {}),
      });

      setSellers(result.sellers ?? []);
      setPagination(result.pagination ?? EMPTY_PAGINATION);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
      setSellers([]);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    void loadSellers();
  }, [loadSellers]);

  const openDetails = async (seller: Seller) => {
    setSelected(seller);
    setDetailLoading(true);
    setDetailError("");

    try {
      const result = await sellersApi.getById(seller._id);
      setSelected(result);
    } catch (requestError) {
      setDetailError(getErrorMessage(requestError));
    } finally {
      setDetailLoading(false);
    }
  };

  const updateStatus = async (
    seller: Seller,
    nextStatus: "ACTIVE" | "REJECTED",
  ) => {
    if (seller.status !== "PENDING") return;

    let reason: string | undefined;

    if (nextStatus === "REJECTED") {
      const value = window.prompt("Enter the rejection reason:");

      if (!value?.trim()) return;

      reason = value.trim();
    }

    const confirmed = window.confirm(
      `Are you sure you want to ${nextStatus === "ACTIVE" ? "approve" : "reject"} "${seller.businessName}"?`,
    );

    if (!confirmed) return;

    setActionId(seller._id);

    try {
      await sellersApi.updateStatus(seller._id, nextStatus, reason);

      setSelected(null);
      await loadSellers();
    } catch (requestError) {
      window.alert(getErrorMessage(requestError));
    } finally {
      setActionId("");
    }
  };

  const pendingCount = sellers.length;

  const columns = [
    {
      key: "seller",
      header: "Seller",
      cell: (seller: Seller) => (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Building2 className="h-5 w-5" />
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
          <p className="text-sm text-foreground">{seller.email}</p>
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
      key: "registration",
      header: "Registration",
      cell: (seller: Seller) => (
        <div>
          <p className="text-sm text-foreground">
            {seller.registrationNumber || "—"}
          </p>
          <p className="text-xs text-muted-foreground">
            Tax: {seller.taxNumber || "—"}
          </p>
        </div>
      ),
    },
    {
      key: "created",
      header: "Submitted",
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
        <button
          type="button"
          onClick={() => void openDetails(seller)}
          title="View seller"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted"
        >
          <Eye className="h-4 w-4" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-foreground" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Seller Verification
            </h1>
          </div>

          <p className="mt-1 text-sm text-muted-foreground">
            Review pending seller accounts and approve or reject verification.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadSellers()}
          disabled={loading}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-semibold hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw
            className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
          />
          Refresh
        </button>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryCard
          title="Total Pending"
          value={pagination.total}
          description="Pending seller accounts"
          icon={Building2}
        />

        <SummaryCard
          title="Current Page"
          value={pendingCount}
          description="Sellers displayed on this page"
          icon={Clock}
        />

        <SummaryCard
          title="Verification Queue"
          value={pagination.totalPages}
          description="Total queue pages"
          icon={ShieldCheck}
        />
      </div>

      <section className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">
            Search pending sellers
          </h2>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search business, email, phone or seller code..."
            className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-foreground"
          />

          <button
            type="button"
            onClick={() => {
              setSearch("");
              setPage(1);
            }}
            className="h-10 rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted"
          >
            Reset
          </button>
        </div>
      </section>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          <p>{error}</p>

          {error.includes("403") && (
            <p className="mt-2">
              This endpoint currently requires Owner access in the backend.
              Admin access must be explicitly enabled with appropriate permissions.
            </p>
          )}

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
              Pending Verification Queue
            </h2>
            <p className="text-sm text-muted-foreground">
              {pagination.total} pending seller(s)
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
          emptyMessage="No pending sellers found."
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
              onClick={() => setPage((current) => Math.max(1, current - 1))}
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

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelected(null);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="seller-verification-title"
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id="seller-verification-title"
                  className="text-xl font-bold text-foreground"
                >
                  Seller Verification Details
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selected.businessName}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted"
              >
                Close
              </button>
            </div>

            {detailLoading ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Loading seller details...
              </p>
            ) : (
              <div className="mt-5 space-y-5">
                {detailError && (
                  <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                    {detailError}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={selected.status} />
                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                    {selected.type}
                  </span>
                </div>

                {selected.logoUrl && (
                  <div>
                    {/* Seller logo URL is supplied by the backend. */}
                    <img
                      src={selected.logoUrl}
                      alt={`${selected.businessName} logo`}
                      className="h-20 w-20 rounded-xl border border-border object-contain"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <DetailItem label="Business name" value={selected.businessName} />
                  <DetailItem label="Legal name" value={selected.legalName} />
                  <DetailItem label="Seller code" value={selected.sellerCode} />
                  <DetailItem label="Seller type" value={selected.type} />
                  <DetailItem label="Email" value={selected.email} />
                  <DetailItem label="Phone" value={selected.phone} />
                  <DetailItem label="Tax number" value={selected.taxNumber} />
                  <DetailItem
                    label="Registration number"
                    value={selected.registrationNumber}
                  />
                  <DetailItem label="Website" value={selected.website} />
                  <DetailItem label="Created" value={formatDate(selected.createdAt)} />
                </div>

                {selected.description && (
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground">
                      Business description
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                      {selected.description}
                    </p>
                  </div>
                )}

                {selected.notes && (
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground">
                      Notes
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                      {selected.notes}
                    </p>
                  </div>
                )}

                {selected.status === "PENDING" && (
                  <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
                    <button
                      type="button"
                      disabled={actionId === selected._id}
                      onClick={() => void updateStatus(selected, "REJECTED")}
                      className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      <XCircle className="h-4 w-4" />
                      Reject
                    </button>

                    <button
                      type="button"
                      disabled={actionId === selected._id}
                      onClick={() => void updateStatus(selected, "ACTIVE")}
                      className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Approve & Activate
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}