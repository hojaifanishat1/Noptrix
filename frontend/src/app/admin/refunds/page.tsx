"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  CreditCard,
  Eye,
  Loader2,
  RefreshCw,
  Search,
  X,
  XCircle,
} from "lucide-react";

import { refundsAdminApi } from "@/services/api/refunds-admin.api";

import type {
  ManualRefundInput,
  Refund,
  RefundAnalytics,
  RefundPagination,
  RefundQuery,
  RefundStatus,
} from "@/features/refunds/refund.types";

const STATUS_OPTIONS: Array<{ label: string; value: RefundStatus | "ALL" }> = [
  { label: "All statuses", value: "ALL" },
  { label: "Pending", value: "PENDING" },
  { label: "Processing", value: "PROCESSING" },
  { label: "Succeeded", value: "SUCCEEDED" },
  { label: "Failed", value: "FAILED" },
  { label: "Cancelled", value: "CANCELLED" },
];

const STATUS_STYLES: Record<RefundStatus, string> = {
  PENDING:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  PROCESSING:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  SUCCEEDED:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  FAILED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  CANCELLED: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

const REASON_LABELS: Record<string, string> = {
  ORDER_CANCELLED: "Order cancelled",
  RETURN_APPROVED: "Return approved",
  PAYMENT_DUPLICATE: "Duplicate payment",
  OVERCHARGE: "Overcharge",
  DAMAGED_ITEM: "Damaged item",
  DEFECTIVE_ITEM: "Defective item",
  CUSTOMER_REQUEST: "Customer request",
  OTHER: "Other",
};

function getOrder(refund: Refund) {
  return typeof refund.orderId === "object" ? refund.orderId : undefined;
}

function getUser(refund: Refund) {
  return typeof refund.userId === "object" ? refund.userId : undefined;
}

function getPayment(refund: Refund) {
  return typeof refund.paymentId === "object" ? refund.paymentId : undefined;
}

function formatMoney(amount?: number, currency = "BDT") {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount ?? 0);
}

function formatDate(value?: string) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getErrorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (
      error as {
        response?: {
          data?: { message?: string };
        };
      }
    ).response;

    if (response?.data?.message) return response.data.message;
  }

  if (error instanceof Error) return error.message;

  return "Something went wrong. Please try again.";
}

