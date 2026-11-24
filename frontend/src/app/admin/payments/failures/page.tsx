"use client";

import { useCallback, useEffect, useState } from "react";

import { paymentsAdminApi } from "@/services/api/payments-admin.api";
import type { AdminPayment } from "@/features/payments/payment.types";

const PAGE_SIZE = 20;

function toIsoDate(value: string, endOfDay = false) {
  if (!value) return undefined;

  const date = new Date(
    `${value}T${endOfDay ? "23:59:59.999" : "00:00:00"}`,
  );

  return date.toISOString();
}

function formatDate(value: string) {
  if (!value) return "—";

  return new Date(value).toLocaleString();
}

function formatAmount(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
    }).format(amount);
  } catch {
    return `${amount.toLocaleString()} ${currency}`;
  }
}

export default function PaymentFailuresPage() {
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);

  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadPayments = useCallback(async () => {
    setLoading(true);
    setError("");
    setNotice("");

    try {
      const result = await paymentsAdminApi.list({
        page,
        limit: PAGE_SIZE,
        sort: "newest",
        status: "failed",
        search: search.trim() || undefined,
        from: toIsoDate(from),
        to: toIsoDate(to, true),
      });

      setPayments(result.items);
      setTotal(result.pagination.total);
      setTotalPages(result.pagination.totalPages);
    } catch (err) {
      console.error("Failed to load failed payments:", err);
      setPayments([]);
      setTotal(0);
      setTotalPages(0);
      setError("Failed to load payment failures. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [page, search, from, to]);

  useEffect(() => {
    void loadPayments();
  }, [loadPayments]);

  function applyFilters() {
    setPage(1);
    setNotice("Filters applied.");
    void loadPayments();
  }

  function clearFilters() {
    setSearch("");
    setFrom("");
    setTo("");
    setPage(1);
  }

  return (
    <main className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Payment Failures
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Review failed payments and investigate their failure reasons.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadPayments()}
          disabled={loading}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-800"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Failed payments
          </p>
          <p className="mt-2 text-3xl font-bold text-red-600">
            {total.toLocaleString()}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Records on this page
          </p>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
            {payments.length}
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-4 font-semibold text-gray-900 dark:text-white">
          Search and filters
        </h2>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") applyFilters();
            }}
            placeholder="Transaction, order or provider reference"
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
          />

          <label className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
            From
            <input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-950"
            />
          </label>

          <label className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
            To
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(event) => setTo(event.target.value)}
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-950"
            />
          </label>

          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={applyFilters}
              disabled={loading || (!!from && !!to && from > to)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Apply
            </button>

            <button
              type="button"
              onClick={clearFilters}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              Clear
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}

      {notice && (
        <p className="text-sm text-gray-500 dark:text-gray-400">{notice}</p>
      )}

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-800">
          <h2 className="font-semibold text-gray-900 dark:text-white">
            Failed payment records
          </h2>
          <span className="text-sm text-gray-500">
            Page {page} of {Math.max(totalPages, 1)}
          </span>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-gray-500">
            Loading failed payments...
          </div>
        ) : payments.length === 0 ? (
          <div className="p-10 text-center">
            <p className="font-medium text-gray-900 dark:text-white">
              No failed payments found
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Try changing your search or date filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-950 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3">Transaction</th>
                  <th className="px-4 py-3">Order ID</th>
                  <th className="px-4 py-3">Method / Provider</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Failure reason</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Details</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {payments.map((payment) => (
                  <tr key={payment._id}>
                    <td className="px-4 py-4">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {payment.transactionId}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {payment.providerTransactionId || payment.referenceId || "—"}
                      </p>
                    </td>

                    <td className="px-4 py-4 font-mono text-xs text-gray-600 dark:text-gray-300">
                      {payment.orderId || "—"}
                    </td>

                    <td className="px-4 py-4">
                      <p className="capitalize text-gray-900 dark:text-white">
                        {payment.method}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {payment.provider || "—"}
                      </p>
                    </td>

                    <td className="px-4 py-4 font-medium text-gray-900 dark:text-white">
                      {formatAmount(payment.amount, payment.currency)}
                    </td>

                    <td className="max-w-xs px-4 py-4">
                      <span className="inline-flex rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700 dark:bg-red-950 dark:text-red-300">
                        Failed
                      </span>
                      <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                        {payment.failureCode || payment.failureMessage || "No failure reason provided"}
                      </p>
                    </td>

                    <td className="whitespace-nowrap px-4 py-4 text-gray-600 dark:text-gray-300">
                      {formatDate(payment.createdAt)}
                    </td>

                    <td className="px-4 py-4">
                      <details className="relative">
                        <summary className="cursor-pointer font-medium text-blue-600 hover:text-blue-700">
                          View
                        </summary>
                        <div className="absolute right-0 z-10 mt-2 w-80 rounded-lg border border-gray-200 bg-white p-4 shadow-xl dark:border-gray-700 dark:bg-gray-900">
                          <p className="mb-2 font-semibold text-gray-900 dark:text-white">
                            Failure details
                          </p>
                          <p className="text-xs text-gray-500">Failure code</p>
                          <p className="mb-3 break-words text-sm text-gray-900 dark:text-white">
                            {payment.failureCode || "Not provided"}
                          </p>
                          <p className="text-xs text-gray-500">Failure message</p>
                          <p className="mb-3 break-words text-sm text-gray-900 dark:text-white">
                            {payment.failureMessage || "No failure message provided"}
                          </p>
                          <p className="text-xs text-gray-500">Payment ID</p>
                          <p className="break-all text-xs text-gray-900 dark:text-white">
                            {payment._id}
                          </p>
                        </div>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-gray-200 p-4 dark:border-gray-800">
          <p className="text-sm text-gray-500">
            {total.toLocaleString()} total failed payments
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={loading || page <= 1}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-40 dark:border-gray-700"
            >
              Previous
            </button>

            <button
              type="button"
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
              disabled={loading || page >= totalPages}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-40 dark:border-gray-700"
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
