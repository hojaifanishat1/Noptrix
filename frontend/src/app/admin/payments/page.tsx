"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Search,
  RefreshCw,
  Eye,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CreditCard,
  X,
  AlertCircle,
} from "lucide-react";

import { paymentsAdminApi } from "@/services/api/payments-admin.api";

import type {
  AdminPayment,
  AdminPaymentFilters,
  PaymentStatus,
} from "@/features/payments/payment.types";

const emptyPagination = {
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0,
  hasNextPage: false,
  hasPreviousPage: false,
};

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-gray-700 dark:bg-gray-800 dark:text-white";

const labelClass =
  "mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300";

function errorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (
      error as {
        response?: { data?: { message?: string } };
      }
    ).response;

    return response?.data?.message || "Something went wrong.";
  }

  return error instanceof Error ? error.message : "Something went wrong.";
}

function money(value: number, currency = "BDT"): string {
  const amount = Number(value || 0);

  if (currency === "BDT") {
    return `৳${amount.toLocaleString("en-BD", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function dateTime(value?: string): string {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString();
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    created: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    pending:
      "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    processing: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    success:
      "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
    failed: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
    cancelled: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    refunded:
      "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
    partially_refunded:
      "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
    expired: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
        styles[status] || styles.created
      }`}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value?: string | number | null;
}) {
  return (
    <div className="flex flex-col gap-1 border-b border-gray-100 py-3 last:border-0 dark:border-gray-800 sm:flex-row sm:items-start sm:justify-between">
      <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
      <span className="break-all text-sm font-medium text-gray-900 dark:text-gray-100 sm:max-w-[65%] sm:text-right">
        {value === undefined || value === null || value === "" ? "—" : value}
      </span>
    </div>
  );
}

