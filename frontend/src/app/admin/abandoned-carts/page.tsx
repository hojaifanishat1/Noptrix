"use client";

import { useCallback, useEffect, useState } from "react";
import {
  RefreshCw,
  Eye,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ShoppingBag,
  X,
  Calendar,
  User,
  Package,
  AlertCircle,
  Mail,
  Clock,
  TrendingUp,
  CheckCircle2,
  ShoppingCart,
  Filter,
} from "lucide-react";

import { abandonedCartsAdminApi } from "@/services/api/abandoned-carts-admin.api";

import type {
  AbandonedCart,
  AbandonedCartAnalytics,
  AbandonedCartFilters,
  AbandonedCartStatus,
} from "@/features/abandoned-carts/abandoned-cart.types";

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-gray-700 dark:bg-gray-800 dark:text-white";

const labelClass =
  "mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300";

const statuses: AbandonedCartStatus[] = [
  "OPEN",
  "RECOVERED",
  "CONVERTED",
  "EXPIRED",
];

const emptyAnalytics: AbandonedCartAnalytics = {
  total: 0,
  open: 0,
  recovered: 0,
  converted: 0,
  expired: 0,
  conversionRate: 0,
  openTotals: [],
  conversionTotals: [],
};

function errorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (
      error as { response?: { data?: { message?: string } } }
    ).response;

    return response?.data?.message || "Something went wrong.";
  }

  return error instanceof Error ? error.message : "Something went wrong.";
}

