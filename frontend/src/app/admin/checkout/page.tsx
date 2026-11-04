"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  Eye,
  Hash,
  Loader2,
  Package,
  RefreshCw,
  Search,
  ShoppingCart,
  TrendingUp,
  User,
  X,
} from "lucide-react";

import { checkoutAdminApi } from "@/services/api/checkout-admin.api";

import {
  checkoutPaymentStatuses,
  checkoutStatuses,
  type AdminCheckout,
  type CheckoutAnalytics,
  type CheckoutFilters,
  type CheckoutPaymentStatus,
  type CheckoutStatus,
} from "@/features/checkout/checkout.types";

const initialFilters: CheckoutFilters = {
  page: 1,
  limit: 20,
  sort: "newest",
  status: "",
  paymentStatus: "",
  search: "",
  from: "",
  to: "",
};

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-white";

const labelClass =
  "mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-400";

function errorMessage(error: unknown): string {
  const value = error as {
    response?: { data?: { message?: string } };
    message?: string;
  };

  return (
    value?.response?.data?.message ||
    value?.message ||
    "Something went wrong. Please try again."
  );
}

function formatStatus(value?: string): string {
  if (!value) return "—";

  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function money(amount?: number, currency = "BDT"): string {
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency: currency || "BDT",
      maximumFractionDigits: 2,
    }).format(amount ?? 0);
  } catch {
    return `${currency} ${(amount ?? 0).toFixed(2)}`;
  }
}

function dateTime(value?: string | Date | null): string {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString();
}

function addressText(address?: AdminCheckout["shippingAddress"]): string {
  if (!address) return "—";

  return [
    address.addressLine1,
    address.addressLine2,
    address.city,
    address.state,
    address.postalCode,
    address.country,
  ]
    .filter(Boolean)
    .join(", ");
}

function getUser(userId: AdminCheckout["userId"]) {
  if (!userId || typeof userId === "string") {
    return {
      id: typeof userId === "string" ? userId : "—",
      name: "Customer",
      email: "—",
      phone: "—",
      status: "—",
    };
  }

  return {
    id: userId._id || "—",
    name: userId.name || "Customer",
    email: userId.email || "—",
    phone: userId.phone || "—",
    status: userId.status || "—",
  };
}

