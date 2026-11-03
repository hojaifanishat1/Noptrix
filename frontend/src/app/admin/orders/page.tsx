"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Search,
  RefreshCw,
  Eye,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ShoppingBag,
  X,
  Calendar,
  Hash,
  User,
  Package,
  AlertCircle,
  Truck,
  CheckCircle2,
} from "lucide-react";

import { ordersAdminApi } from "@/services/api/orders-admin.api";

import type {
  AdminOrder,
  AdminOrderFilters,
  OrderStatus,
  OrderPaymentStatus,
  UpdateAdminOrderStatusInput,
} from "@/features/orders/order.types";

const emptyPagination = {
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0,
  hasNextPage: false,
  hasPreviousPage: false,
};

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-gray-700 dark:bg-gray-800 dark:text-white";

const labelClass =
  "mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300";

const orderStatuses: OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "READY_TO_SHIP",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "RETURN_REQUESTED",
  "RETURNED",
];

const paymentStatuses: OrderPaymentStatus[] = [
  "PENDING",
  "AUTHORIZED",
  "PAID",
  "PARTIALLY_REFUNDED",
  "REFUNDED",
  "FAILED",
];

type UpdateableOrderStatus = UpdateAdminOrderStatusInput["status"];

const nextOrderStatuses: Record<OrderStatus, UpdateableOrderStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["READY_TO_SHIP", "CANCELLED"],
  READY_TO_SHIP: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
  RETURN_REQUESTED: [],
  RETURNED: [],
};

function availableStatusTransitions(
  order: AdminOrder,
): UpdateableOrderStatus[] {
  const transitions = nextOrderStatuses[order.status];

  if (["PAID", "PARTIALLY_REFUNDED"].includes(order.paymentStatus)) {
    return transitions.filter((status) => status !== "CANCELLED");
  }

  return transitions;
}

function errorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (
      error as {
        response?: { data?: { message?: string } };
      }
    ).response;

    return response?.data?.message || "Something went wrong.";
  }

  return error instanceof Error ? error.message : "Something went wrong.";
}

function money(value: number, currency = "BDT"): string {
  const amount = Number(value || 0);

  if (currency === "BDT") {
    return `৳${amount.toLocaleString("en-BD", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

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

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString();
}

function formatStatus(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING:
      "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    CONFIRMED: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    PROCESSING:
      "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
    READY_TO_SHIP:
      "bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300",
    SHIPPED:
      "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
    DELIVERED:
      "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
    CANCELLED: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    RETURN_REQUESTED:
      "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
    RETURNED: "bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300",
    PAID: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
    AUTHORIZED: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    FAILED: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
    REFUNDED:
      "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
    PARTIALLY_REFUNDED:
      "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
    UNFULFILLED:
      "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    PARTIALLY_FULFILLED:
      "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    FULFILLED:
      "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  };

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${
        styles[status] ||
        "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
      }`}
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
    <div className="flex flex-col gap-1 border-b border-gray-100 py-3 last:border-0 dark:border-gray-800 sm:flex-row sm:items-start sm:justify-between">
      <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
      <span className="break-all text-sm font-medium text-gray-900 dark:text-gray-100 sm:max-w-[65%] sm:text-right">
        {value === undefined || value === null || value === "" ? "—" : value}
      </span>
    </div>
  );
}

function addressText(address?: AdminOrder["shippingAddress"]): string {
  if (!address) return "—";

  return (
    [
      address.addressLine1,
      address.addressLine2,
      address.city,
      address.state,
      address.postalCode,
      address.country,
    ]
      .filter((part): part is string => typeof part === "string" && !!part)
      .join(", ") || "—"
  );
}