function money(value: number, currency = "BDT"): string {
  const amount = Number(value || 0);

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

  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function formatStatus(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    OPEN: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    RECOVERED:
      "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    CONVERTED:
      "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
    EXPIRED: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
        styles[status] ||
        "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
      }`}
    >
      {formatStatus(status)}
    </span>
  );
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  iconClass,
}: {
  title: string;
  value: string | number;
  description: string;
  icon: typeof ShoppingBag;
  iconClass: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
            {value}
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {description}
          </p>
        </div>

        <div className={`rounded-lg p-3 ${iconClass}`}>
          <Icon size={21} />
        </div>
      </div>
    </div>
  );
}

function CartDetailsModal({
  cart,
  onClose,
}: {
  cart: AbandonedCart;
  onClose: () => void;
}) {
  const addresslessUser = cart.userId || "Unknown";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-xl dark:bg-gray-900">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Abandoned Cart Details
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              Cart ID: {cart.cartId}
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Close details"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-6 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <StatusBadge status={cart.status} />
            <span className="text-sm text-gray-500">
              {dateTime(cart.abandonedAt)}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800/60">
              <div className="mb-2 flex items-center gap-2 text-sm text-gray-500">
                <User size={16} />
                Customer ID
              </div>
              <p className="break-all text-sm font-medium text-gray-900 dark:text-white">
                {addresslessUser}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800/60">
              <div className="mb-2 flex items-center gap-2 text-sm text-gray-500">
                <ShoppingCart size={16} />
                Cart status at capture
              </div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {formatStatus(cart.cartStatusAtCapture)}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800/60">
              <div className="mb-2 flex items-center gap-2 text-sm text-gray-500">
                <Package size={16} />
                Total items
              </div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {cart.itemCount}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800/60">
              <div className="mb-2 flex items-center gap-2 text-sm text-gray-500">
                <Mail size={16} />
                Reminders sent
              </div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {cart.reminderCount}
              </p>
            </div>
          </div>

          <section>
            <h3 className="mb-3 font-semibold text-gray-900 dark:text-white">
              Cart Items ({cart.items.length})
            </h3>

            <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
              {cart.items.map((item, index) => (
                <div
                  key={`${item.productId || index}-${item.variantId || ""}`}
                  className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 p-4 last:border-0 dark:border-gray-800"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.imageUrl}
                        alt={item.productName || "Product"}
                        className="h-14 w-14 rounded-lg border border-gray-200 object-cover dark:border-gray-700"
                      />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
                        <Package size={22} className="text-gray-400" />
                      </div>
                    )}

                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                        {item.productName || "Unnamed product"}
                      </p>
                      {item.variantName && (
                        <p className="text-xs text-gray-500">
                          {item.variantName}
                        </p>
                      )}
                      {item.sku && (
                        <p className="text-xs text-gray-500">
                          SKU: {item.sku}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-gray-500">
                        Qty: {item.quantity}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {money(
                        item.unitPrice * item.quantity,
                        item.currency || cart.currency,
                      )}
                    </p>
                    <p className="text-xs text-gray-500">
                      {money(item.unitPrice, item.currency || cart.currency)}{" "}
                      each
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800/60">
            <h3 className="mb-3 font-semibold text-gray-900 dark:text-white">
              Cart Summary
            </h3>

            <div className="flex justify-between text-sm text-gray-600 dark:text-gray-300">
              <span>Items</span>
              <span>{cart.itemCount}</span>
            </div>

            {cart.couponCode && (
              <div className="mt-2 flex justify-between text-sm text-gray-600 dark:text-gray-300">
                <span>Coupon</span>
                <span>{cart.couponCode}</span>
              </div>
            )}

            <div className="mt-3 flex justify-between border-t border-gray-200 pt-3 dark:border-gray-700">
              <span className="font-semibold text-gray-900 dark:text-white">
                Subtotal
              </span>
              <span className="font-bold text-gray-900 dark:text-white">
                {money(cart.subtotal, cart.currency)}
              </span>
            </div>
          </section>

          <section>
            <h3 className="mb-3 font-semibold text-gray-900 dark:text-white">
              Timeline
            </h3>

            <div className="space-y-3">
              {[
                ["Abandoned", cart.abandonedAt],
                ["Email sent", cart.emailSentAt],
                ["Last reminder", cart.lastEmailAt],
                ["Recovered", cart.recoveredAt],
                ["Converted", cart.convertedAt],
                ["Expires", cart.expiresAt],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex flex-wrap justify-between gap-2 text-sm"
                >
                  <span className="text-gray-500">{label}</span>
                  <span className="text-gray-900 dark:text-gray-200">
                    {dateTime(value)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="border-t border-gray-200 p-4 text-right dark:border-gray-800">
          <button
            onClick={onClose}
            className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AbandonedCartsPage() {
  const [records, setRecords] = useState<AbandonedCart[]>([]);
  const [analytics, setAnalytics] =
    useState<AbandonedCartAnalytics>(emptyAnalytics);
  const [selectedCart, setSelectedCart] = useState<AbandonedCart | null>(null);

  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);

  const [status, setStatus] = useState("");
  const [userId, setUserId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);

    try {
      const result = await abandonedCartsAdminApi.analytics();
      setAnalytics(result);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  const loadRecords = useCallback(
    async (showRefresh = false) => {
      if (showRefresh) setRefreshing(true);
      else setLoading(true);

      setError("");

      try {
        const filters: AbandonedCartFilters = {
          page,
          limit,
          status: (status || undefined) as AbandonedCartStatus | undefined,
          userId: userId.trim() || undefined,
          from: from || undefined,
          to: to || undefined,
        };

        const result = await abandonedCartsAdminApi.list(filters);

        setRecords(result.records);
        setTotal(result.pagination.total);
        setPages(result.pagination.pages);
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [page, limit, status, userId, from, to],
  );

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  const clearFilters = () => {
    setStatus("");
    setUserId("");
    setFrom("");
    setTo("");
    setPage(1);
  };

  const hasFilters = Boolean(status || userId || from || to);

  const openTotals = analytics.openTotals || [];

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Abandoned Carts
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Monitor abandoned carts, recovery and conversion performance.
          </p>
        </div>

        <button
          onClick={() => {
            void loadRecords(true);
            void loadAnalytics();
          }}
          disabled={refreshing || loading}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          <RefreshCw
            size={16}
            className={refreshing ? "animate-spin" : ""}
          />
          Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">{error}</div>
          <button
            onClick={() => setError("")}
            className="shrink-0"
            aria-label="Dismiss error"
          >
            <X size={17} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          title="Total Abandoned"
          value={analyticsLoading ? "—" : analytics.total.toLocaleString()}
          description="All captured carts"
          icon={ShoppingBag}
          iconClass="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
        />

        <StatCard
          title="Open Carts"
          value={analyticsLoading ? "—" : analytics.open.toLocaleString()}
          description="Waiting for recovery"
          icon={ShoppingCart}
          iconClass="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        />

        <StatCard
          title="Recovered"
          value={analyticsLoading ? "—" : analytics.recovered.toLocaleString()}
          description="Successfully recovered"
          icon={RefreshCw}
          iconClass="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
        />

        <StatCard
          title="Converted"
          value={analyticsLoading ? "—" : analytics.converted.toLocaleString()}
          description="Converted into orders"
          icon={CheckCircle2}
          iconClass="bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
        />

        <StatCard
          title="Conversion Rate"
          value={
            analyticsLoading
              ? "—"
              : `${Number(analytics.conversionRate || 0).toFixed(2)}%`
          }
          description="Reported by backend"
          icon={TrendingUp}
          iconClass="bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300"
        />
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-4 flex items-center gap-2">
          <ShoppingCart
            size={19}
            className="text-gray-600 dark:text-gray-300"
          />
          <h2 className="font-semibold text-gray-900 dark:text-white">
            Open Cart Value
          </h2>
        </div>

        {analyticsLoading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-gray-500">
            <Loader2 size={17} className="animate-spin" />
            Loading analytics...
          </div>
        ) : openTotals.length === 0 ? (
          <p className="py-3 text-sm text-gray-500">
            No open cart value available.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {openTotals.map((item) => (
              <div
                key={item._id}
                className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800/60"
              >
                <p className="text-xs font-medium text-gray-500">
                  {item._id}
                </p>
                <p className="mt-2 text-xl font-bold text-gray-900 dark:text-white">
                  {money(item.subtotal || 0, item._id)}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {item.carts || 0} carts · {item.itemCount || 0} items
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-4 flex items-center gap-2">
          <Filter size={18} className="text-gray-500" />
          <h2 className="font-semibold text-gray-900 dark:text-white">
            Filters
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className={labelClass}>Cart Status</label>
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
              className={inputClass}
            >
              <option value="">All statuses</option>
              {statuses.map((item) => (
                <option key={item} value={item}>
                  {formatStatus(item)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Customer User ID</label>
            <input
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              placeholder="Enter user ID"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>From Date</label>
            <input
              type="date"
              value={from}
              onChange={(event) => {
                setFrom(event.target.value);
                setPage(1);
              }}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>To Date</label>
            <input
              type="date"
              value={to}
              onChange={(event) => {
                setTo(event.target.value);
                setPage(1);
              }}
              className={inputClass}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setPage(1);
              void loadRecords(true);
            }}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Apply Filters
          </button>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Clear Filters
            </button>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 p-5 dark:border-gray-800">
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white">
              Abandoned Cart Records
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              {total.toLocaleString()} records found
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Rows:</label>
            <select
              value={limit}
              onChange={(event) => {
                setLimit(Number(event.target.value));
                setPage(1);
              }}
              className="rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            >
              {[10, 20, 50, 100].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-gray-500">
            <Loader2 size={22} className="animate-spin" />
            Loading abandoned carts...
          </div>
        ) : records.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-4 text-center">
            <ShoppingBag size={35} className="text-gray-400" />
            <p className="mt-3 font-medium text-gray-900 dark:text-white">
              No abandoned carts found
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Try changing your filters or check again later.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[950px] text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800/70 dark:text-gray-400">
                  <tr>
                    <th className="px-5 py-4">Customer / Cart</th>
                    <th className="px-5 py-4">Items</th>
                    <th className="px-5 py-4">Subtotal</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Reminders</th>
                    <th className="px-5 py-4">Abandoned At</th>
                    <th className="px-5 py-4 text-right">Action</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {records.map((cart) => (
                    <tr
                      key={cart._id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/40"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-start gap-2">
                          <User
                            size={17}
                            className="mt-0.5 shrink-0 text-gray-400"
                          />
                          <div className="min-w-0">
                            <p className="max-w-[190px] truncate font-medium text-gray-900 dark:text-white">
                              {cart.userId}
                            </p>
                            <p className="mt-1 max-w-[190px] truncate text-xs text-gray-500">
                              {cart.cartId}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                          <Package size={15} />
                          {cart.itemCount}
                        </span>
                      </td>

                      <td className="px-5 py-4 font-semibold text-gray-900 dark:text-white">
                        {money(cart.subtotal, cart.currency)}
                      </td>

                      <td className="px-5 py-4">
                        <StatusBadge status={cart.status} />
                      </td>

                      <td className="px-5 py-4 text-gray-600 dark:text-gray-300">
                        {cart.reminderCount}
                      </td>

                      <td className="px-5 py-4 text-gray-600 dark:text-gray-300">
                        <div className="flex items-center gap-2">
                          <Calendar size={15} className="text-gray-400" />
                          <span>{dateTime(cart.abandonedAt)}</span>
                        </div>
                      </td>

                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => setSelectedCart(cart)}
                          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                        >
                          <Eye size={15} />
                          Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 px-5 py-4 dark:border-gray-800">
              <p className="text-sm text-gray-500">
                Page {page} of {Math.max(pages, 1)} · {total} total records
              </p>

              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((current) => current - 1)}
                  className="rounded-lg border border-gray-300 p-2 text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                  aria-label="Previous page"
                >
                  <ChevronLeft size={18} />
                </button>

                <button
                  disabled={page >= pages}
                  onClick={() => setPage((current) => current + 1)}
                  className="rounded-lg border border-gray-300 p-2 text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                  aria-label="Next page"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Clock size={14} />
        Cart records and analytics are loaded from the backend.
      </div>

      {selectedCart && (
        <CartDetailsModal
          cart={selectedCart}
          onClose={() => setSelectedCart(null)}
        />
      )}
    </div>
  );
}