function StatusBadge({ status }: { status: RefundStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}

function StatCard({
  label,
  value,
  helper,
  icon: Icon,
  iconClass,
}: {
  label: string;
  value: string;
  helper: string;
  icon: typeof CreditCard;
  iconClass: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            {label}
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            {value}
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {helper}
          </p>
        </div>
        <div className={`rounded-lg p-3 ${iconClass}`}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

export default function AdminRefundsPage() {
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [analytics, setAnalytics] = useState<RefundAnalytics | null>(null);
  const [pagination, setPagination] = useState<RefundPagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  });

  const [status, setStatus] = useState<RefundStatus | "ALL">("ALL");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [selectedRefund, setSelectedRefund] = useState<Refund | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [internalNote, setInternalNote] = useState("");
  const [manualReference, setManualReference] = useState("");

  const loadData = useCallback(
    async (showRefresh = false) => {
      if (showRefresh) setRefreshing(true);
      else setLoading(true);

      setError("");

      const query: RefundQuery = {
        page,
        limit: 20,
        sort,
        ...(status !== "ALL" ? { status } : {}),
      };

      try {
        const [refundResponse, analyticsResponse] = await Promise.all([
          refundsAdminApi.getRefunds(query),
          refundsAdminApi.getAnalytics(),
        ]);

        setRefunds(refundResponse.data ?? []);
        setPagination(
          refundResponse.pagination ?? {
            page,
            limit: 20,
            total: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPreviousPage: false,
          },
        );
        setAnalytics(analyticsResponse.data ?? null);
      } catch (loadError) {
        setError(getErrorMessage(loadError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [page, sort, status],
  );

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredRefunds = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return refunds;

    return refunds.filter((refund) => {
      const order = getOrder(refund);
      const user = getUser(refund);

      return [
        refund.refundNumber,
        order?.orderNumber,
        user?.name,
        user?.email,
        refund.reason,
        refund.status,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [refunds, search]);

  const openDetails = async (refund: Refund) => {
    setSelectedRefund(refund);
    setInternalNote(refund.internalNote ?? "");
    setManualReference("");
    setDetailsLoading(true);
    setNotice("");

    try {
      const response = await refundsAdminApi.getRefundDetails(refund._id);
      setSelectedRefund(response.data);
      setInternalNote(response.data.internalNote ?? "");
    } catch (detailsError) {
      setError(getErrorMessage(detailsError));
    } finally {
      setDetailsLoading(false);
    }
  };

  const refreshSelectedRefund = async (refundId: string) => {
    const response = await refundsAdminApi.getRefundDetails(refundId);
    setSelectedRefund(response.data);
  };

  const handleProcess = async () => {
    if (!selectedRefund) return;

    setActionLoading(true);
    setNotice("");
    setError("");

    try {
      await refundsAdminApi.processRefund(selectedRefund._id, {
        internalNote: internalNote.trim() || undefined,
      });

      await Promise.all([
        loadData(true),
        refreshSelectedRefund(selectedRefund._id),
      ]);

      setNotice("Refund moved to processing.");
    } catch (actionError) {
      setError(getErrorMessage(actionError));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!selectedRefund) return;

    if (
      !window.confirm("Are you sure you want to cancel this pending refund?")
    ) {
      return;
    }

    setActionLoading(true);
    setNotice("");
    setError("");

    try {
      await refundsAdminApi.cancelRefund(selectedRefund._id, {
        internalNote: internalNote.trim() || undefined,
      });

      await Promise.all([
        loadData(true),
        refreshSelectedRefund(selectedRefund._id),
      ]);

      setNotice("Pending refund cancelled.");
    } catch (actionError) {
      setError(getErrorMessage(actionError));
    } finally {
      setActionLoading(false);
    }
  };

  const handleManualConfirmation = async () => {
    if (!selectedRefund) return;

    const reference = manualReference.trim();

    if (reference.length < 3) {
      setError(
        "Enter a valid manual refund reference (at least 3 characters).",
      );
      return;
    }

    if (
      !window.confirm(
        "Confirm that the money has actually been returned to the customer?",
      )
    ) {
      return;
    }

    const input: ManualRefundInput = {
      manualReference: reference,
      internalNote: internalNote.trim() || undefined,
    };

    setActionLoading(true);
    setNotice("");
    setError("");

    try {
      await refundsAdminApi.confirmManualRefund(selectedRefund._id, input);

      await Promise.all([
        loadData(true),
        refreshSelectedRefund(selectedRefund._id),
      ]);

      setManualReference("");
      setNotice("Manual refund confirmation saved.");
    } catch (actionError) {
      setError(getErrorMessage(actionError));
    } finally {
      setActionLoading(false);
    }
  };

  const summary = analytics?.summary;

  return (
    <div className="min-h-screen bg-gray-50 p-4 dark:bg-gray-950 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <CreditCard className="text-indigo-600" size={25} />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Refunds
              </h1>
            </div>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Review, process and track customer refunds.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadData(true)}
            disabled={refreshing || loading}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            <AlertCircle className="mt-0.5 shrink-0" size={17} />
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError("")}
              className="ml-auto"
              aria-label="Dismiss error"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {notice && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
            <CheckCircle2 size={17} />
            {notice}
            <button
              type="button"
              onClick={() => setNotice("")}
              className="ml-auto"
              aria-label="Dismiss message"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total refund requests"
            value={(summary?.totalRequests ?? 0).toLocaleString()}
            helper="All recorded refund requests"
            icon={CreditCard}
            iconClass="bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300"
          />
          <StatCard
            label="Total requested"
            value={formatMoney(summary?.totalRequestedAmount)}
            helper="Requested refund amount"
            icon={ArrowDown}
            iconClass="bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300"
          />
          <StatCard
            label="Successfully refunded"
            value={formatMoney(summary?.succeededAmount)}
            helper="Confirmed completed refunds"
            icon={CheckCircle2}
            iconClass="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300"
          />
          <StatCard
            label="Currently processing"
            value={formatMoney(summary?.processingAmount)}
            helper="Refunds awaiting completion"
            icon={Clock3}
            iconClass="bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300"
          />
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-5">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white">
                Refund requests
              </h2>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {pagination.total.toLocaleString()} records found
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search this page..."
                  className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-indigo-950 sm:w-56"
                />
              </div>

              <select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as RefundStatus | "ALL");
                  setPage(1);
                }}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() =>
                  setSort((current) =>
                    current === "newest" ? "oldest" : "newest",
                  )
                }
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                {sort === "newest" ? (
                  <ArrowDown size={15} />
                ) : (
                  <ArrowUp size={15} />
                )}
                {sort === "newest" ? "Newest" : "Oldest"}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-y border-gray-200 text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:text-gray-400">
                  <th className="px-3 py-3 font-semibold">Refund</th>
                  <th className="px-3 py-3 font-semibold">Order</th>
                  <th className="px-3 py-3 font-semibold">Customer</th>
                  <th className="px-3 py-3 font-semibold">Reason</th>
                  <th className="px-3 py-3 font-semibold">Amount</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 font-semibold">Requested</th>
                  <th className="px-3 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-14 text-center">
                      <Loader2
                        className="mx-auto animate-spin text-indigo-600"
                        size={25}
                      />
                      <p className="mt-2 text-sm text-gray-500">
                        Loading refunds...
                      </p>
                    </td>
                  </tr>
                ) : filteredRefunds.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-14 text-center">
                      <CreditCard
                        className="mx-auto text-gray-300 dark:text-gray-700"
                        size={32}
                      />
                      <p className="mt-2 font-medium text-gray-700 dark:text-gray-300">
                        No refund requests found
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        Try changing the status filter or search term.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredRefunds.map((refund) => {
                    const order = getOrder(refund);
                    const user = getUser(refund);

                    return (
                      <tr
                        key={refund._id}
                        className="transition hover:bg-gray-50 dark:hover:bg-gray-800/50"
                      >
                        <td className="px-3 py-4">
                          <p className="font-semibold text-gray-900 dark:text-white">
                            {refund.refundNumber}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            {refund._id}
                          </p>
                        </td>
                        <td className="px-3 py-4 font-medium text-gray-700 dark:text-gray-300">
                          {order?.orderNumber ?? "—"}
                        </td>
                        <td className="px-3 py-4">
                          <p className="font-medium text-gray-800 dark:text-gray-200">
                            {user?.name ?? "Customer"}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            {user?.email ?? "—"}
                          </p>
                        </td>
                        <td className="px-3 py-4 text-gray-600 dark:text-gray-300">
                          {REASON_LABELS[refund.reason] ?? refund.reason}
                        </td>
                        <td className="px-3 py-4 font-semibold text-gray-900 dark:text-white">
                          {formatMoney(refund.amount, refund.currency)}
                        </td>
                        <td className="px-3 py-4">
                          <StatusBadge status={refund.status} />
                        </td>
                        <td className="px-3 py-4 text-gray-500 dark:text-gray-400">
                          {formatDate(refund.requestedAt ?? refund.createdAt)}
                        </td>
                        <td className="px-3 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => void openDetails(refund)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300"
                          >
                            <Eye size={14} />
                            Details
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-col gap-3 border-t border-gray-200 pt-4 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Page {pagination.page} of {Math.max(pagination.totalPages, 1)} ·{" "}
              {pagination.total} total records
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!pagination.hasPreviousPage || loading}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:text-gray-300"
              >
                <ChevronLeft size={16} />
                Previous
              </button>
              <button
                type="button"
                disabled={!pagination.hasNextPage || loading}
                onClick={() => setPage((current) => current + 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:text-gray-300"
              >
                Next
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </section>
      </div>

      {selectedRefund && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50">
          <button
            type="button"
            aria-label="Close refund details"
            onClick={() => setSelectedRefund(null)}
            className="absolute inset-0 cursor-default"
          />

          <aside className="relative z-10 flex h-full w-full max-w-2xl flex-col overflow-hidden border-l border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-950">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-800">
              <div>
                <h2 className="font-bold text-gray-900 dark:text-white">
                  Refund details
                </h2>
                <p className="mt-1 text-xs text-gray-500">
                  {selectedRefund.refundNumber}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRefund(null)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-5">
              {detailsLoading && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="animate-spin" size={17} />
                  Loading full refund details...
                </div>
              )}

              <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                      Refund amount
                    </p>
                    <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
                      {formatMoney(
                        selectedRefund.amount,
                        selectedRefund.currency,
                      )}
                    </p>
                  </div>
                  <StatusBadge status={selectedRefund.status} />
                </div>
                <div className="mt-4 grid gap-3 border-t border-gray-100 pt-4 text-sm dark:border-gray-800 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-gray-500">Order number</p>
                    <p className="mt-1 font-semibold text-gray-800 dark:text-gray-200">
                      {getOrder(selectedRefund)?.orderNumber ?? "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Requested at</p>
                    <p className="mt-1 font-medium text-gray-800 dark:text-gray-200">
                      {formatDate(
                        selectedRefund.requestedAt ?? selectedRefund.createdAt,
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Customer</p>
                    <p className="mt-1 font-medium text-gray-800 dark:text-gray-200">
                      {getUser(selectedRefund)?.name ?? "—"}
                    </p>
                    <p className="text-xs text-gray-500">
                      {getUser(selectedRefund)?.email ?? ""}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Reason</p>
                    <p className="mt-1 font-medium text-gray-800 dark:text-gray-200">
                      {REASON_LABELS[selectedRefund.reason] ??
                        selectedRefund.reason}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
                  Payment and source
                </h3>
                <div className="grid gap-3 rounded-xl border border-gray-200 p-4 text-sm dark:border-gray-800 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-gray-500">Payment method</p>
                    <p className="mt-1 font-medium text-gray-800 dark:text-gray-200">
                      {getPayment(selectedRefund)?.method?.toUpperCase() ??
                        (selectedRefund.paymentId
                          ? "Payment linked"
                          : "Manual / COD")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Payment provider</p>
                    <p className="mt-1 font-medium text-gray-800 dark:text-gray-200">
                      {getPayment(selectedRefund)?.provider ?? "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Cancellation source</p>
                    <p className="mt-1 break-all font-medium text-gray-800 dark:text-gray-200">
                      {typeof selectedRefund.cancellationId === "string"
                        ? selectedRefund.cancellationId
                        : selectedRefund.cancellationId
                          ? "Cancellation linked"
                          : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Return source</p>
                    <p className="mt-1 break-all font-medium text-gray-800 dark:text-gray-200">
                      {typeof selectedRefund.returnId === "string"
                        ? selectedRefund.returnId
                        : selectedRefund.returnId
                          ? "Return linked"
                          : "—"}
                    </p>
                  </div>
                </div>
              </div>

              {selectedRefund.customerNote && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">
                    Customer note
                  </h3>
                  <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-700 dark:bg-gray-900 dark:text-gray-300">
                    {selectedRefund.customerNote}
                  </p>
                </div>
              )}

              {selectedRefund.transaction && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">
                    Refund transaction
                  </h3>
                  <div className="space-y-2 rounded-xl border border-gray-200 p-4 text-sm dark:border-gray-800">
                    <div className="flex justify-between gap-3">
                      <span className="text-gray-500">Provider</span>
                      <span className="font-medium text-gray-800 dark:text-gray-200">
                        {selectedRefund.transaction.provider ?? "—"}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-gray-500">Provider refund ID</span>
                      <span className="break-all text-right font-medium text-gray-800 dark:text-gray-200">
                        {selectedRefund.transaction.providerRefundId ?? "—"}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-gray-500">Manual reference</span>
                      <span className="break-all text-right font-medium text-gray-800 dark:text-gray-200">
                        {selectedRefund.transaction.manualReference ?? "—"}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-gray-500">Processed at</span>
                      <span className="text-right font-medium text-gray-800 dark:text-gray-200">
                        {formatDate(selectedRefund.transaction.processedAt)}
                      </span>
                    </div>
                    {selectedRefund.transaction.responseMessage && (
                      <p className="border-t border-gray-100 pt-2 text-xs text-gray-500 dark:border-gray-800">
                        {selectedRefund.transaction.responseMessage}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {selectedRefund.internalNote && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">
                    Existing internal note
                  </h3>
                  <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-700 dark:bg-gray-900 dark:text-gray-300">
                    {selectedRefund.internalNote}
                  </p>
                </div>
              )}

              <div>
                <label
                  htmlFor="refund-internal-note"
                  className="mb-2 block text-sm font-semibold text-gray-900 dark:text-white"
                >
                  Internal note
                </label>
                <textarea
                  id="refund-internal-note"
                  rows={3}
                  value={internalNote}
                  onChange={(event) => setInternalNote(event.target.value)}
                  maxLength={2000}
                  placeholder="Add an internal note for this refund..."
                  className="w-full rounded-lg border border-gray-300 bg-white p-3 text-sm text-gray-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:focus:ring-indigo-950"
                />
              </div>

              {selectedRefund.status === "PROCESSING" &&
                getPayment(selectedRefund)?.method !== "online" && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
                    <div className="flex items-start gap-2">
                      <AlertCircle
                        size={18}
                        className="mt-0.5 shrink-0 text-amber-700 dark:text-amber-300"
                      />
                      <div>
                        <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                          Manual refund confirmation
                        </h3>
                        <p className="mt-1 text-xs leading-5 text-amber-800 dark:text-amber-300">
                          Only confirm after the money has actually been
                          returned to the customer.
                        </p>
                      </div>
                    </div>
                    <label
                      htmlFor="manual-refund-reference"
                      className="mb-1.5 mt-4 block text-xs font-semibold text-amber-900 dark:text-amber-200"
                    >
                      Manual reference *
                    </label>
                    <input
                      id="manual-refund-reference"
                      value={manualReference}
                      onChange={(event) =>
                        setManualReference(event.target.value)
                      }
                      minLength={3}
                      maxLength={200}
                      placeholder="Bank transfer / cash return reference"
                      className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-amber-200 dark:border-amber-800 dark:bg-gray-950 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => void handleManualConfirmation()}
                      disabled={
                        actionLoading || manualReference.trim().length < 3
                      }
                      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {actionLoading && (
                        <Loader2 className="animate-spin" size={16} />
                      )}
                      <CheckCircle2 size={16} />
                      Confirm money returned
                    </button>
                  </div>
                )}
            </div>

            <div className="flex flex-col gap-2 border-t border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900 sm:flex-row">
              {selectedRefund.status === "PENDING" && (
                <>
                  <button
                    type="button"
                    onClick={() => void handleProcess()}
                    disabled={actionLoading}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {actionLoading ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : (
                      <Clock3 size={16} />
                    )}
                    Move to processing
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCancel()}
                    disabled={actionLoading}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
                  >
                    <XCircle size={16} />
                    Cancel
                  </button>
                </>
              )}

              {selectedRefund.status !== "PENDING" && (
                <div className="flex flex-1 items-center justify-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <CheckCircle2 size={15} />
                  No further standard actions available for this status.
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