export default function AdminOrdersPage() {
  const [items, setItems] = useState<AdminOrder[]>([]);
  const [pagination, setPagination] = useState(emptyPagination);

  const [filters, setFilters] = useState<AdminOrderFilters>({
    page: 1,
    limit: 20,
    sort: "newest",
    status: "",
    paymentStatus: "",
    search: "",
  });

  const [searchInput, setSearchInput] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selected, setSelected] = useState<AdminOrder | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState("");

  const [statusDraft, setStatusDraft] =
    useState<UpdateableOrderStatus>("CONFIRMED");
  const [statusNotes, setStatusNotes] = useState("");
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [statusSuccess, setStatusSuccess] = useState("");

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await ordersAdminApi.list(filters);

      setItems(result.items);
      setPagination(result.pagination);
    } catch (err) {
      setError(errorMessage(err));
      setItems([]);
      setPagination({
        ...emptyPagination,
        page: filters.page,
        limit: filters.limit,
      });
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void Promise.resolve().then(loadOrders);
  }, [loadOrders]);

  const updateFilter = <K extends keyof AdminOrderFilters>(
    key: K,
    value: AdminOrderFilters[K],
  ) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
      ...(key !== "page" ? { page: 1 } : {}),
    }));
  };

  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updateFilter("search", searchInput.trim());
  };

  const resetFilters = () => {
    setSearchInput("");
    setFilters({
      page: 1,
      limit: 20,
      sort: "newest",
      status: "",
      paymentStatus: "",
      search: "",
    });
  };

  const openDetails = async (order: AdminOrder) => {
    setSelected(null);
    setDetailsError("");
    setStatusError("");
    setStatusSuccess("");
    setStatusNotes("");
    setDetailsLoading(true);

    try {
      const result = await ordersAdminApi.get(order._id);
      setSelected(result);
      setStatusDraft(availableStatusTransitions(result)[0] ?? "CONFIRMED");
    } catch (err) {
      setDetailsError(errorMessage(err));
    } finally {
      setDetailsLoading(false);
    }
  };

  const closeDetails = () => {
    if (detailsLoading || statusSaving) return;

    setSelected(null);
    setDetailsError("");
    setStatusError("");
    setStatusSuccess("");
  };

  const saveStatus = async () => {
    if (!selected) return;

    setStatusSaving(true);
    setStatusError("");
    setStatusSuccess("");

    try {
      const updated = await ordersAdminApi.updateStatus(selected._id, {
        status: statusDraft,
        internalNote: statusNotes.trim() || undefined,
      });

      setSelected(updated);
      setStatusDraft(availableStatusTransitions(updated)[0] ?? "CONFIRMED");
      setStatusNotes("");
      setStatusSuccess("Order status updated successfully.");

      await loadOrders();
    } catch (err) {
      setStatusError(errorMessage(err));
    } finally {
      setStatusSaving(false);
    }
  };

  const currency = (selected?.totals.currency || "BDT").toUpperCase();

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Orders
            </h1>
          </div>

          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage customer orders, fulfillment and order status.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadOrders()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Matching orders
            </p>
            <ShoppingBag className="h-5 w-5 text-blue-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
            {pagination.total.toLocaleString()}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Current page
            </p>
            <Package className="h-5 w-5 text-indigo-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
            {items.length}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Total pages
            </p>
            <Calendar className="h-5 w-5 text-purple-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
            {pagination.totalPages}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <form
          onSubmit={submitSearch}
          className="flex flex-col gap-2 sm:flex-row"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search order number, customer, phone or product..."
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className={labelClass}>Order status</label>
            <select
              value={filters.status || ""}
              onChange={(event) =>
                updateFilter("status", event.target.value as OrderStatus | "")
              }
              className={inputClass}
            >
              <option value="">All statuses</option>
              {orderStatuses.map((status) => (
                <option key={status} value={status}>
                  {formatStatus(status)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Payment status</label>
            <select
              value={filters.paymentStatus || ""}
              onChange={(event) =>
                updateFilter(
                  "paymentStatus",
                  event.target.value as OrderPaymentStatus | "",
                )
              }
              className={inputClass}
            >
              <option value="">All payment statuses</option>
              {paymentStatuses.map((status) => (
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
                updateFilter("sort", event.target.value as "newest" | "oldest")
              }
              className={inputClass}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
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
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {pagination.total
              ? `Showing ${(pagination.page - 1) * pagination.limit + 1}–${Math.min(
                  pagination.page * pagination.limit,
                  pagination.total,
                )} of ${pagination.total} orders`
              : "No matching orders"}
          </p>

          <button
            type="button"
            onClick={resetFilters}
            className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            Reset filters
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <div className="flex-1">{error}</div>
          <button
            type="button"
            onClick={() => void loadOrders()}
            className="font-semibold underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px] text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              <tr>
                <th className="px-4 py-4">Order</th>
                <th className="px-4 py-4">Customer</th>
                <th className="px-4 py-4">Items</th>
                <th className="px-4 py-4">Total</th>
                <th className="px-4 py-4">Payment</th>
                <th className="px-4 py-4">Order status</th>
                <th className="px-4 py-4">Date</th>
                <th className="px-4 py-4 text-right">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <Loader2 className="mx-auto h-7 w-7 animate-spin text-blue-600" />
                    <p className="mt-2 text-sm text-gray-500">
                      Loading orders...
                    </p>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <ShoppingBag className="mx-auto h-10 w-10 text-gray-300" />
                    <p className="mt-3 font-medium text-gray-700 dark:text-gray-200">
                      No orders found
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Try changing your search or filters.
                    </p>
                  </td>
                </tr>
              ) : (
                items.map((order) => (
                  <tr
                    key={order._id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <td className="px-4 py-4">
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {order.orderNumber}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">{order._id}</p>
                    </td>

                    <td className="px-4 py-4">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {order.shippingAddress?.fullName || "Customer"}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {order.shippingAddress?.phone || "—"}
                      </p>
                    </td>

                    <td className="px-4 py-4">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {order.totals?.itemCount ??
                          order.items?.reduce(
                            (total, item) => total + item.quantity,
                            0,
                          ) ??
                          0}
                      </span>
                      <span className="ml-1 text-gray-500">items</span>
                    </td>

                    <td className="px-4 py-4 font-semibold text-gray-900 dark:text-white">
                      {money(
                        order.totals?.totalAmount ?? 0,
                        order.totals?.currency || "BDT",
                      )}
                    </td>

                    <td className="px-4 py-4">
                      <StatusBadge status={order.paymentStatus} />
                    </td>

                    <td className="px-4 py-4">
                      <StatusBadge status={order.status} />
                    </td>

                    <td className="px-4 py-4 text-gray-600 dark:text-gray-300">
                      {dateTime(order.createdAt)}
                    </td>

                    <td className="px-4 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => void openDetails(order)}
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                      >
                        <Eye size={15} />
                        View
                      </button>
                    </td>
                  </tr>
                ))
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
              Loading order details...
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
                Unable to load order
              </h2>
              <button type="button" onClick={closeDetails}>
                <X size={20} />
              </button>
            </div>
            <p className="mt-4 text-sm text-red-600">{detailsError}</p>
          </div>
        </div>
      )}

      {/* Order details modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDetails();
          }}
        >
          <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-800">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  Order details
                </h2>
                <p className="mt-1 text-xs text-gray-500">
                  {selected.orderNumber}
                </p>
              </div>

              <button
                type="button"
                onClick={closeDetails}
                disabled={statusSaving}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto p-5">
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                {/* Order information */}
                <section className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                  <h3 className="mb-2 flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
                    <Hash size={17} />
                    Order information
                  </h3>

                  <DetailRow
                    label="Order number"
                    value={selected.orderNumber}
                  />
                  <DetailRow label="Order ID" value={selected._id} />
                  <DetailRow
                    label="Created"
                    value={dateTime(selected.createdAt)}
                  />
                  <DetailRow
                    label="Updated"
                    value={dateTime(selected.updatedAt)}
                  />
                  <DetailRow
                    label="Payment method"
                    value={selected.paymentMethod}
                  />
                  <DetailRow
                    label="Shipping method"
                    value={selected.shippingMethod}
                  />
                </section>

                {/* Customer */}
                <section className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                  <h3 className="mb-2 flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
                    <User size={17} />
                    Customer & shipping
                  </h3>

                  <DetailRow
                    label="Customer"
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
                  <DetailRow label="Customer ID" value={selected.userId} />
                </section>
              </div>

              {/* Status */}
              <section className="mt-5 rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                <h3 className="mb-3 font-semibold text-gray-900 dark:text-white">
                  Current status
                </h3>

                <div className="flex flex-wrap gap-2">
                  <StatusBadge status={selected.status} />
                  <StatusBadge status={selected.paymentStatus} />
                  <StatusBadge status={selected.fulfillmentStatus} />
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
                    <p className="text-xs text-gray-500">Confirmed</p>
                    <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                      {dateTime(selected.confirmedAt)}
                    </p>
                  </div>

                  <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
                    <p className="text-xs text-gray-500">Shipped</p>
                    <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                      {dateTime(selected.shippedAt)}
                    </p>
                  </div>

                  <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
                    <p className="text-xs text-gray-500">Delivered</p>
                    <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                      {dateTime(selected.deliveredAt)}
                    </p>
                  </div>
                </div>
              </section>

              {/* Items */}
              <section className="mt-5 rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                <h3 className="mb-3 flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
                  <Package size={17} />
                  Ordered items ({selected.items?.length || 0})
                </h3>

                <div className="space-y-3">
                  {selected.items?.map((item, index) => (
                    <div
                      key={`${item.productId || item.sku || "item"}-${index}`}
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
                          Fulfilled: {item.fulfilledQuantity ?? 0} · Returned:{" "}
                          {item.returnedQuantity ?? 0}
                        </p>
                      </div>

                      <div className="shrink-0 sm:text-right">
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {money(item.lineTotal, item.currency || currency)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {money(item.unitPrice, item.currency || currency)}{" "}
                          each
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Totals */}
              <section className="mt-5 rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                <h3 className="mb-3 font-semibold text-gray-900 dark:text-white">
                  Order summary
                </h3>

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
                <DetailRow
                  label="Refunded"
                  value={money(selected.totals.refundedAmount, currency)}
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

              {/* Status update */}
              {availableStatusTransitions(selected).length > 0 && (
                <section className="mt-5 rounded-xl border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900 dark:bg-blue-950/20">
                  <h3 className="mb-3 flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
                    <Truck size={17} />
                    Update order status
                  </h3>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className={labelClass}>New status</label>
                      <select
                        value={statusDraft}
                        onChange={(event) =>
                          setStatusDraft(
                            event.target.value as UpdateableOrderStatus,
                          )
                        }
                        disabled={statusSaving}
                        className={inputClass}
                      >
                        {availableStatusTransitions(selected).map((status) => (
                          <option key={status} value={status}>
                            {formatStatus(status)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className={labelClass}>
                        Internal note (optional)
                      </label>
                      <input
                        value={statusNotes}
                        onChange={(event) => setStatusNotes(event.target.value)}
                        disabled={statusSaving}
                        maxLength={2000}
                        placeholder="Add an internal note..."
                        className={inputClass}
                      />
                    </div>
                  </div>

                  {["PAID", "PARTIALLY_REFUNDED"].includes(
                    selected.paymentStatus,
                  ) && (
                    <p className="mt-3 flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300">
                      <AlertCircle size={15} className="mt-0.5 shrink-0" />
                      Paid orders cannot be cancelled here. Complete the refund
                      workflow first.
                    </p>
                  )}

                  {statusError && (
                    <p className="mt-3 text-sm text-red-600 dark:text-red-400">
                      {statusError}
                    </p>
                  )}

                  {statusSuccess && (
                    <p className="mt-3 flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
                      <CheckCircle2 size={16} />
                      {statusSuccess}
                    </p>
                  )}

                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={() => void saveStatus()}
                      disabled={
                        statusSaving ||
                        statusDraft === selected.status ||
                        !availableStatusTransitions(selected).includes(
                          statusDraft,
                        )
                      }
                      className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {statusSaving ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <CheckCircle2 size={16} />
                      )}
                      {statusSaving ? "Updating..." : "Update status"}
                    </button>
                  </div>
                </section>
              )}

              {selected.status === "CANCELLED" && (
                <p className="mt-5 rounded-lg bg-gray-100 p-3 text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                  This order is cancelled and cannot be updated further.
                </p>
              )}

              {selected.status === "RETURNED" && (
                <p className="mt-5 rounded-lg bg-gray-100 p-3 text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                  This order has been returned.
                </p>
              )}

              {(selected.internalNote || selected.notes) && (
                <section className="mt-5 rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    Internal note
                  </h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-300">
                    {selected.internalNote || selected.notes}
                  </p>
                </section>
              )}
            </div>

            <div className="flex justify-end border-t border-gray-200 px-5 py-4 dark:border-gray-800">
              <button
                type="button"
                onClick={closeDetails}
                disabled={statusSaving}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
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