export default function AdminPaymentsPage() {
  const [items, setItems] = useState<AdminPayment[]>([]);
  const [pagination, setPagination] = useState(emptyPagination);

  const [filters, setFilters] = useState<AdminPaymentFilters>({
    page: 1,
    limit: 20,
    sort: "newest",
    status: "",
    method: "",
    search: "",
  });

  const [searchInput, setSearchInput] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<AdminPayment | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState("");

  const loadPayments = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await paymentsAdminApi.list(filters);
      setItems(result.items);
      setPagination(result.pagination);
    } catch (err) {
      setError(errorMessage(err));
      setItems([]);
      setPagination({
        ...emptyPagination,
        page: filters.page,
        limit: filters.limit,
      });
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void Promise.resolve().then(loadPayments);
  }, [loadPayments]);

  const updateFilter = <K extends keyof AdminPaymentFilters>(
    key: K,
    value: AdminPaymentFilters[K],
  ) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
      ...(key !== "page" ? { page: 1 } : {}),
    }));
  };

  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updateFilter("search", searchInput.trim());
  };

  const resetFilters = () => {
    setSearchInput("");
    setFilters({
      page: 1,
      limit: 20,
      sort: "newest",
      status: "",
      method: "",
      search: "",
    });
  };

  const openDetails = async (payment: AdminPayment) => {
    setSelected(null);
    setDetailsError("");
    setDetailsLoading(true);

    try {
      const result = await paymentsAdminApi.get(payment.transactionId);
      setSelected(result);
    } catch (err) {
      setDetailsError(errorMessage(err));
    } finally {
      setDetailsLoading(false);
    }
  };

  const closeDetails = () => {
    if (!detailsLoading) {
      setSelected(null);
      setDetailsError("");
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Payments
            </h1>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            View and monitor customer payment transactions.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadPayments()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Matching payments
          </p>
          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
            {pagination.total.toLocaleString()}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Current page
          </p>
          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
            {pagination.totalPages
              ? `${pagination.page} / ${pagination.totalPages}`
              : "0 / 0"}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">Page size</p>
          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
            {pagination.limit}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <form
          onSubmit={submitSearch}
          className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5"
        >
          <div className="xl:col-span-2">
            <label className={labelClass}>Search payments</label>
            <div className="flex">
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Transaction, reference, order or provider ID"
                className={`${inputClass} rounded-r-none`}
              />
              <button
                type="submit"
                className="rounded-r-lg bg-blue-600 px-4 text-white hover:bg-blue-700"
                aria-label="Search"
              >
                <Search size={18} />
              </button>
            </div>
          </div>

          <div>
            <label className={labelClass}>Payment status</label>
            <select
              value={filters.status || ""}
              onChange={(event) =>
                updateFilter("status", event.target.value as PaymentStatus | "")
              }
              className={inputClass}
            >
              <option value="">All statuses</option>
              <option value="created">Created</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
              <option value="refunded">Refunded</option>
              <option value="partially_refunded">Partially refunded</option>
              <option value="expired">Expired</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>Payment method</label>
            <select
              value={filters.method || ""}
              onChange={(event) =>
                updateFilter(
                  "method",
                  event.target.value as "cod" | "online" | "",
                )
              }
              className={inputClass}
            >
              <option value="">All methods</option>
              <option value="cod">Cash on delivery</option>
              <option value="online">Online</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>Sort by</label>
            <select
              value={filters.sort}
              onChange={(event) =>
                updateFilter("sort", event.target.value as "newest" | "oldest")
              }
              className={inputClass}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>Rows per page</label>
            <select
              value={filters.limit}
              onChange={(event) =>
                updateFilter("limit", Number(event.target.value))
              }
              className={inputClass}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={resetFilters}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Reset filters
            </button>
          </div>
        </form>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              <tr>
                <th className="px-4 py-3">Transaction</th>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Provider</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <Loader2 className="mx-auto h-7 w-7 animate-spin text-blue-600" />
                    <p className="mt-2 text-sm text-gray-500">
                      Loading payments...
                    </p>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-16 text-center text-gray-500 dark:text-gray-400"
                  >
                    No payments found.
                  </td>
                </tr>
              ) : (
                items.map((payment) => (
                  <tr
                    key={payment._id || payment.transactionId}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <td className="px-4 py-4">
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {payment.transactionId}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        Ref: {payment.referenceId}
                      </p>
                    </td>

                    <td className="px-4 py-4 text-gray-700 dark:text-gray-300">
                      {payment.orderId}
                    </td>

                    <td className="px-4 py-4 font-semibold text-gray-900 dark:text-white">
                      {money(payment.amount, payment.currency)}
                    </td>

                    <td className="px-4 py-4 capitalize text-gray-700 dark:text-gray-300">
                      {payment.method}
                    </td>

                    <td className="px-4 py-4 text-gray-700 dark:text-gray-300">
                      {payment.provider}
                    </td>

                    <td className="px-4 py-4">
                      <StatusBadge status={payment.status} />
                    </td>

                    <td className="px-4 py-4 whitespace-nowrap text-gray-500">
                      {dateTime(payment.createdAt)}
                    </td>

                    <td className="px-4 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => void openDetails(payment)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                      >
                        <Eye size={15} />
                        Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-gray-200 px-4 py-4 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Showing{" "}
            {items.length ? (pagination.page - 1) * pagination.limit + 1 : 0}
            {"–"}
            {(pagination.page - 1) * pagination.limit + items.length}
            {" of "}
            {pagination.total} payments
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!pagination.hasPreviousPage || loading}
              onClick={() => updateFilter("page", filters.page - 1)}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:text-gray-200"
            >
              <ChevronLeft size={16} />
              Previous
            </button>

            <span className="px-2 text-sm text-gray-600 dark:text-gray-300">
              {pagination.page} / {pagination.totalPages || 1}
            </span>

            <button
              type="button"
              disabled={!pagination.hasNextPage || loading}
              onClick={() => updateFilter("page", filters.page + 1)}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:text-gray-200"
            >
              Next
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {(selected || detailsLoading || detailsError) && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
          <div className="my-8 w-full max-w-2xl rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-200 p-5 dark:border-gray-800">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  Payment details
                </h2>
                <p className="mt-1 text-xs text-gray-500">
                  Transaction information
                </p>
              </div>

              <button
                type="button"
                onClick={closeDetails}
                disabled={detailsLoading}
                className="rounded-lg p-2 hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-gray-800"
                aria-label="Close details"
              >
                <X size={19} />
              </button>
            </div>

            <div className="p-5">
              {detailsLoading ? (
                <div className="py-12 text-center">
                  <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600" />
                  <p className="mt-3 text-sm text-gray-500">
                    Loading payment details...
                  </p>
                </div>
              ) : detailsError ? (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
                  <AlertCircle size={18} />
                  {detailsError}
                </div>
              ) : selected ? (
                <div>
                  <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
                    <div>
                      <p className="text-xs text-gray-500">Payment amount</p>
                      <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                        {money(selected.amount, selected.currency)}
                      </p>
                    </div>
                    <StatusBadge status={selected.status} />
                  </div>

                  <div className="space-y-1">
                    <DetailRow
                      label="Transaction ID"
                      value={selected.transactionId}
                    />
                    <DetailRow
                      label="Reference ID"
                      value={selected.referenceId}
                    />
                    <DetailRow label="Order ID" value={selected.orderId} />
                    <DetailRow
                      label="Customer ID"
                      value={selected.customerId}
                    />
                    <DetailRow label="Method" value={selected.method} />
                    <DetailRow label="Provider" value={selected.provider} />
                    <DetailRow
                      label="Provider transaction ID"
                      value={selected.providerTransactionId}
                    />
                    <DetailRow label="Currency" value={selected.currency} />
                    <DetailRow
                      label="Created at"
                      value={dateTime(selected.createdAt)}
                    />
                    <DetailRow
                      label="Updated at"
                      value={dateTime(selected.updatedAt)}
                    />
                    <DetailRow
                      label="Paid at"
                      value={dateTime(selected.paidAt)}
                    />
                    <DetailRow
                      label="Expires at"
                      value={dateTime(selected.expiresAt)}
                    />
                    <DetailRow
                      label="Failure code"
                      value={selected.failureCode}
                    />
                    <DetailRow
                      label="Failure message"
                      value={selected.failureMessage}
                    />
                  </div>

                  {selected.metadata &&
                    Object.keys(selected.metadata).length > 0 && (
                      <div className="mt-5">
                        <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">
                          Metadata
                        </h3>
                        <pre className="overflow-x-auto rounded-lg bg-gray-50 p-4 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                          {JSON.stringify(selected.metadata, null, 2)}
                        </pre>
                      </div>
                    )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
