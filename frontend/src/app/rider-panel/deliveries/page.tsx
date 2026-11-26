"use client";

import { useCallback, useEffect, useState } from "react";
import apiClient from "@/services/api/client";

type DeliveryStatus =
  | "pending"
  | "assigned"
  | "accepted"
  | "picked_up"
  | "in_transit"
  | "arriving"
  | "delivered"
  | "failed"
  | "cancelled"
  | "returned";

interface Delivery {
  _id: string;
  deliveryNumber: string;
  orderId: string;
  status: DeliveryStatus;
  recipientName: string;
  recipientPhone: string;
  address: string;
  city: string;
  deliveryFee: number;
  riderEarningAmount?: number;
  riderEarningCurrency?: string;
  currency: string;
  assignedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
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

function formatDate(value?: string): string {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not available";

  return date.toLocaleString();
}

function formatMoney(amount: number, currency: string): string {
  return `${currency || "BDT"} ${Number(amount || 0).toFixed(2)}`;
}

const statusStyles: Record<DeliveryStatus, string> = {
  pending: "bg-slate-100 text-slate-700",
  assigned: "bg-blue-100 text-blue-700",
  accepted: "bg-indigo-100 text-indigo-700",
  picked_up: "bg-violet-100 text-violet-700",
  in_transit: "bg-amber-100 text-amber-800",
  arriving: "bg-orange-100 text-orange-700",
  delivered: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
  cancelled: "bg-slate-200 text-slate-700",
  returned: "bg-rose-100 text-rose-700",
};

function statusLabel(status: DeliveryStatus): string {
  return status.replaceAll("_", " ").replace(/\b\w/g, (char) =>
    char.toUpperCase(),
  );
}

export default function RiderDeliveriesPage() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDeliveries = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await apiClient.get("/delivery/my-deliveries", {
        params: { page, limit: 20 },
      });

      setDeliveries(response.data.data ?? []);
      setPagination(response.data.pagination ?? null);
    } catch (err) {
      setError(getError(err));
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void loadDeliveries();
  }, [loadDeliveries]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            My Deliveries
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            View your currently assigned and active deliveries.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadDeliveries()}
          disabled={loading}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
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

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Active Deliveries</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {pagination?.total ?? deliveries.length}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Showing on this page</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {deliveries.length}
          </p>
        </div>
      </section>

      <section className="space-y-4">
        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white py-14 text-center text-sm text-slate-500">
            Loading deliveries...
          </div>
        ) : deliveries.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white py-14 text-center">
            <p className="font-semibold text-slate-800">
              No active deliveries
            </p>
            <p className="mt-1 text-sm text-slate-500">
              New assignments will appear here.
            </p>
          </div>
        ) : (
          deliveries.map((delivery) => (
            <article
              key={delivery._id}
              className="rounded-xl border border-slate-200 bg-white p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Delivery
                  </p>
                  <h2 className="mt-1 text-lg font-bold text-slate-900">
                    {delivery.deliveryNumber || delivery._id}
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Order ID: {delivery.orderId || "Not available"}
                  </p>
                </div>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    statusStyles[delivery.status] ??
                    "bg-slate-100 text-slate-700"
                  }`}
                >
                  {statusLabel(delivery.status)}
                </span>
              </div>

              <div className="my-4 border-t border-slate-100" />

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium text-slate-500">
                    Customer
                  </p>
                  <p className="mt-1 font-semibold text-slate-900">
                    {delivery.recipientName || "Not available"}
                  </p>
                  {delivery.recipientPhone ? (
                    <a
                      href={`tel:${delivery.recipientPhone}`}
                      className="mt-1 inline-block text-sm text-blue-600 hover:underline"
                    >
                      {delivery.recipientPhone}
                    </a>
                  ) : (
                    <p className="mt-1 text-sm text-slate-500">
                      Phone not available
                    </p>
                  )}
                </div>

                <div>
                  <p className="text-xs font-medium text-slate-500">
                    Delivery Address
                  </p>
                  <p className="mt-1 text-sm text-slate-800">
                    {delivery.address || "Address not available"}
                  </p>
                  {delivery.city && (
                    <p className="mt-1 text-sm text-slate-500">
                      {delivery.city}
                    </p>
                  )}
                </div>

                <div>
                  <p className="text-xs font-medium text-slate-500">
                    Your Delivery Earning
                  </p>
                  <p className="mt-1 font-semibold text-emerald-700">
                    {delivery.riderEarningAmount !== undefined
                      ? formatMoney(
                          delivery.riderEarningAmount,
                          delivery.riderEarningCurrency || delivery.currency,
                        )
                      : "Not available"}
                  </p>
                </div>

                <div className="sm:col-span-2">
                  <p className="text-xs font-medium text-slate-500">
                    Assigned
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    {formatDate(delivery.assignedAt || delivery.createdAt)}
                  </p>
                </div>
              </div>
            </article>
          ))
        )}
      </section>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">
            Page {pagination.page} of {pagination.totalPages}
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={loading || !pagination.hasPreviousPage}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>

            <button
              type="button"
              disabled={loading || !pagination.hasNextPage}
              onClick={() => setPage((current) => current + 1)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
