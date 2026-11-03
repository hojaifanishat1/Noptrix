"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";

import {
  Search,
  RefreshCw,
  Package,
  Warehouse,
  AlertTriangle,
  X,
  Plus,
  Settings2,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";

import { inventoryAdminApi } from "@/services/api/inventory-admin.api";

import type {
  Inventory,
  InventoryAdjustmentInput,
  InventoryFilters,
  InventoryStatus,
  WarehouseOption,
} from "@/features/inventory/inventory.types";

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-gray-700 dark:bg-gray-800 dark:text-white";

const labelClass =
  "mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300";

function getName(
  value: string | { _id: string; name?: string; code?: string; title?: string },
): string {
  if (typeof value === "string") return value;
  return value.name || value.title || value.code || value._id;
}

function getStatus(item: Inventory): InventoryStatus {
  if (item.stockStatus) return item.stockStatus;

  const available =
    item.availableQuantity ?? item.quantity - item.reservedQuantity;

  if (available <= 0) return "OUT_OF_STOCK";
  if (available <= item.lowStockThreshold) return "LOW_STOCK";
  return "IN_STOCK";
}

function errorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (
      error as {
        response?: {
          data?: {
            message?: string;
            errors?: Array<{
              field?: string;
              message?: string;
            }>;
          };
        };
      }
    ).response;

    const data = response?.data;

    if (Array.isArray(data?.errors) && data.errors.length > 0) {
      return data.errors
        .map((issue) => {
          const field = issue.field || "unknown";
          const message = issue.message || "Invalid value";
          return `${field}: ${message}`;
        })
        .join(" • ");
    }

    return data?.message ?? "Something went wrong.";
  }

  return error instanceof Error ? error.message : "Something went wrong.";
}

