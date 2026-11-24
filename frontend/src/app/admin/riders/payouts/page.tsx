"use client";

import { useCallback, useEffect, useState } from "react";
import { riderPayoutsAdminApi } from "@/services/api/rider-payouts-admin.api";
import type {
  RiderPayout,
  RiderPayoutListResult,
  RiderPayoutStatus,
} from "@/features/rider-payouts/rider-payout.types";

const emptyResult: RiderPayoutListResult = {
  items: [],
  summary: [],
  pagination: {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  },
};

const statuses: RiderPayoutStatus[] = [
  "PENDING",
  "APPROVED",
  "PAID",
  "CANCELLED",
];

function money(amount: number, currency = "BDT") {
  try {
    return new Intl.NumberFormat("en-BD", {
      style: "currency",
      currency: currency || "BDT",
      maximumFractionDigits: 2,
    }).format(amount || 0);
  } catch {
    return `${currency || "BDT"} ${(amount || 0).toFixed(2)}`;
  }
}

function riderLabel(payout: RiderPayout) {
  if (typeof payout.riderId === "string") return payout.riderId;

  return (
    payout.riderId.riderCode ||
    payout.riderId.name ||
    payout.riderId.phone ||
    payout.riderId.email ||
    payout.riderId._id
  );
}

export default function RiderPayoutsPage() {
  const [result, setResult] = useState<RiderPayoutListResult>(emptyResult);
  const [status, setStatus] = useState<RiderPayoutStatus | "">("");
  const [riderId, setRiderId] = useState("");
  const [currency, setCurrency] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [updatingId, setUpdatingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadPayouts = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await riderPayoutsAdminApi.list({
        page,
        limit: 20,
        status,
        riderId,
        currency,
      });
      setResult(data);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to load rider payouts.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [page, status, riderId, currency]);

  useEffect(() => {
    void loadPayouts();
  }, [loadPayouts]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError("");
    setNotice("");

    try {
      const generated = await riderPayoutsAdminApi.generate(
        riderId.trim() || undefined,
      );

      setNotice(
        `Generation complete: ${generated.created} created, ${generated.skipped} skipped.`,
      );
      setPage(1);

      const data = await riderPayoutsAdminApi.list({
        page: 1,
        limit: 20,
        status,
        riderId,
        currency,
      });
      setResult(data);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to generate payouts.",
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleStatusUpdate = async (
    payout: RiderPayout,
    nextStatus: Exclude<RiderPayoutStatus, "PENDING">,
  ) => {
    let paymentReference: string | undefined;

    if (nextStatus === "PAID") {
      paymentReference = window.prompt(
        "Enter bank/mobile payment reference:",
      )?.trim();

      if (!paymentReference) return;
    } else {
      const confirmed = window.confirm(
        `Change payout status to ${nextStatus}?`,
      );
      if (!confirmed) return;
    }

    setUpdatingId(payout._id);
    setError("");
    setNotice("");

    try {
      await riderPayoutsAdminApi.updateStatus(payout._id, {
        status: nextStatus,
        paymentReference,
      });

      setNotice(`Payout updated to ${nextStatus}.`);
      await loadPayouts();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to update payout.",
      );
    } finally {
      setUpdatingId("");
    }
  };

  const summaryCount = (key: RiderPayoutStatus) =>
    result.summary.find((item) => item._id === key)?.count ?? 0;

  const summaryAmount = (key: RiderPayoutStatus) =>
    result.summary.find((item) => item._id === key)?.amount ?? 0;

  return (
    <main className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Rider Payouts</h1>
          <p className="mt-1 text-sm text-gray-500">
            Generate and manage payments for approved rider earnings.
          </p>
        </div>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {generating ? "Generating..." : "Generate Payouts"}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {notice && (
        <div className="rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-700">
          {notice}
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {statuses.map((item) => (
          <div key={item} className="rounded-xl border bg-white p-4 shadow-sm">
            <p className="text-sm text-gray-500">{item}</p>
            <p className="mt-1 text-2xl font-semibold">
              {summaryCount(item)}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {money(summaryAmount(item))}
            </p>
          </div>
        ))}
      </section>

      <section className="rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-semibold">Filters</h2>

        <div className="grid gap-3 md:grid-cols-4">
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as RiderPayoutStatus | "");
              setPage(1);
            }}
            className="rounded-lg border px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            {statuses.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <input
            value={riderId}
            onChange={(event) => {
              setRiderId(event.target.value);
              setPage(1);
            }}
            placeholder="Rider ID"
            className="rounded-lg border px-3 py-2 text-sm"
          />

          <input
            value={currency}
            onChange={(event) => {
              setCurrency(event.target.value.toUpperCase());
              setPage(1);
            }}
            placeholder="Currency (BDT)"
            maxLength={3}
            className="rounded-lg border px-3 py-2 text-sm"
          />

          <button
            type="button"
            onClick={() => void loadPayouts()}
            className="rounded-lg border px-4 py-2 text-sm font-medium"
          >
            Refresh
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b p-4">
          <h2 className="font-semibold">Payout Records</h2>
          <span className="text-sm text-gray-500">
            {result.pagination.total} records
          </span>
        </div>

        {loading ? (
          <p className="p-8 text-center text-sm text-gray-500">
            Loading rider payouts...
          </p>
        ) : result.items.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-500">
            No rider payout records found.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="p-3">Rider</th>
                  <th className="p-3">Earnings</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Created</th>
                  <th className="p-3">Payment Reference</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {result.items.map((payout) => (
                  <tr key={payout._id}>
                    <td className="p-3">
                      <div className="font-medium">{riderLabel(payout)}</div>
                      <div className="text-xs text-gray-500">
                        {payout._id}
                      </div>
                    </td>

                    <td className="p-3">{payout.earningIds.length}</td>

                    <td className="p-3 font-medium">
                      {money(payout.amount, payout.currency)}
                    </td>

                    <td className="p-3">
                      <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium">
                        {payout.status}
                      </span>
                    </td>

                    <td className="p-3">
                      {new Date(payout.createdAt).toLocaleDateString()}
                    </td>

                    <td className="p-3">
                      {payout.paymentReference || "—"}
                    </td>

                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        {payout.status === "PENDING" && (
                          <>
                            <button
                              type="button"
                              disabled={updatingId === payout._id}
                              onClick={() =>
                                void handleStatusUpdate(payout, "APPROVED")
                              }
                              className="rounded border px-2 py-1 text-xs disabled:opacity-50"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              disabled={updatingId === payout._id}
                              onClick={() =>
                                void handleStatusUpdate(payout, "CANCELLED")
                              }
                              className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          </>
                        )}

                        {payout.status === "APPROVED" && (
                          <>
                            <button
                              type="button"
                              disabled={updatingId === payout._id}
                              onClick={() =>
                                void handleStatusUpdate(payout, "PAID")
                              }
                              className="rounded bg-green-600 px-2 py-1 text-xs text-white disabled:opacity-50"
                            >
                              Mark Paid
                            </button>
                            <button
                              type="button"
                              disabled={updatingId === payout._id}
                              onClick={() =>
                                void handleStatusUpdate(payout, "CANCELLED")
                              }
                              className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          </>
                        )}

                        {updatingId === payout._id && (
                          <span className="text-xs text-gray-500">
                            Updating...
                          </span>
                        )}

                        {(payout.status === "PAID" ||
                          payout.status === "CANCELLED") && "—"}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between border-t p-4">
          <p className="text-sm text-gray-500">
            Page {result.pagination.page} of{" "}
            {Math.max(1, result.pagination.totalPages)}
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={!result.pagination.hasPreviousPage || loading}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={!result.pagination.hasNextPage || loading}
              onClick={() => setPage((current) => current + 1)}
              className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </section>

      <p className="text-xs text-gray-500">
        Marking a payout as paid records the payment reference and updates its
        linked approved earnings. It does not transfer money through a bank or
        mobile financial service.
      </p>
    </main>
  );
}
