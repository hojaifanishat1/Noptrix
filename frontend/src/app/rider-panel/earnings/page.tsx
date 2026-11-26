"use client";

import { useCallback, useEffect, useState } from "react";
import apiClient from "@/services/api/client";

type EarningStatus = "PENDING" | "APPROVED" | "PAID" | "CANCELLED";
type EarningType = "DELIVERY" | "BONUS" | "INCENTIVE" | "ADJUSTMENT" | "PENALTY";

interface Earning {
  _id: string;
  orderId?: string;
  type: EarningType;
  amount: number;
  currency: string;
  status: EarningStatus;
  description?: string;
  earningDate: string;
  paidAt?: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

interface EarningsSummary {
  totalEarnings: number;
  pendingEarnings: number;
  approvedEarnings: number;
  paidEarnings: number;
  cancelledEarnings: number;
  currency: string;
}

function getError(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error
  ) {
    const response = (error as {
      response?: { data?: { message?: string } };
    }).response;

    if (response?.data?.message) return response.data.message;
  }

  return error instanceof Error ? error.message : "Request failed.";
}

function money(amount: number, currency: string) {
  return `${currency} ${Number(amount || 0).toFixed(2)}`;
}

const statusStyle: Record<EarningStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  APPROVED: "bg-blue-100 text-blue-800",
  PAID: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-red-100 text-red-800",
};

export default function RiderEarningsPage() {
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [summary, setSummary] = useState<EarningsSummary | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [listResponse, summaryResponse] = await Promise.all([
        apiClient.get("/rider-earnings/me", {
          params: {
            page,
            limit: 20,
            ...(status ? { status } : {}),
            ...(type ? { type } : {}),
          },
        }),
        apiClient.get("/rider-earnings/me/summary"),
      ]);

      const listData = listResponse.data.data;
      const summaryData = summaryResponse.data.data;

      setEarnings(listData.earnings ?? []);
      setPagination(listData.pagination ?? null);
      setSummary(summaryData ?? null);
    } catch (err) {
      setError(getError(err));
    } finally {
      setLoading(false);
    }
  }, [page, status, type]);

  useEffect(() => {
    void load();
  }, [load]);

  const changeStatus = (value: string) => {
    setStatus(value);
    setPage(1);
  };

  const changeType = (value: string) => {
    setType(value);
    setPage(1);
  };

  const currency = summary?.currency || earnings[0]?.currency || "BDT";

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Earnings</h1>
          <p className="mt-1 text-sm text-slate-500">
            View your delivery earnings and payment status.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </header>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Total Earnings",
            amount: summary?.totalEarnings,
          },
          {
            label: "Pending",
            amount: summary?.pendingEarnings,
          },
          {
            label: "Approved",
            amount: summary?.approvedEarnings,
          },
          {
            label: "Paid",
            amount: summary?.paidEarnings,
          },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-slate-200 bg-white p-5"
          >
            <p className="text-sm text-slate-500">{item.label}</p>
            <p className="mt-2 text-xl font-bold text-slate-900">
              {money(item.amount ?? 0, currency)}
            </p>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-slate-900">Earning History</h2>

          <div className="flex flex-wrap gap-2">
            <select
              value={status}
              onChange={(event) => changeStatus(event.target.value)}
              className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
            >
              <option value="">All statuses</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="PAID">Paid</option>
              <option value="CANCELLED">Cancelled</option>
            </select>

            <select
              value={type}
              onChange={(event) => changeType(event.target.value)}
              className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
            >
              <option value="">All types</option>
              <option value="DELIVERY">Delivery</option>
              <option value="BONUS">Bonus</option>
              <option value="INCENTIVE">Incentive</option>
              <option value="ADJUSTMENT">Adjustment</option>
              <option value="PENALTY">Penalty</option>
            </select>
          </div>
        </div>

        {loading ? (
          <p className="py-12 text-center text-sm text-slate-500">
            Loading earnings...
          </p>
        ) : earnings.length === 0 ? (
          <div className="py-12 text-center">
            <p className="font-medium text-slate-700">No earnings found</p>
            <p className="mt-1 text-sm text-slate-500">
              Your earnings will appear here when they are recorded.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Description</th>
                  <th className="p-3">Order</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {earnings.map((earning) => (
                  <tr key={earning._id}>
                    <td className="p-3 whitespace-nowrap">
                      {new Date(earning.earningDate).toLocaleDateString()}
                    </td>
                    <td className="p-3">{earning.type}</td>
                    <td className="p-3">
                      {earning.description || "—"}
                    </td>
                    <td className="p-3 font-mono text-xs">
                      {earning.orderId || "—"}
                    </td>
                    <td className="p-3 whitespace-nowrap font-semibold">
                      {money(earning.amount, earning.currency)}
                    </td>
                    <td className="p-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle[earning.status]}`}
                      >
                        {earning.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between border-t pt-4 text-sm">
          <span className="text-slate-500">
            {pagination
              ? `Page ${pagination.page} of ${Math.max(1, pagination.totalPages)} · ${pagination.total} records`
              : " "}
          </span>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={!pagination?.hasPreviousPage || loading}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="rounded-lg border px-3 py-2 disabled:opacity-40"
            >
              Previous
            </button>

            <button
              type="button"
              disabled={!pagination?.hasNextPage || loading}
              onClick={() => setPage((current) => current + 1)}
              className="rounded-lg border px-3 py-2 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
