"use client";

import { useCallback, useEffect, useState } from "react";

import { sellerPayoutsAdminApi } from "@/services/api/seller-payouts-admin.api";
import type {
  SellerPayout,
  SellerPayoutFilters,
  SellerPayoutListResult,
  SellerPayoutStatus,
} from "@/features/seller-payouts/seller-payout.types";

const emptyResult: SellerPayoutListResult = {
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

const money = (amount: number, currency: string) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || "BDT",
  }).format(amount);

const getSellerName = (payout: SellerPayout) => {
  if (typeof payout.sellerId === "string") return payout.sellerId;
  return payout.sellerId.businessName || payout.sellerId.sellerCode || payout.sellerId._id;
};

export default function SellerPayoutsAdminPage() {
  const [result, setResult] = useState(emptyResult);
  const [status, setStatus] = useState<SellerPayoutStatus | "">("");
  const [sellerId, setSellerId] = useState("");
  const [currency, setCurrency] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadPayouts = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const filters: SellerPayoutFilters = {
        page,
        limit: 20,
        status,
        sellerId,
        currency,
      };
      setResult(await sellerPayoutsAdminApi.list(filters));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load seller payouts.",
      );
    } finally {
      setLoading(false);
    }
  }, [page, status, sellerId, currency]);

  useEffect(() => {
    void loadPayouts();
  }, [loadPayouts]);

  const generate = async () => {
    setGenerating(true);
    setError("");
    setNotice("");

    try {
      const response = await sellerPayoutsAdminApi.generate(sellerId || undefined);
      setNotice(
        `Generation complete: ${response.created} created, ${response.skipped} skipped.`,
      );
      setPage(1);
      await loadPayouts();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate payouts.",
      );
    } finally {
      setGenerating(false);
    }
  };

  const updateStatus = async (
    payout: SellerPayout,
    nextStatus: Exclude<SellerPayoutStatus, "PENDING">,
  ) => {
    let paymentReference: string | undefined;

    if (nextStatus === "PAID") {
      paymentReference = window.prompt("Enter payment reference:")?.trim();
      if (!paymentReference) return;
    }

    const confirmed = window.confirm(
      `Change payout ${payout.orderNumber} to ${nextStatus}?`,
    );
    if (!confirmed) return;

    setError("");
    setNotice("");

    try {
      await sellerPayoutsAdminApi.updateStatus(payout._id, {
        status: nextStatus,
        ...(paymentReference ? { paymentReference } : {}),
      });
      setNotice(`Payout ${payout.orderNumber} updated to ${nextStatus}.`);
      await loadPayouts();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update payout.",
      );
    }
  };

  return (
    <main className="space-y-6 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Seller Payouts</h1>
          <p className="mt-1 text-sm text-gray-500">
            Generate, review and record seller payout settlements.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void generate()}
          disabled={generating || loading}
          className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {generating ? "Generating..." : "Generate Payouts"}
        </button>
      </header>

      {error && (
        <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {notice && (
        <div role="status" className="rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-700">
          {notice}
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(["PENDING", "APPROVED", "PAID", "CANCELLED"] as const).map((item) => {
          const summary = result.summary.find((entry) => entry._id === item);
          return (
            <div key={item} className="rounded-xl border p-4">
              <p className="text-sm text-gray-500">{item}</p>
              <p className="mt-1 text-2xl font-semibold">
                {summary?.count ?? 0}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Net: {money(summary?.netAmount ?? 0, currency || "BDT")}
              </p>
            </div>
          );
        })}
      </section>

      <section className="grid gap-3 rounded-xl border p-4 md:grid-cols-4">
        <label className="space-y-1 text-sm">
          <span>Status</span>
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as SellerPayoutStatus | "");
              setPage(1);
            }}
            className="w-full rounded-lg border p-2"
          >
            <option value="">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="PAID">Paid</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </label>

        <label className="space-y-1 text-sm">
          <span>Seller ID</span>
          <input
            value={sellerId}
            onChange={(event) => {
              setSellerId(event.target.value);
              setPage(1);
            }}
            placeholder="24-character MongoDB ID"
            className="w-full rounded-lg border p-2"
          />
        </label>

        <label className="space-y-1 text-sm">
          <span>Currency</span>
          <input
            value={currency}
            onChange={(event) => {
              setCurrency(event.target.value.toUpperCase());
              setPage(1);
            }}
            maxLength={3}
            placeholder="BDT"
            className="w-full rounded-lg border p-2"
          />
        </label>

        <div className="flex items-end">
          <button
            type="button"
            onClick={() => void loadPayouts()}
            disabled={loading}
            className="w-full rounded-lg border px-4 py-2 text-sm disabled:opacity-50"
          >
            Apply / Refresh
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="font-semibold">Payout Records</h2>
          <span className="text-sm text-gray-500">
            {result.pagination.total} total
          </span>
        </div>

        {loading ? (
          <p className="p-8 text-center text-sm text-gray-500">Loading payouts...</p>
        ) : result.items.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-500">No seller payouts found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="p-3">Seller / Order</th>
                  <th className="p-3">Gross</th>
                  <th className="p-3">Commission</th>
                  <th className="p-3">Net payout</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Created</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {result.items.map((payout) => (
                  <tr key={payout._id}>
                    <td className="p-3">
                      <p className="font-medium">{getSellerName(payout)}</p>
                      <p className="text-xs text-gray-500">{payout.orderNumber}</p>
                      {payout.paymentReference && (
                        <p className="text-xs text-gray-500">
                          Ref: {payout.paymentReference}
                        </p>
                      )}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      {money(payout.grossAmount, payout.currency)}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      {money(payout.commissionAmount, payout.currency)}
                      <p className="text-xs text-gray-500">{payout.commissionRate}%</p>
                    </td>
                    <td className="p-3 whitespace-nowrap font-medium">
                      {money(payout.netAmount, payout.currency)}
                    </td>
                    <td className="p-3">
                      <span className="rounded-full border px-2 py-1 text-xs">
                        {payout.status}
                      </span>
                    </td>
                    <td className="p-3 whitespace-nowrap text-gray-500">
                      {new Date(payout.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        {payout.status === "PENDING" && (
                          <button
                            type="button"
                            onClick={() => void updateStatus(payout, "APPROVED")}
                            className="rounded border px-2 py-1 text-xs"
                          >
                            Approve
                          </button>
                        )}
                        {payout.status === "APPROVED" && (
                          <button
                            type="button"
                            onClick={() => void updateStatus(payout, "PAID")}
                            className="rounded bg-green-700 px-2 py-1 text-xs text-white"
                          >
                            Mark Paid
                          </button>
                        )}
                        {(payout.status === "PENDING" || payout.status === "APPROVED") && (
                          <button
                            type="button"
                            onClick={() => void updateStatus(payout, "CANCELLED")}
                            className="rounded border border-red-300 px-2 py-1 text-xs text-red-700"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <footer className="flex items-center justify-between gap-3">
        <p className="text-sm text-gray-500">
          Page {result.pagination.page} of {Math.max(1, result.pagination.totalPages)}
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
      </footer>

      <p className="text-xs text-gray-500">
        Marking a payout as paid records a manual settlement reference. It does not transfer money.
      </p>
    </main>
  );
}
