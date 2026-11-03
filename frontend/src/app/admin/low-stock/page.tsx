"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Search,
  RefreshCw,
  AlertTriangle,
  Package,
  Warehouse,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  ShoppingBag,
} from "lucide-react";

import { lowStockAdminApi } from "@/services/api/low-stock-admin.api";
import { inventoryAdminApi } from "@/services/api/inventory-admin.api";

import type {
  LowStockFilters,
  LowStockItem,
  LowStockStatus,
  LowStockSummary,
} from "@/features/low-stock/low-stock.types";
import type { WarehouseOption } from "@/features/inventory/inventory.types";

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-gray-700 dark:bg-gray-800 dark:text-white";

const labelClass =
  "mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300";

const emptySummary: LowStockSummary = {
  lowStock: 0,
  outOfStock: 0,
  totalAlerts: 0,
};

const emptyPagination = {
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0,
  hasNextPage: false,
  hasPreviousPage: false,
};

function getName(
  value: string | { _id: string; name?: string; code?: string; title?: string },
): string {
  if (typeof value === "string") return value;
  return value.name || value.title || value.code || value._id;
}

function getProductSku(item: LowStockItem): string {
  if (typeof item.productId === "string") return "—";
  if (typeof item.variantId === "object" && item.variantId) {
    return item.variantId.sku || item.productId.sku || "—";
  }
  return item.productId.sku || "—";
}

function errorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (
      error as {
        response?: {
          data?: {
            message?: string;
            errors?: Array<{ field?: string; message?: string }>;
          };
        };
      }
    ).response;

    const data = response?.data;

    if (Array.isArray(data?.errors) && data.errors.length) {
      return data.errors
        .map(
          (item) =>
            `${item.field || "Field"}: ${item.message || "Invalid value"}`,
        )
        .join(" • ");
    }

    return data?.message || "Something went wrong.";
  }

  return error instanceof Error ? error.message : "Something went wrong.";
}

