"use client";

import { useCallback, useEffect, useState } from "react";
import apiClient from "@/services/api/client";

type TrackingStatus =
  | "PENDING"
  | "ASSIGNED"
  | "PICKED_UP"
  | "IN_TRANSIT"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "FAILED"
  | "CANCELLED";

interface OrderItem {
  _id?: string;
  productName: string;
  quantity: number;
}

interface ShippingAddress {
  fullName?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

interface RiderOrder {
  _id: string;
  orderNumber: string;
  status: string;
  fulfillmentStatus?: string;
  shippingAddress?: ShippingAddress;
  items?: OrderItem[];
  createdAt?: string;
  deliveredAt?: string;
}

interface TrackingRecord {
  _id: string;
  orderId: RiderOrder | string;
  status: TrackingStatus;
  currentAddress?: string;
  lastLocationAt?: string;
  estimatedDeliveryAt?: string;
  deliveredAt?: string;
  failureReason?: string;
  createdAt?: string;
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

  return Number.isNaN(date.getTime())
    ? "Not available"
    : date.toLocaleString();
}

function label(value?: string): string {
  if (!value) return "Not available";

  return value.replaceAll("_", " ").replace(/\b\w/g, (char) =>
    char.toUpperCase(),
  );
}

const trackingStyles: Record<TrackingStatus, string> = {
  PENDING: "bg-slate-100 text-slate-700",
  ASSIGNED: "bg-blue-100 text-blue-700",
  PICKED_UP: "bg-indigo-100 text-indigo-700",
  IN_TRANSIT: "bg-amber-100 text-amber-800",
  OUT_FOR_DELIVERY: "bg-orange-100 text-orange-700",
  DELIVERED: "bg-emerald-100 text-emerald-700",
  FAILED: "bg-red-100 text-red-700",
  CANCELLED: "bg-slate-200 text-slate-700",
};

export default function RiderOrdersPage() {
  const [records, setRecords] = useState<TrackingRecord[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await apiClient.get("/tracking/me", {
        params: { page, limit: 20 },
      });

      const data = response.data.data;

      setRecords(data?.trackings ?? []);
      setPagination(data?.pagination ?? null);
    } catch (err) {
      setError(getError(err));
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Orders</h1>
          <p className="mt-1 text-sm text-slate-500">
            View orders assigned to you and their delivery tracking details.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadOrders()}
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
          <p className="text-sm text-slate-500">Assigned Orders</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {pagination?.total ?? records.length}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Showing on this page</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {records.length}
          </p>
        </div>
      </section>

      <section className="space-y-4">
        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white py-14 text-center text-sm text-slate-500">
            Loading assigned orders...
          </div>
        ) : records.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white py-14 text-center">
            <p className="font-semibold text-slate-800">
              No assigned orders found
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Orders assigned to you will appear here.
            </p>
          </div>
        ) : (
          records.map((record) => {
            const order =
              typeof record.orderId === "object"
                ? record.orderId
                : null;

            const address = order?.shippingAddress;

            const addressText = [
              address?.addressLine1,
              address?.addressLine2,
              address?.city,
              address?.state,
              address?.postalCode,
              address?.country,
            ]
              .filter(Boolean)
              .join(", ");

            return (
              <article
                key={record._id}
                className="rounded-xl border border-slate-200 bg-white p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Order
                    </p>
                    <h2 className="mt-1 text-lg font-bold text-slate-900">
                      {order?.orderNumber || "Order details unavailable"}
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                      {order?._id || record.orderId}
                    </p>
                  </div>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      trackingStyles[record.status] ??
                      "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {label(record.status)}
                  </span>
                </div>

                <div className="my-4 border-t border-slate-100" />

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium text-slate-500">
                      Order Status
                    </p>
                    <p className="mt-1 font-medium text-slate-900">
                      {label(order?.status)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-slate-500">
                      Fulfillment
                    </p>
                    <p className="mt-1 font-medium text-slate-900">
                      {label(order?.fulfillmentStatus)}
                    </p>
                  </div>

                  <div className="sm:col-span-2">
                    <p className="text-xs font-medium text-slate-500">
                      Customer
                    </p>
                    <p className="mt-1 font-medium text-slate-900">
                      {address?.fullName || "Not available"}
                    </p>

                    {address?.phone && (
                      <a
                        href={`tel:${address.phone}`}
                        className="mt-1 inline-block text-sm text-blue-600 hover:underline"
                      >
                        {address.phone}
                      </a>
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <p className="text-xs font-medium text-slate-500">
                      Delivery Address
                    </p>
                    <p className="mt-1 text-sm text-slate-800">
                      {addressText || record.currentAddress || "Not available"}
                    </p>
                  </div>

                  <div className="sm:col-span-2">
                    <p className="text-xs font-medium text-slate-500">
                      Order Items
                    </p>

                    {order?.items?.length ? (
                      <ul className="mt-2 space-y-2">
                        {order.items.map((item, index) => (
                          <li
                            key={item._id || `${item.productName}-${index}`}
                            className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm"
                          >
                            <span className="text-slate-800">
                              {item.productName}
                            </span>
                            <span className="shrink-0 font-medium text-slate-600">
                              Qty: {item.quantity}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-sm text-slate-500">
                        Order items unavailable
                      </p>
                    )}
                  </div>

                  <div>
                    <p className="text-xs font-medium text-slate-500">
                      Order Date
                    </p>
                    <p className="mt-1 text-sm text-slate-700">
                      {formatDate(order?.createdAt || record.createdAt)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-slate-500">
                      Last Location Update
                    </p>
                    <p className="mt-1 text-sm text-slate-700">
                      {formatDate(record.lastLocationAt)}
                    </p>
                  </div>

                  {record.failureReason && (
                    <div className="sm:col-span-2 rounded-lg bg-red-50 p-3">
                      <p className="text-xs font-semibold text-red-700">
                        Delivery Issue
                      </p>
                      <p className="mt-1 text-sm text-red-700">
                        {record.failureReason}
                      </p>
                    </div>
                  )}
                </div>
              </article>
            );
          })
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
