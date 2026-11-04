"use client";

import type { CancellationListResult } from "@/features/cancellations/cancellation.types";


import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  FileText,
  Filter,
  Loader2,
  Package,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
  XCircle,
} from "lucide-react";

import { cancellationsAdminApi } from "@/services/api/cancellations-admin.api";

import type {
  AdminCancellation,
  CancellationAnalytics,
  CancellationFilters,
  CancellationStatus,
} from "@/features/cancellations/cancellation.types";

const initialFilters: CancellationFilters = {
  page: 1,
  limit: 20,
  sort: "newest",
  status: "",
  search: "",
  from: "",
  to: "",
};

const statusStyles: Record<CancellationStatus, string> = {
  PENDING:
    "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  APPROVED:
    "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
  REJECTED:
    "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400",
  COMPLETED:
    "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400",
  CANCELLED:
    "bg-gray-100 text-gray-700 dark:bg-gray-500/10 dark:text-gray-400",
};

const formatMoney = (
  amount?: number,
  currency = "SAR",
) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount ?? 0);

const formatDate = (value?: string) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString();
};

const getUser = (value: AdminCancellation["userId"]) =>
  typeof value === "object" && value !== null
    ? value
    : null;

const getOrder = (value: AdminCancellation["orderId"]) =>
  typeof value === "object" && value !== null
    ? value
    : null;