function StatusBadge({ status }: { status: InventoryStatus }) {
  const styles: Record<InventoryStatus, string> = {
    IN_STOCK:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    LOW_STOCK:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    OUT_OF_STOCK:
      "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };

  const labels: Record<InventoryStatus, string> = {
    IN_STOCK: "In stock",
    LOW_STOCK: "Low stock",
    OUT_OF_STOCK: "Out of stock",
  };

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

type ModalMode = "adjust" | "threshold";

export default function AdminInventoryPage() {
  const [items, setItems] = useState<Inventory[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [warehousesLoading, setWarehousesLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [warehouseError, setWarehouseError] = useState("");
  const [success, setSuccess] = useState("");

  const [filters, setFilters] = useState<InventoryFilters>({
    page: 1,
    limit: 20,
    search: "",
    warehouseId: "",
    productId: "",
    stockStatus: undefined,
    sortBy: "updatedAt",
    sortOrder: "desc",
  });

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  });

  const [modal, setModal] = useState<{
    mode: ModalMode;
    item: Inventory;
  } | null>(null);

  const [quantityChange, setQuantityChange] = useState("1");
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");
  const [threshold, setThreshold] = useState("5");

  const loadWarehouses = useCallback(async () => {
    setWarehousesLoading(true);
    setWarehouseError("");
    try {
      const result = await inventoryAdminApi.warehouses();
      setWarehouses(result);
    } catch (err) {
      setWarehouseError(errorMessage(err));
    } finally {
      setWarehousesLoading(false);
    }
  }, []);

  const loadInventory = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await inventoryAdminApi.list(filters);
      setItems(result.items);
      setPagination(result.pagination);
    } catch (err) {
      setError(errorMessage(err));
      setItems([]);
      setPagination((current) => ({
        ...current,
        total: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      }));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void Promise.resolve().then(loadWarehouses);
  }, [loadWarehouses]);

  useEffect(() => {
    const productId = new URLSearchParams(window.location.search).get(
      "productId",
    );

    if (productId) {
      void Promise.resolve().then(() =>
        setFilters((current) => ({ ...current, productId, page: 1 })),
      );
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadInventory);
  }, [loadInventory]);

  const updateFilter = <K extends keyof InventoryFilters>(
    key: K,
    value: InventoryFilters[K],
  ) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
      ...(key !== "page" ? { page: 1 } : {}),
    }));
  };

  const openAdjust = (item: Inventory) => {
    setQuantityChange("1");
    setReason("");
    setReference("");
    setModal({ mode: "adjust", item });
  };

  const openThreshold = (item: Inventory) => {
    setThreshold(String(item.lowStockThreshold));
    setModal({ mode: "threshold", item });
  };

  const closeModal = () => {
    if (!submitting) setModal(null);
  };

  const submitModal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!modal) return;

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      if (modal.mode === "adjust") {
        const parsedChange = Number(quantityChange);

        if (!Number.isSafeInteger(parsedChange) || parsedChange === 0) {
          throw new Error("Enter a non-zero whole number.");
        }

        if (!reason.trim() || reason.trim().length < 3) {
          throw new Error("Please enter a reason (at least 3 characters).");
        }

        const input: InventoryAdjustmentInput = {
          quantityChange: parsedChange,
          reason: reason.trim(),
          ...(reference.trim() ? { reference: reference.trim() } : {}),
        };

        await inventoryAdminApi.adjust(
          modal.item._id || modal.item.id || "",
          input,
        );
        setSuccess("Stock adjustment completed.");
      } else {
        const parsedThreshold = Number(threshold);

        if (
          !Number.isSafeInteger(parsedThreshold) ||
          parsedThreshold < 0 ||
          parsedThreshold > 1_000_000
        ) {
          throw new Error(
            "Threshold must be a whole number between 0 and 1,000,000.",
          );
        }

        await inventoryAdminApi.updateThreshold(
          modal.item._id || modal.item.id || "",
          parsedThreshold,
        );
        setSuccess("Low-stock threshold updated.");
      }

      setModal(null);
      await loadInventory();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const totalAvailable = items.reduce(
    (sum, item) =>
      sum + (item.availableQuantity ?? item.quantity - item.reservedQuantity),
    0,
  );

  const lowStockCount = items.filter(
    (item) => getStatus(item) === "LOW_STOCK",
  ).length;

  const outOfStockCount = items.filter(
    (item) => getStatus(item) === "OUT_OF_STOCK",
  ).length;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Inventory Management
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Monitor stock levels, manage thresholds and adjust inventory.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void Promise.all([loadInventory(), loadWarehouses()])}
          disabled={loading || warehousesLoading}
          aria-label="Refresh inventory and warehouses"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          <RefreshCw
            size={16}
            className={loading || warehousesLoading ? "animate-spin" : ""}
          />
          Refresh
        </button>
      </div>

      {warehouseError && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
        >
          <span>Could not load warehouses: {warehouseError}</span>
          <button
            type="button"
            onClick={() => setWarehouseError("")}
            aria-label="Dismiss warehouse error"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          <span>{error}</span>
          <button type="button" onClick={() => setError("")}>
            <X size={16} />
          </button>
        </div>
      )}

      {success && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300">
          <span>{success}</span>
          <button type="button" onClick={() => setSuccess("")}>
            <X size={16} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Inventory records</span>
            <Package className="text-blue-500" size={20} />
          </div>
          <p className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">
            {pagination.total}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">
              Available units (page)
            </span>
            <Package className="text-green-500" size={20} />
          </div>
          <p className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">
            {totalAvailable.toLocaleString()}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Low stock (page)</span>
            <AlertTriangle className="text-amber-500" size={20} />
          </div>
          <p className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">
            {lowStockCount}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Out of stock (page)</span>
            <AlertTriangle className="text-red-500" size={20} />
          </div>
          <p className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">
            {outOfStockCount}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        {filters.productId && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800 dark:bg-blue-950/30 dark:text-blue-300">
            <span>Showing inventory for product {filters.productId}</span>
            <button
              type="button"
              onClick={() => updateFilter("productId", "")}
              className="font-semibold underline"
            >
              Clear product filter
            </button>
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="relative">
            <Search
              size={17}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              value={filters.search ?? ""}
              onChange={(event) => updateFilter("search", event.target.value)}
              placeholder="Search product..."
              className={`${inputClass} pl-10`}
            />
          </div>

          <select
            value={filters.warehouseId ?? ""}
            onChange={(event) =>
              updateFilter("warehouseId", event.target.value)
            }
            className={inputClass}
          >
            <option value="">All warehouses</option>
            {warehouses.map((warehouse) => (
              <option
                key={warehouse._id || warehouse.id}
                value={warehouse._id || warehouse.id}
              >
                {warehouse.name} ({warehouse.code})
              </option>
            ))}
          </select>

          <select
            value={filters.stockStatus ?? ""}
            onChange={(event) =>
              updateFilter(
                "stockStatus",
                (event.target.value || undefined) as
                  InventoryStatus | undefined,
              )
            }
            className={inputClass}
          >
            <option value="">All stock statuses</option>
            <option value="IN_STOCK">In stock</option>
            <option value="LOW_STOCK">Low stock</option>
            <option value="OUT_OF_STOCK">Out of stock</option>
          </select>

          <select
            value={`${filters.sortBy}:${filters.sortOrder}`}
            onChange={(event) => {
              const [sortBy, sortOrder] = event.target.value.split(":") as [
                InventoryFilters["sortBy"],
                InventoryFilters["sortOrder"],
              ];
              setFilters((current) => ({
                ...current,
                sortBy,
                sortOrder,
                page: 1,
              }));
            }}
            className={inputClass}
          >
            <option value="updatedAt:desc">Recently updated</option>
            <option value="updatedAt:asc">Oldest updated</option>
            <option value="quantity:asc">Quantity: Low to high</option>
            <option value="quantity:desc">Quantity: High to low</option>
            <option value="createdAt:desc">Recently created</option>
            <option value="createdAt:asc">Oldest created</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-800">
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white">
              Stock overview
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              Inventory is tracked separately for each warehouse.
            </p>
          </div>
          <span className="text-sm text-gray-500">
            {pagination.total} records
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800/70">
              <tr>
                <th className="px-5 py-3">Product</th>
                <th className="px-5 py-3">Warehouse</th>
                <th className="px-5 py-3 text-right">Quantity</th>
                <th className="px-5 py-3 text-right">Reserved</th>
                <th className="px-5 py-3 text-right">Available</th>
                <th className="px-5 py-3 text-right">Threshold</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center">
                    <Loader2 className="mx-auto animate-spin text-blue-500" />
                    <p className="mt-2 text-sm text-gray-500">
                      Loading inventory...
                    </p>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center">
                    <Package className="mx-auto text-gray-400" size={30} />
                    <p className="mt-2 font-medium text-gray-700 dark:text-gray-300">
                      No inventory records found
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Try changing your search or filters.
                    </p>
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const available =
                    item.availableQuantity ??
                    item.quantity - item.reservedQuantity;

                  return (
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
                          {typeof item.productId === "string"
                            ? item.productId
                            : item.productId.sku || item.productId._id}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                          <Warehouse size={15} className="text-gray-400" />
                          {getName(item.warehouseId)}
                        </div>
                      </td>

                      <td className="px-5 py-4 text-right font-semibold text-gray-900 dark:text-white">
                        {item.quantity.toLocaleString()}
                      </td>
                      <td className="px-5 py-4 text-right text-gray-600 dark:text-gray-300">
                        {item.reservedQuantity.toLocaleString()}
                      </td>
                      <td className="px-5 py-4 text-right font-semibold text-gray-900 dark:text-white">
                        {available.toLocaleString()}
                      </td>
                      <td className="px-5 py-4 text-right text-gray-600 dark:text-gray-300">
                        {item.lowStockThreshold}
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge status={getStatus(item)} />
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            title="Adjust stock"
                            onClick={() => openAdjust(item)}
                            className="rounded-lg border border-gray-300 p-2 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                          >
                            <Plus size={16} />
                          </button>
                          <button
                            type="button"
                            title="Change low-stock threshold"
                            onClick={() => openThreshold(item)}
                            className="rounded-lg border border-gray-300 p-2 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                          >
                            <Settings2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col items-center justify-between gap-3 border-t border-gray-200 px-5 py-4 sm:flex-row dark:border-gray-800">
          <p className="text-sm text-gray-500">
            Page {pagination.page} of {Math.max(pagination.totalPages, 1)}
            {" · "}
            {pagination.total} total records
          </p>

          <div className="flex items-center gap-2">
            <select
              value={filters.limit}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  limit: Number(event.target.value),
                  page: 1,
                }))
              }
              className="rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            >
              <option value={10}>10 / page</option>
              <option value={20}>20 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
            </select>

            <button
              type="button"
              disabled={!pagination.hasPreviousPage || loading}
              onClick={() => updateFilter("page", filters.page - 1)}
              className="rounded-lg border border-gray-300 p-2 disabled:opacity-40 dark:border-gray-700"
            >
              <ChevronLeft size={17} />
            </button>
            <button
              type="button"
              disabled={!pagination.hasNextPage || loading}
              onClick={() => updateFilter("page", filters.page + 1)}
              className="rounded-lg border border-gray-300 p-2 disabled:opacity-40 dark:border-gray-700"
            >
              <ChevronRight size={17} />
            </button>
          </div>
        </div>
      </div>

      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal();
          }}
        >
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-800">
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-white">
                  {modal.mode === "adjust"
                    ? "Adjust stock"
                    : "Update low-stock threshold"}
                </h2>
                <p className="mt-1 text-xs text-gray-500">
                  {getName(modal.item.productId)} ·{" "}
                  {getName(modal.item.warehouseId)}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                disabled={submitting}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={submitModal} className="space-y-4 p-5">
              {modal.mode === "adjust" ? (
                <>
                  <div>
                    <label className={labelClass}>Quantity change</label>
                    <input
                      type="number"
                      step="1"
                      required
                      value={quantityChange}
                      onChange={(event) =>
                        setQuantityChange(event.target.value)
                      }
                      className={inputClass}
                      placeholder="Example: 10 or -5"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Use a positive number to add stock and a negative number
                      to remove stock.
                    </p>
                  </div>

                  <div>
                    <label className={labelClass}>Reason</label>
                    <textarea
                      required
                      minLength={3}
                      maxLength={300}
                      rows={3}
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      className={inputClass}
                      placeholder="Explain why the stock is changing..."
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Reference (optional)</label>
                    <input
                      maxLength={120}
                      value={reference}
                      onChange={(event) => setReference(event.target.value)}
                      className={inputClass}
                      placeholder="Purchase order, invoice or reference ID"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className={labelClass}>Low-stock threshold</label>
                  <input
                    type="number"
                    min={0}
                    max={1000000}
                    step="1"
                    required
                    value={threshold}
                    onChange={(event) => setThreshold(event.target.value)}
                    className={inputClass}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Inventory becomes low stock when available quantity is at or
                    below this value.
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={submitting}
                  className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 dark:border-gray-700 dark:text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : modal.mode === "adjust" ? (
                    <Plus size={16} />
                  ) : (
                    <Settings2 size={16} />
                  )}
                  {submitting ? "Saving..." : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
