"use client";

import { useCallback, useEffect, useState } from "react";

import { codAdminApi } from "@/services/api/cod-admin.api";
import type {
  AdminCOD,
  CODReference,
  CODStatus,
} from "@/features/cod/cod.types";

const PAGE_SIZE = 20;

function referenceLabel(value: CODReference): string {
  if (!value) return "—";
  if (typeof value === "string") return value;

  const name = [value.firstName, value.lastName].filter(Boolean).join(" ");
  return name || value.name || value.email || value._id || "—";
}

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleString() : "—";
}

function formatAmount(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "BDT",
    }).format(amount);
  } catch {
    return `${amount.toLocaleString()} ${currency}`;
  }
}

function StatusBadge({ status }: { status: CODStatus }) {
  const styles: Record<CODStatus, string> = {
    PENDING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300",
    COLLECTED: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
    REMITTED: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
    REVERSED: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  };

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status]}`}>
      {status}
    </span>
  );
}

export default function CODAdminPage() {
  const [items, setItems] = useState<AdminCOD[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [status, setStatus] = useState<CODStatus | "">("");
  const [riderId, setRiderId] = useState("");
  const [orderId, setOrderId] = useState("");

  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await codAdminApi.list({
        page,
        limit: PAGE_SIZE,
        status,
        riderId,
        orderId,
      });

      setItems(result.items);
      setTotal(result.pagination.total);
      setTotalPages(result.pagination.totalPages);
    } catch (err) {
      console.error("Failed to load COD records:", err);
      setItems([]);
      setTotal(0);
      setTotalPages(0);
      setError("Failed to load COD records. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [page, status, riderId, orderId]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  function applyFilters() {
    setPage(1);
    setNotice("");
  }

  async function handleRemit(record: AdminCOD) {
    if (!window.confirm("Confirm that this COD amount has been remitted?")) {
      return;
    }

    setActionId(record._id);
    setError("");
    setNotice("");

    try {
      await codAdminApi.remit(record._id);
      setNotice("COD remittance recorded successfully.");
      await loadRecords();
    } catch (err) {
      console.error("COD remittance failed:", err);
      setError("Unable to remit this COD record.");
    } finally {
      setActionId("");
    }
  }

  async function handleReverse(record: AdminCOD) {
    const notes = window.prompt(
      "Enter the reason for reversing this COD record (minimum 3 characters):",
    );

    if (notes === null) return;

    if (notes.trim().length < 3) {
      setError("A reversal reason of at least 3 characters is required.");
      return;
    }

    setActionId(record._id);
    setError("");
    setNotice("");

    try {
      await codAdminApi.reverse(record._id, notes.trim());
      setNotice("COD record reversed successfully.");
      await loadRecords();
    } catch (err) {
      console.error("COD reversal failed:", err);
      setError("Unable to reverse this COD record.");
    } finally {
      setActionId("");
    }
  }

  return (
    <main className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            COD Management
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Monitor cash-on-delivery collections, remittances and reversals.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadRecords()}
          disabled={loading}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-800"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500">Matching records</p>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
            {total.toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500">Records on this page</p>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
            {items.length}
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-4 font-semibold text-gray-900 dark:text-white">
          Filters
        </h2>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
            Status
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as CODStatus | "")}
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-950"
            >
              <option value="">All statuses</option>
              <option value="PENDING">Pending</option>
              <option value="COLLECTED">Collected</option>
              <option value="REMITTED">Remitted</option>
              <option value="REVERSED">Reversed</option>
            </select>
          </label>

          <label className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
            Rider ID
            <input
              value={riderId}
              onChange={(event) => setRiderId(event.target.value)}
              placeholder="24-character Rider ObjectId"
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-950"
            />
          </label>

          <label className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
            Order ID
            <input
              value={orderId}
              onChange={(event) => setOrderId(event.target.value)}
              placeholder="24-character Order ObjectId"
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-950"
            />
          </label>

          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={applyFilters}
              disabled={loading}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={() => {
                setStatus("");
                setRiderId("");
                setOrderId("");
                setPage(1);
              }}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-700"
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
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300">
          {notice}
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-800">
          <h2 className="font-semibold text-gray-900 dark:text-white">
            COD records
          </h2>
          <span className="text-sm text-gray-500">
            Page {page} of {Math.max(totalPages, 1)}
          </span>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-gray-500">
            Loading COD records...
          </div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-500">
            No COD records found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-950 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3">COD ID</th>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Rider</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {items.map((record) => (
                  <tr key={record._id}>
                    <td className="px-4 py-4 font-mono text-xs text-gray-600 dark:text-gray-300">
                      {record._id}
                    </td>
                    <td className="px-4 py-4 text-gray-700 dark:text-gray-300">
                      {referenceLabel(record.orderId)}
                    </td>
                    <td className="px-4 py-4 text-gray-700 dark:text-gray-300">
                      {referenceLabel(record.riderId)}
                    </td>
                    <td className="px-4 py-4 font-medium text-gray-900 dark:text-white">
                      {formatAmount(record.amount, record.currency)}
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status={record.status} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-gray-600 dark:text-gray-300">
                      {formatDate(record.createdAt)}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        {record.status === "COLLECTED" && (
                          <button
                            type="button"
                            onClick={() => void handleRemit(record)}
                            disabled={!!actionId}
                            className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                          >
                            {actionId === record._id ? "Processing..." : "Remit"}
                          </button>
                        )}
                        {(record.status === "PENDING" || record.status === "COLLECTED") && (
                          <button
                            type="button"
                            onClick={() => void handleReverse(record)}
                            disabled={!!actionId}
                            className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:hover:bg-red-950"
                          >
                            Reverse
                          </button>
                        )}
                        <details className="relative">
                          <summary className="cursor-pointer px-2 py-1.5 text-xs font-medium text-blue-600">
                            Details
                          </summary>
                          <div className="absolute right-0 z-10 mt-2 w-72 rounded-lg border border-gray-200 bg-white p-3 shadow-xl dark:border-gray-700 dark:bg-gray-900">
                            <p className="text-xs text-gray-500">Notes</p>
                            <p className="mb-3 break-words text-sm text-gray-900 dark:text-white">
                              {record.notes || "No notes"}
                            </p>
                            <p className="text-xs text-gray-500">Collected</p>
                            <p className="mb-2 text-sm text-gray-900 dark:text-white">
                              {formatDate(record.collectedAt)}
                            </p>
                            <p className="text-xs text-gray-500">Remitted</p>
                            <p className="mb-2 text-sm text-gray-900 dark:text-white">
                              {formatDate(record.remittedAt)}
                            </p>
                            <p className="text-xs text-gray-500">Reversed</p>
                            <p className="text-sm text-gray-900 dark:text-white">
                              {formatDate(record.reversedAt)}
                            </p>
                          </div>
                        </details>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-gray-200 p-4 dark:border-gray-800">
          <p className="text-sm text-gray-500">
            {total.toLocaleString()} total records
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
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
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