function StatusBadge({
  status,
}: {
  status: CancellationStatus;
}) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles[status]}`}
    >
      {status}
    </span>
  );
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  iconClass,
}: {
  title: string;
  value: number | string;
  description: string;
  icon: typeof FileText;
  iconClass: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {title}
          </p>

          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
            {value}
          </p>

          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {description}
          </p>
        </div>

        <div className={`rounded-lg p-3 ${iconClass}`}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

export default function AdminCancellationsPage() {
  const [filters, setFilters] =
    useState<CancellationFilters>(initialFilters);

  const [searchInput, setSearchInput] = useState("");

  const [items, setItems] =
    useState<AdminCancellation[]>([]);

  const [analytics, setAnalytics] =
    useState<CancellationAnalytics | null>(null);

  const [pagination, setPagination] =
    useState<CancellationListResult["pagination"] | null>(null);

  const [selected, setSelected] =
    useState<AdminCancellation | null>(null);

  const [reviewTarget, setReviewTarget] =
    useState<AdminCancellation | null>(null);

  const [reviewStatus, setReviewStatus] =
    useState<"APPROVED" | "REJECTED">("APPROVED");

  const [approvedAmount, setApprovedAmount] =
    useState("");

  const [reviewNote, setReviewNote] =
    useState("");

  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const loadList = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result =
        await cancellationsAdminApi.list(filters);

      setItems(result.items);
      setPagination(result.pagination);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to load cancellation requests.";

      setError(message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);

    try {
      const result =
        await cancellationsAdminApi.analytics();

      setAnalytics(result);
    } catch {
      setAnalytics(null);
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([
      loadList(),
      loadAnalytics(),
    ]);
  }, [loadList, loadAnalytics]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  const updateFilter = <K extends keyof CancellationFilters>(
    key: K,
    value: CancellationFilters[K],
  ) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
      page: 1,
    }));
  };

  const applySearch = () => {
    setFilters((current) => ({
      ...current,
      search: searchInput,
      page: 1,
    }));
  };

  const openDetails = async (item: AdminCancellation) => {
    setSelected(item);
    setDetailsLoading(true);

    try {
      const result =
        await cancellationsAdminApi.get(item._id);

      setSelected(result);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load cancellation details.",
      );
    } finally {
      setDetailsLoading(false);
    }
  };

  const openReview = (
    item: AdminCancellation,
    status: "APPROVED" | "REJECTED",
  ) => {
    setReviewTarget(item);
    setReviewStatus(status);
    setApprovedAmount(
      String(item.requestedRefundAmount),
    );
    setReviewNote("");
    setActionError("");
  };

  const submitReview = async () => {
    if (!reviewTarget) return;

    if (reviewStatus === "APPROVED") {
      const amount = Number(approvedAmount);

      if (
        !Number.isFinite(amount) ||
        amount < 0 ||
        amount > reviewTarget.requestedRefundAmount
      ) {
        setActionError(
          "Approved amount must be between 0 and the requested refund amount.",
        );
        return;
      }
    }

    setReviewLoading(true);
    setActionError("");

    try {
      await cancellationsAdminApi.review(
        reviewTarget._id,
        {
          status: reviewStatus,
          ...(reviewStatus === "APPROVED"
            ? {
                approvedRefundAmount: Number(approvedAmount),
              }
            : {}),
          reviewNote: reviewNote.trim() || undefined,
        },
      );

      setReviewTarget(null);
      setSelected(null);
      setSuccessMessage(
        `Cancellation ${reviewStatus.toLowerCase()} successfully.`,
      );

      await refreshAll();
    } catch (err: unknown) {
      setActionError(
        err instanceof Error
          ? err.message
          : "Unable to review cancellation.",
      );
    } finally {
      setReviewLoading(false);
    }
  };

  const totalPages = pagination?.totalPages ?? 0;

  const pending = analytics?.pending ?? 0;

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* HEADER */}

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-red-100 p-2 text-red-700 dark:bg-red-500/10 dark:text-red-400">
              <FileText size={22} />
            </div>

            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Cancellations
            </h1>
          </div>

          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Manage customer cancellation requests and review decisions.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void refreshAll()}
          disabled={loading || analyticsLoading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          <RefreshCw
            size={16}
            className={
              loading || analyticsLoading ? "animate-spin" : ""
            }
          />
          Refresh
        </button>
      </div>

      {/* SUCCESS */}

      {successMessage && (
        <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300">
          <span className="flex items-center gap-2">
            <CheckCircle2 size={17} />
            {successMessage}
          </span>

          <button
            type="button"
            onClick={() => setSuccessMessage("")}
            aria-label="Dismiss message"
          >
            <X size={17} />
          </button>
        </div>
      )}

      {/* ANALYTICS */}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Requests"
          value={
            analyticsLoading
              ? "—"
              : analytics?.total ?? 0
          }
          description="All cancellation requests"
          icon={FileText}
          iconClass="bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400"
        />

        <StatCard
          title="Pending Review"
          value={analyticsLoading ? "—" : pending}
          description="Waiting for admin decision"
          icon={Clock}
          iconClass="bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
        />

        <StatCard
          title="Approved"
          value={
            analyticsLoading
              ? "—"
              : analytics?.approved ?? 0
          }
          description="Approved cancellation requests"
          icon={CheckCircle2}
          iconClass="bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400"
        />

        <StatCard
          title="Rejected"
          value={
            analyticsLoading
              ? "—"
              : analytics?.rejected ?? 0
          }
          description="Rejected cancellation requests"
          icon={XCircle}
          iconClass="bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Completed"
          value={
            analyticsLoading
              ? "—"
              : analytics?.completed ?? 0
          }
          description="Completed cancellation requests"
          icon={Check}
          iconClass="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
        />

        <StatCard
          title="Approval Rate"
          value={
            analyticsLoading
              ? "—"
              : `${analytics?.approvalRate ?? 0}%`
          }
          description="Approved versus rejected"
          icon={ShieldCheck}
          iconClass="bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400"
        />

        <StatCard
          title="Cancelled Records"
          value={
            analyticsLoading
              ? "—"
              : analytics?.cancelled ?? 0
          }
          description="Other cancelled requests"
          icon={AlertCircle}
          iconClass="bg-gray-100 text-gray-700 dark:bg-gray-500/10 dark:text-gray-400"
        />
      </div>

      {/* CURRENCY TOTALS */}

      {analytics?.currencyTotals &&
        analytics.currencyTotals.length > 0 && (
          <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <h2 className="mb-4 text-base font-semibold text-gray-900 dark:text-white">
              Refund Overview
            </h2>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {analytics.currencyTotals.map((entry) => (
                <div
                  key={entry._id}
                  className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800/70"
                >
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {entry._id} · {entry.requestCount} requests
                  </p>

                  <p className="mt-2 text-lg font-bold text-gray-900 dark:text-white">
                    {formatMoney(
                      entry.requestedAmount,
                      entry._id,
                    )}
                  </p>

                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Approved:{" "}
                    {formatMoney(
                      entry.approvedAmount,
                      entry._id,
                    )}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

      {/* FILTERS */}

      <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-4 flex items-center gap-2">
          <Filter
            size={18}
            className="text-gray-500"
          />

          <h2 className="font-semibold text-gray-900 dark:text-white">
            Filters & Search
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div className="xl:col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-400">
              Search
            </label>

            <div className="flex">
              <input
                value={searchInput}
                onChange={(event) =>
                  setSearchInput(event.target.value)
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") applySearch();
                }}
                placeholder="Cancellation number, order ID, customer..."
                className="min-w-0 flex-1 rounded-l-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
              />

              <button
                type="button"
                onClick={applySearch}
                className="rounded-r-lg bg-blue-600 px-4 text-white hover:bg-blue-700"
                aria-label="Search"
              >
                <Search size={17} />
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-400">
              Status
            </label>

            <select
              value={filters.status}
              onChange={(event) =>
                updateFilter(
                  "status",
                  event.target.value as CancellationStatus | "",
                )
              }
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
            >
              <option value="">All statuses</option>
              {[
                "PENDING",
                "APPROVED",
                "REJECTED",
                "COMPLETED",
                "CANCELLED",
              ].map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-400">
              From
            </label>

            <input
              type="date"
              value={filters.from}
              onChange={(event) =>
                updateFilter("from", event.target.value)
              }
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-400">
              To
            </label>

            <input
              type="date"
              value={filters.to}
              onChange={(event) =>
                updateFilter("to", event.target.value)
              }
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 dark:text-gray-400">
              Sort:
            </label>

            <select
              value={filters.sort}
              onChange={(event) =>
                updateFilter(
                  "sort",
                  event.target.value as "newest" | "oldest",
                )
              }
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>

            <select
              value={filters.limit}
              onChange={(event) =>
                updateFilter("limit", Number(event.target.value))
              }
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
            >
              <option value={10}>10 / page</option>
              <option value={20}>20 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => {
              setSearchInput("");
              setFilters(initialFilters);
            }}
            className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            Reset filters
          </button>
        </div>
      </section>

      {/* ERROR */}

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          <AlertCircle size={17} />
          {error}
        </div>
      )}

      {/* TABLE */}

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-800">
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white">
              Cancellation Requests
            </h2>

            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {pagination
                ? `${pagination.total} total requests`
                : "Loading requests..."}
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadList()}
            disabled={loading}
            className="rounded-lg border border-gray-300 p-2 text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            aria-label="Reload requests"
          >
            <RefreshCw
              size={16}
              className={loading ? "animate-spin" : ""}
            />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800/70 dark:text-gray-400">
              <tr>
                <th className="px-5 py-3">Request</th>
                <th className="px-5 py-3">Customer</th>
                <th className="px-5 py-3">Order</th>
                <th className="px-5 py-3">Reason</th>
                <th className="px-5 py-3">Refund</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Created</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-16 text-center"
                  >
                    <Loader2
                      className="mx-auto animate-spin text-blue-600"
                      size={28}
                    />

                    <p className="mt-3 text-sm text-gray-500">
                      Loading cancellation requests...
                    </p>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-16 text-center"
                  >
                    <FileText
                      size={30}
                      className="mx-auto text-gray-400"
                    />

                    <p className="mt-3 font-medium text-gray-700 dark:text-gray-300">
                      No cancellation requests found
                    </p>

                    <p className="mt-1 text-xs text-gray-500">
                      Try changing your filters.
                    </p>
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const user = getUser(item.userId);
                  const order = getOrder(item.orderId);

                  return (
                    <tr
                      key={item._id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/40"
                    >
                      <td className="px-5 py-4">
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {item.cancellationNumber}
                        </p>

                        <p className="mt-1 text-xs text-gray-500">
                          {item._id}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <p className="font-medium text-gray-800 dark:text-gray-200">
                          {user?.name ?? "Customer"}
                        </p>

                        <p className="mt-1 text-xs text-gray-500">
                          {user?.email ?? "—"}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <p className="font-medium text-gray-800 dark:text-gray-200">
                          {order?.orderNumber ??
                            (typeof item.orderId === "string"
                              ? item.orderId
                              : order?._id ?? "—")}
                        </p>

                        <p className="mt-1 text-xs text-gray-500">
                          {order?.status ?? "—"}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <span className="text-gray-700 dark:text-gray-300">
                          {item.reason.replaceAll("_", " ")}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {formatMoney(
                            item.requestedRefundAmount,
                            item.currency,
                          )}
                        </p>

                        {item.approvedRefundAmount !== undefined && (
                          <p className="mt-1 text-xs text-gray-500">
                            Approved:{" "}
                            {formatMoney(
                              item.approvedRefundAmount,
                              item.currency,
                            )}
                          </p>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <StatusBadge status={item.status} />
                      </td>

                      <td className="px-5 py-4 text-gray-600 dark:text-gray-400">
                        {formatDate(item.createdAt)}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => void openDetails(item)}
                            title="View details"
                            className="rounded-lg border border-gray-300 p-2 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                          >
                            <Eye size={16} />
                          </button>

                          {item.status === "PENDING" && (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  openReview(item, "APPROVED")
                                }
                                title="Approve"
                                className="rounded-lg bg-green-600 p-2 text-white hover:bg-green-700"
                              >
                                <Check size={16} />
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  openReview(item, "REJECTED")
                                }
                                title="Reject"
                                className="rounded-lg bg-red-600 p-2 text-white hover:bg-red-700"
                              >
                                <X size={16} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 px-5 py-4 dark:border-gray-800">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Page {pagination?.page ?? 1} of {totalPages || 1}
            {" · "}
            {pagination?.total ?? 0} records
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={
                loading ||
                !pagination?.hasPreviousPage
              }
              onClick={() =>
                setFilters((current) => ({
                  ...current,
                  page: Math.max(1, current.page - 1),
                }))
              }
              className="rounded-lg border border-gray-300 p-2 text-gray-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:text-gray-300"
              aria-label="Previous page"
            >
              <ChevronLeft size={17} />
            </button>

            <button
              type="button"
              disabled={
                loading ||
                !pagination?.hasNextPage
              }
              onClick={() =>
                setFilters((current) => ({
                  ...current,
                  page: current.page + 1,
                }))
              }
              className="rounded-lg border border-gray-300 p-2 text-gray-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:text-gray-300"
              aria-label="Next page"
            >
              <ChevronRight size={17} />
            </button>
          </div>
        </div>
      </section>

      {/* DETAILS MODAL */}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-5">
          <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-xl dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-800">
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-white">
                  Cancellation Details
                </h2>

                <p className="mt-1 text-xs text-gray-500">
                  {selected.cancellationNumber}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                aria-label="Close details"
              >
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto p-5">
              {detailsLoading ? (
                <div className="py-12 text-center">
                  <Loader2
                    className="mx-auto animate-spin text-blue-600"
                    size={28}
                  />
                  <p className="mt-3 text-sm text-gray-500">
                    Loading details...
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {(() => {
                    const user = getUser(selected.userId);
                    const order = getOrder(selected.orderId);

                    return (
                      <>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
                            <p className="text-xs text-gray-500">
                              Request Status
                            </p>

                            <div className="mt-2">
                              <StatusBadge status={selected.status} />
                            </div>

                            <p className="mt-4 text-xs text-gray-500">
                              Created
                            </p>

                            <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                              {formatDate(selected.createdAt)}
                            </p>
                          </div>

                          <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
                            <p className="text-xs text-gray-500">
                              Requested Refund
                            </p>

                            <p className="mt-2 text-xl font-bold text-gray-900 dark:text-white">
                              {formatMoney(
                                selected.requestedRefundAmount,
                                selected.currency,
                              )}
                            </p>

                            <p className="mt-3 text-xs text-gray-500">
                              Approved Refund
                            </p>

                            <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                              {selected.approvedRefundAmount !== undefined
                                ? formatMoney(
                                    selected.approvedRefundAmount,
                                    selected.currency,
                                  )
                                : "Not approved"}
                            </p>
                          </div>
                        </div>

                        <div>
                          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                            <ShieldCheck size={17} />
                            Customer Information
                          </h3>

                          <div className="grid gap-3 rounded-lg border border-gray-200 p-4 sm:grid-cols-2 dark:border-gray-800">
                            <div>
                              <p className="text-xs text-gray-500">
                                Name
                              </p>
                              <p className="mt-1 text-sm text-gray-900 dark:text-white">
                                {user?.name ?? "—"}
                              </p>
                            </div>

                            <div>
                              <p className="text-xs text-gray-500">
                                Email
                              </p>
                              <p className="mt-1 break-all text-sm text-gray-900 dark:text-white">
                                {user?.email ?? "—"}
                              </p>
                            </div>

                            <div>
                              <p className="text-xs text-gray-500">
                                Phone
                              </p>
                              <p className="mt-1 text-sm text-gray-900 dark:text-white">
                                {user?.phone ?? "—"}
                              </p>
                            </div>

                            <div>
                              <p className="text-xs text-gray-500">
                                User ID
                              </p>
                              <p className="mt-1 break-all text-sm text-gray-900 dark:text-white">
                                {typeof selected.userId === "string"
                                  ? selected.userId
                                  : user?._id ?? "—"}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div>
                          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                            <Package size={17} />
                            Order Information
                          </h3>

                          <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div>
                                <p className="text-xs text-gray-500">
                                  Order Number
                                </p>
                                <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                                  {order?.orderNumber ??
                                    (typeof selected.orderId === "string"
                                      ? selected.orderId
                                      : order?._id ?? "—")}
                                </p>
                              </div>

                              <div>
                                <p className="text-xs text-gray-500">
                                  Order Status
                                </p>
                                <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                                  {order?.status ?? "—"}
                                </p>
                              </div>

                              <div>
                                <p className="text-xs text-gray-500">
                                  Payment Status
                                </p>
                                <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                                  {order?.paymentStatus ?? "—"}
                                </p>
                              </div>

                              <div>
                                <p className="text-xs text-gray-500">
                                  Payment Method
                                </p>
                                <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                                  {order?.paymentMethod ?? "—"}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div>
                          <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
                            Cancellation Reason
                          </h3>

                          <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {selected.reason.replaceAll("_", " ")}
                            </p>

                            <p className="mt-3 whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-400">
                              {selected.customerNote ||
                                "No customer note provided."}
                            </p>
                          </div>
                        </div>

                        <div>
                          <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
                            Cancellation Items
                          </h3>

                          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
                            <table className="w-full min-w-[450px] text-sm">
                              <thead className="bg-gray-50 text-xs text-gray-500 dark:bg-gray-800">
                                <tr>
                                  <th className="px-4 py-3 text-left">
                                    Product
                                  </th>
                                  <th className="px-4 py-3 text-right">
                                    Qty
                                  </th>
                                  <th className="px-4 py-3 text-right">
                                    Unit Price
                                  </th>
                                  <th className="px-4 py-3 text-right">
                                    Total
                                  </th>
                                </tr>
                              </thead>

                              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                {selected.items.map((item, index) => (
                                  <tr
                                    key={item._id ?? item.orderItemId ?? index}
                                  >
                                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                                      {item.productName}
                                    </td>

                                    <td className="px-4 py-3 text-right">
                                      {item.quantity}
                                    </td>

                                    <td className="px-4 py-3 text-right">
                                      {formatMoney(
                                        item.unitPrice,
                                        selected.currency,
                                      )}
                                    </td>

                                    <td className="px-4 py-3 text-right font-semibold">
                                      {formatMoney(
                                        item.lineTotal,
                                        selected.currency,
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {selected.reviewNote && (
                          <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
                            <p className="text-xs font-semibold text-gray-500">
                              Review Note
                            </p>

                            <p className="mt-2 whitespace-pre-wrap text-sm text-gray-900 dark:text-white">
                              {selected.reviewNote}
                            </p>

                            <p className="mt-3 text-xs text-gray-500">
                              Reviewed by:{" "}
                              {selected.reviewedByRole ?? "—"}
                              {" · "}
                              {formatDate(selected.reviewedAt)}
                            </p>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>

            <div className="flex flex-wrap justify-between gap-2 border-t border-gray-200 px-5 py-4 dark:border-gray-800">
              <div className="flex flex-wrap gap-2">
                {selected.status === "PENDING" && (
                  <>
                    <button
                      type="button"
                      onClick={() => openReview(selected, "APPROVED")}
                      className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                    >
                      Approve
                    </button>

                    <button
                      type="button"
                      onClick={() => openReview(selected, "REJECTED")}
                      className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                    >
                      Reject
                    </button>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REVIEW MODAL */}

      {reviewTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-3 sm:p-5">
          <div className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-xl dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-800">
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-white">
                  {reviewStatus === "APPROVED"
                    ? "Approve Cancellation"
                    : "Reject Cancellation"}
                </h2>

                <p className="mt-1 text-xs text-gray-500">
                  {reviewTarget.cancellationNumber}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setReviewTarget(null)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                aria-label="Close review"
              >
                <X size={19} />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div
                className={`rounded-lg p-3 text-sm ${
                  reviewStatus === "APPROVED"
                    ? "bg-green-50 text-green-800 dark:bg-green-950/30 dark:text-green-300"
                    : "bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-300"
                }`}
              >
                {reviewStatus === "APPROVED"
                  ? "Approving this request will cancel the associated order and release its inventory allocations. Payment refund is handled separately."
                  : "Rejecting this request will leave the associated order unchanged."}
              </div>

              {reviewStatus === "APPROVED" && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Approved Refund Amount ({reviewTarget.currency})
                  </label>

                  <input
                    type="number"
                    min="0"
                    max={reviewTarget.requestedRefundAmount}
                    step="0.01"
                    value={approvedAmount}
                    onChange={(event) =>
                      setApprovedAmount(event.target.value)
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                  />

                  <p className="mt-1 text-xs text-gray-500">
                    Requested maximum:{" "}
                    {formatMoney(
                      reviewTarget.requestedRefundAmount,
                      reviewTarget.currency,
                    )}
                  </p>
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Review Note
                </label>

                <textarea
                  rows={4}
                  maxLength={1000}
                  value={reviewNote}
                  onChange={(event) =>
                    setReviewNote(event.target.value)
                  }
                  placeholder="Write an optional review note..."
                  className="w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                />

                <p className="mt-1 text-right text-xs text-gray-500">
                  {reviewNote.length}/1000
                </p>
              </div>

              {actionError && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
                  {actionError}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-4 dark:border-gray-800">
              <button
                type="button"
                disabled={reviewLoading}
                onClick={() => setReviewTarget(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={reviewLoading}
                onClick={() => void submitReview()}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
                  reviewStatus === "APPROVED"
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {reviewLoading && (
                  <Loader2 size={15} className="animate-spin" />
                )}

                {reviewStatus === "APPROVED"
                  ? "Confirm Approval"
                  : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