function StatusBadge({ status }: { status: LowStockItem["stockStatus"] }) {
  const out = status === "OUT_OF_STOCK";

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
        out
          ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
          : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
      }`}
    >
      {out ? "Out of stock" : "Low stock"}
    </span>
  );
}

function SummaryCard({
  title,
  value,
  description,
  icon: Icon,
  color,
}: {
  title: string;
  value: number;
  description: string;
  icon: typeof Package;
  color: "amber" | "red" | "blue";
}) {
  const colors = {
    amber:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    red: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            {title}
          </p>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
            {value.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {description}
          </p>
        </div>
        <div className={`rounded-lg p-3 ${colors[color]}`}>
          <Icon size={21} />
        </div>
      </div>
    </div>
  );
}

export default function AdminLowStockPage() {
  const [items, setItems] = useState<LowStockItem[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [summary, setSummary] = useState<LowStockSummary>(emptySummary);
  const [pagination, setPagination] = useState(emptyPagination);

  const [filters, setFilters] = useState<LowStockFilters>({
    page: 1,
    limit: 20,
    search: "",
    warehouseId: "",
    status: "ALL",
    sortBy: "updatedAt",
    sortOrder: "asc",
  });

  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [error, setError] = useState("");
  const [summaryError, setSummaryError] = useState("");
  const [warehouseError, setWarehouseError] = useState("");

  const summarySearch = filters.search;
  const summaryWarehouseId = filters.warehouseId;

  const loadWarehouses = useCallback(async () => {
    setWarehouseError("");

    try {
      const result = await inventoryAdminApi.warehouses();
      setWarehouses(result);
    } catch (err) {
      setWarehouseError(errorMessage(err));
    }
  }, []);

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    setSummaryError("");

    try {
      const result = await lowStockAdminApi.summary({
        search: summarySearch,
        warehouseId: summaryWarehouseId,
      });
      setSummary(result);
    } catch (err) {
      setSummaryError(errorMessage(err));
    } finally {
      setSummaryLoading(false);
    }
  }, [summarySearch, summaryWarehouseId]);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await lowStockAdminApi.list(filters);
      setItems(result.items);
      setPagination(result.pagination);
    } catch (err) {
      setError(errorMessage(err));
      setItems([]);
      setPagination(emptyPagination);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void Promise.resolve().then(loadWarehouses);
  }, [loadWarehouses]);

  useEffect(() => {
    void Promise.resolve().then(loadItems);
  }, [loadItems]);

  useEffect(() => {
    void Promise.resolve().then(loadSummary);
  }, [loadSummary]);

  const updateFilter = <K extends keyof LowStockFilters>(
    key: K,
    value: LowStockFilters[K],
  ) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
      page: 1,
    }));
  };

  const applySearch = () => {
    updateFilter("search", searchInput.trim());
  };

  const refresh = () => {
    void loadItems();
    void loadSummary();
  };

  const setStatus = (status: LowStockStatus) => {
    updateFilter("status", status);
  };

  const getAvailable = (item: LowStockItem) =>
    item.availableQuantity ?? item.quantity - item.reservedQuantity;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="text-amber-500" size={25} />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Low Stock
            </h1>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Monitor products that need replenishment across your warehouses.
          </p>
        </div>

        <button
          type="button"
          onClick={refresh}
          disabled={loading || summaryLoading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryCard
          title="Total alerts"
          value={summary.totalAlerts}
          description="All stock alerts"
          icon={AlertTriangle}
          color="blue"
        />
        <SummaryCard
          title="Low stock"
          value={summary.lowStock}
          description="Available quantity above zero, at or below threshold"
          icon={Package}
          color="amber"
        />
        <SummaryCard
          title="Out of stock"
          value={summary.outOfStock}
          description="No available stock"
          icon={AlertCircle}
          color="red"
        />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="xl:col-span-2">
            <label className={labelClass}>Search product</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search
                  size={17}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  className={`${inputClass} pl-9`}
                  placeholder="Search by product name..."
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") applySearch();
                  }}
                />
              </div>
              <button
                type="button"
                onClick={applySearch}
                className="rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700"
              >
                Search
              </button>
            </div>
          </div>

          <div>
            <label className={labelClass}>Warehouse</label>
            <select
              className={inputClass}
              value={filters.warehouseId || ""}
              onChange={(event) =>
                updateFilter("warehouseId", event.target.value)
              }
            >
              <option value="">All warehouses</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse._id} value={warehouse._id}>
                  {warehouse.name} ({warehouse.code})
                </option>
              ))}
            </select>
            {warehouseError && (
              <p className="mt-1 text-xs text-red-500">{warehouseError}</p>
            )}
          </div>

          <div>
            <label className={labelClass}>Stock status</label>
            <select
              className={inputClass}
              value={filters.status}
              onChange={(event) =>
                setStatus(event.target.value as LowStockStatus)
              }
            >
              <option value="ALL">All alerts</option>
              <option value="LOW_STOCK">Low stock</option>
              <option value="OUT_OF_STOCK">Out of stock</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-col justify-between gap-3 border-t border-gray-100 pt-4 dark:border-gray-800 sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Sort by
            </span>
            <select
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              value={filters.sortBy}
              onChange={(event) =>
                updateFilter(
                  "sortBy",
                  event.target.value as LowStockFilters["sortBy"],
                )
              }
            >
              <option value="updatedAt">Last updated</option>
              <option value="quantity">Quantity</option>
              <option value="createdAt">Created date</option>
            </select>

            <select
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              value={filters.sortOrder}
              onChange={(event) =>
                updateFilter("sortOrder", event.target.value as "asc" | "desc")
              }
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => {
              setSearchInput("");
              setFilters({
                page: 1,
                limit: 20,
                search: "",
                warehouseId: "",
                status: "ALL",
                sortBy: "updatedAt",
                sortOrder: "asc",
              });
            }}
            className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            Clear filters
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {summaryError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400"
        >
          Could not load the stock summary: {summaryError}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-col justify-between gap-2 border-b border-gray-200 px-5 py-4 dark:border-gray-800 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white">
              Stock alerts
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {pagination.total.toLocaleString()} matching inventory records
            </p>
          </div>
          {summaryLoading && (
            <span className="flex items-center gap-2 text-xs text-gray-400">
              <Loader2 size={14} className="animate-spin" />
              Updating summary
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800/60 dark:text-gray-400">
              <tr>
                <th className="px-5 py-3 font-semibold">Product</th>
                <th className="px-5 py-3 font-semibold">Warehouse</th>
                <th className="px-5 py-3 text-right font-semibold">Quantity</th>
                <th className="px-5 py-3 text-right font-semibold">Reserved</th>
                <th className="px-5 py-3 text-right font-semibold">
                  Available
                </th>
                <th className="px-5 py-3 text-right font-semibold">
                  Threshold
                </th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 text-right font-semibold">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-14 text-center">
                    <Loader2
                      className="mx-auto animate-spin text-blue-500"
                      size={25}
                    />
                    <p className="mt-2 text-sm text-gray-500">
                      Loading stock alerts...
                    </p>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-14 text-center">
                    <Package
                      className="mx-auto text-gray-300 dark:text-gray-600"
                      size={34}
                    />
                    <p className="mt-3 font-medium text-gray-700 dark:text-gray-300">
                      No stock alerts found
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      No inventory records match the selected filters.
                    </p>
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr
                    key={item._id || item.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/40"
                  >
                    <td className="px-5 py-4">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {getName(item.productId)}
                      </p>
                      {item.variantId && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Variant: {getName(item.variantId)}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-gray-500">
                        SKU: {getProductSku(item)}
                      </p>
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                        <Warehouse size={15} className="text-gray-400" />
                        {getName(item.warehouseId)}
                      </div>
                    </td>

                    <td className="px-5 py-4 text-right font-medium text-gray-700 dark:text-gray-300">
                      {item.quantity.toLocaleString()}
                    </td>
                    <td className="px-5 py-4 text-right text-gray-600 dark:text-gray-400">
                      {item.reservedQuantity.toLocaleString()}
                    </td>
                    <td className="px-5 py-4 text-right font-bold text-gray-900 dark:text-white">
                      {getAvailable(item).toLocaleString()}
                    </td>
                    <td className="px-5 py-4 text-right text-gray-600 dark:text-gray-400">
                      {item.lowStockThreshold.toLocaleString()}
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={item.stockStatus} />
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/admin/purchases?${new URLSearchParams({
                          restock: "1",
                          productId:
                            typeof item.productId === "string"
                              ? item.productId
                              : item.productId._id,
                          ...(item.variantId
                            ? {
                                variantId:
                                  typeof item.variantId === "string"
                                    ? item.variantId
                                    : item.variantId._id,
                              }
                            : {}),
                          warehouseId:
                            typeof item.warehouseId === "string"
                              ? item.warehouseId
                              : item.warehouseId._id,
                          quantity: String(
                            Math.max(
                              1,
                              item.lowStockThreshold * 2 - getAvailable(item),
                            ),
                          ),
                        }).toString()}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 dark:border-blue-900 dark:text-blue-300 dark:hover:bg-blue-950/40"
                      >
                        <ShoppingBag size={14} />
                        Create purchase
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col justify-between gap-3 border-t border-gray-200 px-5 py-4 dark:border-gray-800 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <span>Rows per page</span>
            <select
              className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              value={filters.limit}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  limit: Number(event.target.value),
                  page: 1,
                }))
              }
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>
              {pagination.total === 0
                ? "0 results"
                : `${(pagination.page - 1) * pagination.limit + 1}–${Math.min(
                    pagination.page * pagination.limit,
                    pagination.total,
                  )} of ${pagination.total}`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!pagination.hasPreviousPage || loading}
              onClick={() =>
                setFilters((current) => ({
                  ...current,
                  page: Math.max(1, current.page - 1),
                }))
              }
              className="rounded-lg border border-gray-300 p-2 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              aria-label="Previous page"
            >
              <ChevronLeft size={17} />
            </button>

            <span className="min-w-24 text-center text-sm text-gray-600 dark:text-gray-300">
              Page {pagination.page} of {Math.max(1, pagination.totalPages)}
            </span>

            <button
              type="button"
              disabled={!pagination.hasNextPage || loading}
              onClick={() =>
                setFilters((current) => ({
                  ...current,
                  page: current.page + 1,
                }))
              }
              className="rounded-lg border border-gray-300 p-2 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              aria-label="Next page"
            >
              <ChevronRight size={17} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
