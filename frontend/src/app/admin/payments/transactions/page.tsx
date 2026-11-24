"use client";

import { useCallback, useEffect, useState } from "react";
import {
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Receipt,
  Search,
  X,
} from "lucide-react";

import { transactionsAdminApi } from "@/services/api/transactions-admin.api";
import {
  TRANSACTION_STATUSES,
  TRANSACTION_TYPES,
  type AdminTransaction,
  type TransactionFilters,
} from "@/features/transactions/transaction.types";

const initialFilters: TransactionFilters = {
  page: 1,
  limit: 20,
  type: "",
  status: "",
  orderId: "",
  paymentId: "",
  provider: "",
  from: "",
  to: "",
};

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-gray-700 dark:bg-gray-800 dark:text-white";

const labelClass =
  "mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300";

function getErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (
      error as { response?: { data?: { message?: string } } }
    ).response;

    return response?.data?.message || "Unable to load transactions.";
  }

  return error instanceof Error ? error.message : "Unable to load transactions.";
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency: currency || "BDT",
      minimumFractionDigits: 2,
    }).format(Number(amount || 0));
  } catch {
    return `${currency || "BDT"} ${Number(amount || 0).toFixed(2)}`;
  }
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    created: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    pending: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    processing: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    success: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
    failed: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
    cancelled: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    refunded: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
    partially_refunded: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
    expired: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  };

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${
        styles[status] || styles.created
      }`}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}

function toIsoDate(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

export default function AdminTransactionsPage() {
  const [items, setItems] = useState<AdminTransaction[]>([]);
  const [filters, setFilters] = useState<TransactionFilters>(initialFilters);
  const [draft, setDraft] = useState<TransactionFilters>(initialFilters);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await transactionsAdminApi.list(filters);
      setItems(result.items);
      setPagination(result.pagination);
    } catch (err) {
      setItems([]);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

  const applyFilters = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setFilters({
      ...draft,
      page: 1,
      from: toIsoDate(draft.from || ""),
      to: toIsoDate(draft.to || ""),
    });
  };

  const resetFilters = () => {
    setDraft(initialFilters);
    setFilters(initialFilters);
  };

  const changePage = (page: number) => {
    setFilters((current) => ({ ...current, page }));
  };

  return (
    <main className="space-y-6 p-4 sm:p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Receipt className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Transactions
            </h1>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Search and review payment and refund transaction history.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadTransactions()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-800"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Matching transactions
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
            {pagination.pages ? `${pagination.page} / ${pagination.pages}` : "0 / 0"}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Records per page
          </p>
          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
            {pagination.limit}
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <form onSubmit={applyFilters} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <label className={labelClass}>Transaction type</label>
              <select
                value={draft.type || ""}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    type: event.target.value as TransactionFilters["type"],
                  }))
                }
                className={inputClass}
              >
                <option value="">All types</option>
                {TRANSACTION_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>Status</label>
              <select
                value={draft.status || ""}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    status: event.target.value as TransactionFilters["status"],
                  }))
                }
                className={inputClass}
              >
                <option value="">All statuses</option>
                {TRANSACTION_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>Provider</label>
              <input
                value={draft.provider || ""}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, provider: event.target.value }))
                }
                placeholder="e.g. sslcommerz"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Order ID</label>
              <input
                value={draft.orderId || ""}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, orderId: event.target.value }))
                }
                placeholder="24-character MongoDB ObjectId"
                className={inputClass}
              />
            </div>

            <div className="sm:col-span-2">
              <label className={labelClass}>Payment ID</label>
              <input
                value={draft.paymentId || ""}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, paymentId: event.target.value }))
                }
                placeholder="24-character MongoDB ObjectId"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>From</label>
              <input
                type="datetime-local"
                value={draft.from || ""}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, from: event.target.value }))
                }
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>To</label>
              <input
                type="datetime-local"
                value={draft.to || ""}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, to: event.target.value }))
                }
                className={inputClass}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <Search size={16} />
              Apply filters
            </button>
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              <X size={16} />
              Clear filters
            </button>
          </div>
        </form>
      </section>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
          <h2 className="font-semibold text-gray-900 dark:text-white">
            Transaction records
          </h2>
          <span className="text-xs text-gray-500">
            {items.length} shown
          </span>
        </div>

        {loading ? (
          <p className="p-10 text-center text-sm text-gray-500">
            Loading transactions...
          </p>
        ) : items.length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-500">
            No transactions found for the selected filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1050px] w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800/70 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3">Transaction</th>
                  <th className="px-4 py-3">Order ID</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Provider</th>
                  <th className="px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {items.map((item) => (
                  <tr key={item._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {item.transactionId}
                      </p>
                      <p className="mt-1 max-w-[220px] truncate text-xs text-gray-500">
                        Payment: {item.paymentId}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-300">
                      {item.orderId}
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-gray-700 dark:text-gray-300">
                      {item.type.replaceAll("_", " ")}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">
                      {formatMoney(item.amount, item.currency)}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                      {item.provider || "—"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-gray-300">
                      {formatDate(item.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-col gap-3 border-t border-gray-200 px-4 py-3 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-500">
            Page {pagination.page} of {pagination.pages || 1} · {pagination.total.toLocaleString()} total
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => changePage(Math.max(1, pagination.page - 1))}
              disabled={loading || pagination.page <= 1}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-40 dark:border-gray-700"
            >
              <ChevronLeft size={16} />
              Previous
            </button>
            <button
              type="button"
              onClick={() => changePage(pagination.page + 1)}
              disabled={loading || pagination.page >= pagination.pages}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-40 dark:border-gray-700"
            >
              Next
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