function StatusBadge({ status }: { status?: string }) {
  const value = status?.toUpperCase() || "";

  let color =
    "border-gray-200 bg-gray-100 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300";

  if (["COMPLETED", "PAID", "AUTHORIZED"].includes(value)) {
    color =
      "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300";
  } else if (["PENDING", "PROCESSING"].includes(value)) {
    color =
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300";
  } else if (["FAILED", "CANCELLED", "EXPIRED"].includes(value)) {
    color =
      "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300";
  } else if (value === "REFUNDED") {
    color =
      "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-900 dark:bg-purple-950/40 dark:text-purple-300";
  }

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${color}`}
    >
      {formatStatus(status)}
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
    <div className="flex flex-col gap-1 border-b border-gray-100 py-2 last:border-0 dark:border-gray-800 sm:flex-row sm:items-start sm:justify-between">
      <span className="text-xs text-gray-500 dark:text-gray-400">
        {label}
      </span>
      <span className="break-all text-right text-sm font-medium text-gray-900 dark:text-gray-100">
        {value === undefined || value === null || value === "" ? "—" : value}
      </span>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color = "blue",
  description,
}: {
  label: string;
  value: string | number;
  icon: typeof ShoppingCart;
  color?: "blue" | "amber" | "green" | "red" | "purple";
  description?: string;
}) {
  const iconColors = {
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400",
    amber:
      "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400",
    green:
      "bg-green-50 text-green-600 dark:bg-green-950/40 dark:text-green-400",
    red: "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400",
    purple:
      "bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400",
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        <div className={`rounded-lg p-2 ${iconColors[color]}`}>
          <Icon size={19} />
        </div>
      </div>
      <p className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">
        {value}
      </p>
      {description && (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {description}
        </p>
      )}
    </div>
  );
}

export default function AdminCheckoutPage() {
  const [items, setItems] = useState<AdminCheckout[]>([]);
  const [analytics, setAnalytics] = useState<CheckoutAnalytics | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  });

  const [filters, setFilters] = useState<CheckoutFilters>(initialFilters);
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [error, setError] = useState("");

  const [selected, setSelected] = useState<AdminCheckout | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState("");

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);

    try {
      const result = await checkoutAdminApi.analytics();
      setAnalytics(result);
    } catch {
      setAnalytics(null);
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  const loadCheckouts = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await checkoutAdminApi.list(filters);
      setItems(result.items);
      setPagination(result.pagination);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void loadCheckouts();
  }, [loadCheckouts]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  const updateFilter = <K extends keyof CheckoutFilters>(
    key: K,
    value: CheckoutFilters[K],
  ) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
      page: key === "page" ? (value as number) : 1,
    }));
  };

  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFilters((current) => ({
      ...current,
      search: searchInput.trim(),
      page: 1,
    }));
  };

  const resetFilters = () => {
    setSearchInput("");
    setFilters(initialFilters);
  };

  const refreshAll = () => {
    void loadCheckouts();
    void loadAnalytics();
  };

  const openDetails = async (checkout: AdminCheckout) => {
    setSelected(null);
    setDetailsError("");
    setDetailsLoading(true);

    try {
      const result = await checkoutAdminApi.get(checkout._id);
      setSelected(result);
    } catch (err) {
      setDetailsError(errorMessage(err));
    } finally {
      setDetailsLoading(false);
    }
  };

  const closeDetails = () => {
    if (detailsLoading) return;
    setSelected(null);
    setDetailsError("");
  };

  const currency = selected?.totals?.currency || "BDT";
  const customer = selected ? getUser(selected.userId) : null;

  const matchingCount = pagination.total.toLocaleString();

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Checkout Management
            </h1>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Monitor customer checkouts, payment progress and checkout history.
          </p>
        </div>

        <button
          type="button"
          onClick={refreshAll}
          disabled={loading || analyticsLoading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          <RefreshCw
            size={16}
            className={loading || analyticsLoading ? "animate-spin" : ""}
          />
          Refresh
        </button>
      </div>

      {/* Analytics */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 dark:text-white">
            Checkout overview
          </h2>
          {analyticsLoading && (
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total checkouts"
            value={analytics?.total ?? "—"}
            icon={ShoppingCart}
            color="blue"
            description="All recorded checkouts"
          />
          <StatCard
            label="Pending"
            value={analytics?.pending ?? "—"}
            icon={Clock}
            color="amber"
          />
          <StatCard
            label="Processing"
            value={analytics?.processing ?? "—"}
            icon={Activity}
            color="purple"
          />
          <StatCard
            label="Completed"
            value={analytics?.completed ?? "—"}
            icon={CheckCircle2}
            color="green"
          />
          <StatCard
            label="Failed"
            value={analytics?.failed ?? "—"}
            icon={AlertCircle}
            color="red"
          />
          <StatCard
            label="Expired"
            value={analytics?.expired ?? "—"}
            icon={Calendar}
            color="amber"
          />
          <StatCard
            label="Paid payments"
            value={analytics?.paid ?? "—"}
            icon={CreditCard}
            color="green"
          />
          <StatCard
            label="Completion rate"
            value={
              analytics ? `${analytics.completionRate.toFixed(2)}%` : "—"
            }
            icon={TrendingUp}
            color="blue"
          />
        </div>
      </section>

      {/* Payment analytics and currency totals */}
      {analytics && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <h2 className="mb-4 font-semibold text-gray-900 dark:text-white">
              Payment summary
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
                <p className="text-xs text-gray-500">Pending</p>
                <p className="mt-1 text-xl font-bold text-gray-900 dark:text-white">
                  {analytics.paymentPending}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
                <p className="text-xs text-gray-500">Paid</p>
                <p className="mt-1 text-xl font-bold text-green-600">
                  {analytics.paid}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
                <p className="text-xs text-gray-500">Failed</p>
                <p className="mt-1 text-xl font-bold text-red-600">
                  {analytics.paymentFailed}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
                <p className="text-xs text-gray-500">Refunded</p>
                <p className="mt-1 text-xl font-bold text-purple-600">
                  {analytics.refunded}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <h2 className="mb-4 font-semibold text-gray-900 dark:text-white">
              Currency totals
            </h2>

            {analytics.currencyTotals.length === 0 ? (
              <p className="text-sm text-gray-500">No currency data available.</p>
            ) : (
              <div className="space-y-3">
                {analytics.currencyTotals.map((entry) => (
                  <div
                    key={entry._id || "unknown"}
                    className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3 last:border-0 last:pb-0 dark:border-gray-800"
                  >
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {entry._id || "Unknown currency"}
                      </p>
                      <p className="text-xs text-gray-500">
                        {entry.count} checkouts · Average{" "}
                        {money(entry.averageAmount, entry._id)}
                      </p>
                    </div>
                    <p className="font-bold text-blue-600">
                      {money(entry.totalAmount, entry._id)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Filters */}
      <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <form
          onSubmit={submitSearch}
          className="flex flex-col gap-2 sm:flex-row"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search customer, phone, product, coupon or ID..."
              className={`${inputClass} pl-9`}
            />
          </div>

          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Search size={16} />
            Search
          </button>
        </form>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <div>
            <label className={labelClass}>Checkout status</label>
            <select
              value={filters.status}
              onChange={(event) =>
                updateFilter(
                  "status",
                  event.target.value as CheckoutStatus | "",
                )
              }
              className={inputClass}
            >
              <option value="">All statuses</option>
              {checkoutStatuses.map((status) => (
                <option key={status} value={status}>
                  {formatStatus(status)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Payment status</label>
            <select
              value={filters.paymentStatus}
              onChange={(event) =>
                updateFilter(
                  "paymentStatus",
                  event.target.value as CheckoutPaymentStatus | "",
                )
              }
              className={inputClass}
            >
              <option value="">All payment statuses</option>
              {checkoutPaymentStatuses.map((status) => (
                <option key={status} value={status}>
                  {formatStatus(status)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Sort by</label>
            <select
              value={filters.sort}
              onChange={(event) =>
                updateFilter(
                  "sort",
                  event.target.value as "newest" | "oldest",
                )
              }
              className={inputClass}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>From date</label>
            <input
              type="date"
              value={filters.from}
              max={filters.to || undefined}
              onChange={(event) => updateFilter("from", event.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>To date</label>
            <input
              type="date"
              value={filters.to}
              min={filters.from || undefined}
              onChange={(event) => updateFilter("to", event.target.value)}
              className={inputClass}
            />
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
              {[10, 20, 50, 100].map((limit) => (
                <option key={limit} value={limit}>
                  {limit}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {pagination.total
              ? `Showing ${
                  (pagination.page - 1) * pagination.limit + 1
                }–${Math.min(
                  pagination.page * pagination.limit,
                  pagination.total,
                )} of ${matchingCount} checkouts`
              : "No matching checkouts"}
          </p>

          <button
            type="button"
            onClick={resetFilters}
            className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            Reset filters
          </button>
        </div>
      </section>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <div className="flex-1">{error}</div>
          <button
            type="button"
            onClick={() => void loadCheckouts()}
            className="font-semibold underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Checkout table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              <tr>
                <th className="px-4 py-4">Checkout</th>
                <th className="px-4 py-4">Customer</th>
                <th className="px-4 py-4">Items</th>
                <th className="px-4 py-4">Total</th>
                <th className="px-4 py-4">Payment</th>
                <th className="px-4 py-4">Checkout status</th>
                <th className="px-4 py-4">Expires</th>
                <th className="px-4 py-4">Created</th>
                <th className="px-4 py-4 text-right">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center">
                    <Loader2 className="mx-auto h-7 w-7 animate-spin text-blue-600" />
                    <p className="mt-2 text-sm text-gray-500">
                      Loading checkouts...
                    </p>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center">
                    <ShoppingCart className="mx-auto h-10 w-10 text-gray-300" />
                    <p className="mt-3 font-medium text-gray-700 dark:text-gray-200">
                      No checkouts found
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Try changing your search or filters.
                    </p>
                  </td>
                </tr>
              ) : (
                items.map((checkout) => {
                  const user = getUser(checkout.userId);

                  return (
                    <tr
                      key={checkout._id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    >
                      <td className="px-4 py-4">
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {checkout._id.slice(-10).toUpperCase()}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {checkout._id}
                        </p>
                      </td>

                      <td className="px-4 py-4">
                        <p className="font-medium text-gray-900 dark:text-white">
                          {user.name}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {user.phone}
                        </p>
                      </td>

                      <td className="px-4 py-4">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {checkout.totals?.itemCount ??
                            checkout.items?.reduce(
                              (sum, item) => sum + item.quantity,
                              0,
                            ) ??
                            0}
                        </span>
                        <span className="ml-1 text-gray-500">items</span>
                      </td>

                      <td className="px-4 py-4 font-semibold text-gray-900 dark:text-white">
                        {money(
                          checkout.totals?.totalAmount,
                          checkout.totals?.currency,
                        )}
                      </td>

                      <td className="px-4 py-4">
                        <StatusBadge status={checkout.paymentStatus} />
                      </td>

                      <td className="px-4 py-4">
                        <StatusBadge status={checkout.status} />
                      </td>

                      <td className="px-4 py-4 text-gray-600 dark:text-gray-300">
                        {dateTime(checkout.expiresAt)}
                      </td>

                      <td className="px-4 py-4 text-gray-600 dark:text-gray-300">
                        {dateTime(checkout.createdAt)}
                      </td>

                      <td className="px-4 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => void openDetails(checkout)}
                          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                        >
                          <Eye size={15} />
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-col gap-3 border-t border-gray-200 px-4 py-4 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Page {pagination.page} of {Math.max(pagination.totalPages, 1)}
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={loading || !pagination.hasPreviousPage}
              onClick={() => updateFilter("page", filters.page - 1)}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:text-gray-200"
            >
              <ChevronLeft size={16} />
              Previous
            </button>

            <button
              type="button"
              disabled={loading || !pagination.hasNextPage}
              onClick={() => updateFilter("page", filters.page + 1)}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:text-gray-200"
            >
              Next
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Details loading */}
      {detailsLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="rounded-xl bg-white p-8 text-center dark:bg-gray-900">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600" />
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
              Loading checkout details...
            </p>
          </div>
        </div>
      )}

      {/* Details error */}
      {detailsError && !detailsLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 dark:bg-gray-900">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 dark:text-white">
                Unable to load checkout
              </h2>
              <button type="button" onClick={closeDetails}>
                <X size={20} />
              </button>
            </div>
            <p className="mt-4 text-sm text-red-600 dark:text-red-400">
              {detailsError}
            </p>
          </div>
        </div>
      )}

      {/* Details modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDetails();
          }}
        >
          <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-800">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  Checkout details
                </h2>
                <p className="mt-1 text-xs text-gray-500">{selected._id}</p>
              </div>

              <button
                type="button"
                onClick={closeDetails}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto p-5">
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                {/* Checkout information */}
                <section className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                  <h3 className="mb-2 flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
                    <Hash size={17} />
                    Checkout information
                  </h3>
                  <DetailRow label="Checkout ID" value={selected._id} />
                  <DetailRow
                    label="Created"
                    value={dateTime(selected.createdAt)}
                  />
                  <DetailRow
                    label="Updated"
                    value={dateTime(selected.updatedAt)}
                  />
                  <DetailRow
                    label="Expires at"
                    value={dateTime(selected.expiresAt)}
                  />
                  <DetailRow
                    label="Completed at"
                    value={dateTime(selected.completedAt)}
                  />
                  <DetailRow
                    label="Linked order ID"
                    value={selected.orderId}
                  />
                </section>

                {/* Customer */}
                <section className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                  <h3 className="mb-2 flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
                    <User size={17} />
                    Customer information
                  </h3>
                  <DetailRow label="Name" value={customer?.name} />
                  <DetailRow label="Email" value={customer?.email} />
                  <DetailRow label="Phone" value={customer?.phone} />
                  <DetailRow label="Customer ID" value={customer?.id} />
                  <DetailRow label="Account status" value={customer?.status} />
                </section>
              </div>

              {/* Status and payment */}
              <section className="mt-5 rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                <h3 className="mb-3 font-semibold text-gray-900 dark:text-white">
                  Checkout & payment status
                </h3>

                <div className="flex flex-wrap gap-2">
                  <StatusBadge status={selected.status} />
                  <StatusBadge status={selected.paymentStatus} />
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
                    <p className="text-xs text-gray-500">Payment method</p>
                    <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                      {formatStatus(selected.paymentMethod)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
                    <p className="text-xs text-gray-500">Shipping method</p>
                    <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                      {selected.shippingMethod || "—"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
                    <p className="text-xs text-gray-500">Coupon code</p>
                    <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                      {selected.couponCode || "—"}
                    </p>
                  </div>
                </div>
              </section>

              {/* Shipping and billing */}
              <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
                <section className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                  <h3 className="mb-3 font-semibold text-gray-900 dark:text-white">
                    Shipping address
                  </h3>
                  <DetailRow
                    label="Recipient"
                    value={selected.shippingAddress?.fullName}
                  />
                  <DetailRow
                    label="Phone"
                    value={selected.shippingAddress?.phone}
                  />
                  <DetailRow
                    label="Email"
                    value={selected.shippingAddress?.email}
                  />
                  <DetailRow
                    label="Address"
                    value={addressText(selected.shippingAddress)}
                  />
                </section>

                <section className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                  <h3 className="mb-3 font-semibold text-gray-900 dark:text-white">
                    Billing address
                  </h3>
                  {selected.billingAddress ? (
                    <>
                      <DetailRow
                        label="Recipient"
                        value={selected.billingAddress.fullName}
                      />
                      <DetailRow
                        label="Phone"
                        value={selected.billingAddress.phone}
                      />
                      <DetailRow
                        label="Email"
                        value={selected.billingAddress.email}
                      />
                      <DetailRow
                        label="Address"
                        value={addressText(selected.billingAddress)}
                      />
                    </>
                  ) : (
                    <p className="text-sm text-gray-500">
                      No separate billing address was provided.
                    </p>
                  )}
                </section>
              </div>

              {/* Items */}
              <section className="mt-5 rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                <h3 className="mb-3 flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
                  <Package size={17} />
                  Checkout items ({selected.items?.length || 0})
                </h3>

                <div className="space-y-3">
                  {selected.items?.map((item, index) => (
                    <div
                      key={item._id || `${item.productId}-${index}`}
                      className="flex flex-col gap-3 border-b border-gray-100 pb-3 last:border-0 last:pb-0 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white">
                          {item.productName}
                        </p>
                        {item.variantName && (
                          <p className="mt-1 text-xs text-gray-500">
                            {item.variantName}
                          </p>
                        )}
                        <p className="mt-1 text-xs text-gray-500">
                          SKU: {item.sku || "—"} · Qty: {item.quantity}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          Inventory tracking:{" "}
                          {item.trackInventory ? "Enabled" : "Disabled"} ·
                          Overselling:{" "}
                          {item.allowOverselling ? "Allowed" : "Not allowed"}
                        </p>
                        <p className="mt-1 break-all text-xs text-gray-500">
                          Product ID: {item.productId}
                        </p>
                      </div>

                      <div className="shrink-0 sm:text-right">
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {money(item.lineSubtotal, item.currency || currency)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {money(item.unitPrice, item.currency || currency)}{" "}
                          each
                        </p>
                        {item.compareAtPrice !== undefined && (
                          <p className="text-xs text-gray-500">
                            Compare at{" "}
                            {money(item.compareAtPrice, item.currency || currency)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Totals */}
              <section className="mt-5 rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                <h3 className="mb-3 font-semibold text-gray-900 dark:text-white">
                  Checkout summary
                </h3>

                <DetailRow
                  label="Currency"
                  value={selected.totals.currency}
                />
                <DetailRow
                  label="Item count"
                  value={selected.totals.itemCount}
                />
                <DetailRow
                  label="Subtotal"
                  value={money(selected.totals.subtotal, currency)}
                />
                <DetailRow
                  label="Discount"
                  value={money(selected.totals.discountAmount, currency)}
                />
                <DetailRow
                  label="Shipping"
                  value={money(selected.totals.shippingAmount, currency)}
                />
                <DetailRow
                  label="Tax"
                  value={money(selected.totals.taxAmount, currency)}
                />

                <div className="mt-3 flex items-center justify-between border-t border-gray-200 pt-4 dark:border-gray-800">
                  <span className="font-semibold text-gray-900 dark:text-white">
                    Total amount
                  </span>
                  <span className="text-xl font-bold text-blue-600">
                    {money(selected.totals.totalAmount, currency)}
                  </span>
                </div>
              </section>

              <p className="mt-5 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300">
                This is a read-only checkout record. Payment and order status
                changes must be handled through their respective workflows.
              </p>
            </div>

            <div className="flex justify-end border-t border-gray-200 px-5 py-4 dark:border-gray-800">
              <button
                type="button"
                onClick={closeDetails}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
