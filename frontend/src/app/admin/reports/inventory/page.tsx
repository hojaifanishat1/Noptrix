"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Boxes,
  Download,
  RefreshCw,
  Search,
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  Warehouse as WarehouseIcon,
  Package,
} from "lucide-react";

import { inventoryAdminApi } from "@/services/api/inventory-admin.api";
import { lowStockAdminApi } from "@/services/api/low-stock-admin.api";
import { stockMovementsAdminApi } from "@/services/api/stock-movements-admin.api";
import { warehouseAdminApi } from "@/services/api/warehouse-admin.api";

import type { Inventory } from "@/features/inventory/inventory.types";
import type { LowStockItem, LowStockSummary } from "@/features/low-stock/low-stock.types";
import type { StockMovement, StockMovementType } from "@/features/stock-movements/stock-movement.types";
import type { Warehouse } from "@/features/warehouses/warehouse.types";

type Tab = "overview" | "stock" | "alerts" | "movements";

type ProductInfo = {
  _id: string;
  name?: string;
  sku?: string;
  costPrice?: number;
  price?: number;
  currency?: string;
};

type WarehouseInfo = {
  _id: string;
  name?: string;
  code?: string;
};

const PAGE_SIZE = 20;

function productInfo(value: Inventory["productId"] | StockMovement["productId"]): ProductInfo {
  if (typeof value === "string") return { _id: value };
  return value as ProductInfo;
}

function warehouseInfo(value: Inventory["warehouseId"] | StockMovement["warehouseId"]): WarehouseInfo {
  if (typeof value === "string") return { _id: value };
  return value as WarehouseInfo;
}

function money(value: number) {
  return `৳${value.toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function dateTime(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function errorMessage(error: unknown) {
  if (error && typeof error === "object" && "response" in error) {
    const response = (error as {
      response?: { data?: { message?: string } };
    }).response;
    if (response?.data?.message) return response.data.message;
  }
  return error instanceof Error ? error.message : "Unable to load report data.";
}

function downloadCSV(filename: string, rows: Record<string, string | number>[]) {
  if (!rows.length) return;

  const headers = Object.keys(rows[0]);
  const escape = (value: string | number) =>
    `"${String(value ?? "").replace(/"/g, '""')}"`;

  const csv = [
    headers.map(escape).join(","),
    ...rows.map((row) => headers.map((header) => escape(row[header])).join(",")),
  ].join("\r\n");

  const blob = new Blob(["\uFEFF", csv], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

const tabs: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "stock", label: "Stock Report" },
  { id: "alerts", label: "Low Stock Alerts" },
  { id: "movements", label: "Stock Movements" },
];

export default function InventoryReportsPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [alerts, setAlerts] = useState<LowStockItem[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [alertSummary, setAlertSummary] = useState<LowStockSummary>({
    lowStock: 0,
    outOfStock: 0,
    totalAlerts: 0,
  });

  const [search, setSearch] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [stockStatus, setStockStatus] = useState("");
  const [movementType, setMovementType] = useState<StockMovementType | "">("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const warehousePromise =
        warehouses.length > 0
          ? Promise.resolve(warehouses)
          : warehouseAdminApi.list({
              page: 1,
              limit: 100,
              status: "ACTIVE",
              sortBy: "name",
              sortOrder: "asc",
            }).then((result) => result.items ?? []);

      if (tab === "overview") {
        const [inventoryResult, summaryResult, warehouseResult] =
          await Promise.all([
            inventoryAdminApi.list({
              page: 1,
              limit: 100,
              search: search || undefined,
              warehouseId: warehouseId || undefined,
              sortBy: "quantity",
              sortOrder: "desc",
            }),
            lowStockAdminApi.summary({
              search: search || undefined,
              warehouseId: warehouseId || undefined,
            }),
            warehousePromise,
          ]);

        setInventory(inventoryResult.items ?? []);
        setTotal(inventoryResult.pagination?.total ?? 0);
        setAlertSummary(summaryResult ?? {
          lowStock: 0,
          outOfStock: 0,
          totalAlerts: 0,
        });
        setWarehouses(warehouseResult);
      }

      if (tab === "stock") {
        const [result, warehouseResult] = await Promise.all([
          inventoryAdminApi.list({
            page,
            limit: PAGE_SIZE,
            search: search || undefined,
            warehouseId: warehouseId || undefined,
            stockStatus: (stockStatus || undefined) as
              | "IN_STOCK"
              | "LOW_STOCK"
              | "OUT_OF_STOCK"
              | undefined,
            sortBy: "quantity",
            sortOrder: "asc",
          }),
          warehousePromise,
        ]);

        setInventory(result.items ?? []);
        setTotal(result.pagination?.total ?? 0);
        setTotalPages(Math.max(1, result.pagination?.totalPages ?? 1));
        setWarehouses(warehouseResult);
      }

      if (tab === "alerts") {
        const [result, summaryResult, warehouseResult] = await Promise.all([
          lowStockAdminApi.list({
            page,
            limit: PAGE_SIZE,
            search: search || undefined,
            warehouseId: warehouseId || undefined,
            status: stockStatus === "OUT_OF_STOCK"
              ? "OUT_OF_STOCK"
              : stockStatus === "LOW_STOCK"
                ? "LOW_STOCK"
                : "ALL",
            sortBy: "quantity",
            sortOrder: "asc",
          }),
          lowStockAdminApi.summary({
            search: search || undefined,
            warehouseId: warehouseId || undefined,
          }),
          warehousePromise,
        ]);

        setAlerts(result.items ?? []);
        setTotal(result.pagination?.total ?? 0);
        setTotalPages(Math.max(1, result.pagination?.totalPages ?? 1));
        setAlertSummary(summaryResult);
        setWarehouses(warehouseResult);
      }

      if (tab === "movements") {
        const result = await stockMovementsAdminApi.list({
          page,
          limit: PAGE_SIZE,
          warehouseId: warehouseId || undefined,
          type: movementType || undefined,
          fromDate: fromDate || undefined,
          toDate: toDate ? `${toDate}T23:59:59.999` : undefined,
          sortOrder: "desc",
        });

        const filtered = search.trim()
          ? result.items.filter((item) => {
              const product = productInfo(item.productId);
              return `${product.name ?? ""} ${product.sku ?? ""} ${item.reason}`
                .toLowerCase()
                .includes(search.toLowerCase());
            })
          : result.items;

        setMovements(filtered);
        setTotal(result.pagination?.total ?? filtered.length);
        setTotalPages(Math.max(1, result.pagination?.totalPages ?? 1));
        setWarehouses(await warehousePromise);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [
    tab,
    page,
    search,
    warehouseId,
    stockStatus,
    movementType,
    fromDate,
    toDate,
    warehouses,
  ]);

  useEffect(() => {
    void Promise.resolve().then(loadReport);
  }, [loadReport]);

  const valuation = useMemo(() => {
    let totalValue = 0;
    let valuedItems = 0;
    let missingCost = 0;

    for (const item of inventory) {
      const product = productInfo(item.productId);
      if (typeof product.costPrice === "number") {
        totalValue += item.quantity * product.costPrice;
        valuedItems += 1;
      } else {
        missingCost += 1;
      }
    }

    return { totalValue, valuedItems, missingCost };
  }, [inventory]);

  const inStockCount = inventory.filter(
    (item) => (item.availableQuantity ?? item.quantity - item.reservedQuantity) > 0
      && (item.stockStatus ?? "IN_STOCK") === "IN_STOCK",
  ).length;

  const currentRows = useMemo(() => {
    if (tab === "stock") {
      return inventory.map((item) => {
        const product = productInfo(item.productId);
        const warehouse = warehouseInfo(item.warehouseId);
        return {
          SKU: product.sku ?? "",
          Product: product.name ?? "",
          Warehouse: warehouse.name ?? "",
          Quantity: item.quantity,
          Reserved: item.reservedQuantity,
          Available: item.availableQuantity ?? item.quantity - item.reservedQuantity,
          "Low Stock Threshold": item.lowStockThreshold,
          "Cost Price (BDT)": product.costPrice ?? "",
          "Stock Value (BDT)": typeof product.costPrice === "number"
            ? item.quantity * product.costPrice
            : "",
        };
      });
    }

    if (tab === "alerts") {
      return alerts.map((item) => {
        const product = productInfo(item.productId);
        const warehouse = warehouseInfo(item.warehouseId);
        return {
          SKU: product.sku ?? "",
          Product: product.name ?? "",
          Warehouse: warehouse.name ?? "",
          Quantity: item.quantity,
          Reserved: item.reservedQuantity,
          Available: item.availableQuantity,
          Threshold: item.lowStockThreshold,
          Status: item.stockStatus,
        };
      });
    }

    if (tab === "movements") {
      return movements.map((item) => {
        const product = productInfo(item.productId);
        const warehouse = warehouseInfo(item.warehouseId);
        const destination = item.destinationWarehouseId
          ? warehouseInfo(item.destinationWarehouseId)
          : undefined;

        return {
          Date: dateTime(item.createdAt),
          SKU: product.sku ?? "",
          Product: product.name ?? "",
          Type: item.type,
          Warehouse: warehouse.name ?? "",
          Destination: destination?.name ?? "",
          Quantity: item.quantity,
          "Quantity Before": item.quantityBefore,
          "Quantity After": item.quantityAfter,
          Reason: item.reason,
          Reference: item.reference ?? "",
        };
      });
    }

    return [];
  }, [tab, inventory, alerts, movements]);

  function changeTab(nextTab: Tab) {
    setTab(nextTab);
    setPage(1);
    setStockStatus("");
    setMovementType("");
  }

  function resetFilters() {
    setSearch("");
    setWarehouseId("");
    setStockStatus("");
    setMovementType("");
    setFromDate("");
    setToDate("");
    setPage(1);
  }

  const metricCards = [
    {
      label: "Inventory Records",
      value: total.toLocaleString(),
      icon: Boxes,
      color: "bg-blue-50 text-blue-600 dark:bg-blue-950",
    },
    {
      label: "Low Stock",
      value: alertSummary.lowStock.toLocaleString(),
      icon: AlertTriangle,
      color: "bg-amber-50 text-amber-600 dark:bg-amber-950",
    },
    {
      label: "Out of Stock",
      value: alertSummary.outOfStock.toLocaleString(),
      icon: Package,
      color: "bg-red-50 text-red-600 dark:bg-red-950",
    },
    {
      label: "Warehouses",
      value: warehouses.length.toLocaleString(),
      icon: WarehouseIcon,
      color: "bg-purple-50 text-purple-600 dark:bg-purple-950",
    },
  ];

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Inventory Reports
            </h1>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Monitor stock levels, inventory valuation, alerts and stock movements.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => void loadReport()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={() => downloadCSV(`inventory-${tab}-${new Date().toISOString().slice(0, 10)}.csv`, currentRows)}
            disabled={!currentRows.length}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {card.label}
                </p>
                <span className={`rounded-lg p-2 ${card.color}`}>
                  <Icon className="h-5 w-5" />
                </span>
              </div>
              <p className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">
                {card.value}
              </p>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-800">
        {tabs.map((item) => (
          <button
            key={item.id}
            onClick={() => changeTab(item.id)}
            className={`border-b-2 px-4 py-3 text-sm font-semibold transition ${
              tab === item.id
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search product or SKU"
              className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
            />
          </div>

          <select
            value={warehouseId}
            onChange={(event) => {
              setWarehouseId(event.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
          >
            <option value="">All warehouses</option>
            {warehouses.map((warehouse) => (
              <option key={warehouse._id} value={warehouse._id}>
                {warehouse.name} ({warehouse.code})
              </option>
            ))}
          </select>

          {(tab === "stock" || tab === "alerts") && (
            <select
              value={stockStatus}
              onChange={(event) => {
                setStockStatus(event.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
            >
              <option value="">All stock statuses</option>
              {tab === "stock" && <option value="IN_STOCK">In Stock</option>}
              <option value="LOW_STOCK">Low Stock</option>
              <option value="OUT_OF_STOCK">Out of Stock</option>
            </select>
          )}

          {tab === "movements" && (
            <select
              value={movementType}
              onChange={(event) => {
                setMovementType(event.target.value as StockMovementType | "");
                setPage(1);
              }}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
            >
              <option value="">All movement types</option>
              <option value="IN">Stock In</option>
              <option value="OUT">Stock Out</option>
              <option value="ADJUSTMENT">Adjustment</option>
              <option value="TRANSFER">Transfer</option>
            </select>
          )}

          {tab === "movements" && (
            <>
              <input
                type="date"
                value={fromDate}
                onChange={(event) => {
                  setFromDate(event.target.value);
                  setPage(1);
                }}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                aria-label="From date"
              />
              <input
                type="date"
                value={toDate}
                min={fromDate || undefined}
                onChange={(event) => {
                  setToDate(event.target.value);
                  setPage(1);
                }}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                aria-label="To date"
              />
            </>
          )}

          <button
            onClick={resetFilters}
            className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Clear filters
          </button>
        </div>
      </div>

      {tab === "overview" && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <h2 className="font-semibold text-gray-900 dark:text-white">
              Stock Health
            </h2>
            <div className="mt-5 space-y-4">
              {[
                {
                  label: "Low Stock",
                  value: alertSummary.lowStock,
                  color: "bg-amber-500",
                },
                {
                  label: "Out of Stock",
                  value: alertSummary.outOfStock,
                  color: "bg-red-500",
                },
                {
                  label: "Available Stock Records",
                  value: inStockCount,
                  color: "bg-emerald-500",
                },
              ].map((item) => {
                const max = Math.max(
                  alertSummary.totalAlerts,
                  inStockCount,
                  1,
                );
                return (
                  <div key={item.label}>
                    <div className="mb-1.5 flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-300">
                        {item.label}
                      </span>
                      <strong className="text-gray-900 dark:text-white">
                        {item.value.toLocaleString()}
                      </strong>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                      <div
                        className={`h-full rounded-full ${item.color}`}
                        style={{
                          width: `${Math.min(100, (item.value / max) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <h2 className="font-semibold text-gray-900 dark:text-white">
              Inventory Valuation
            </h2>
            <p className="mt-3 text-3xl font-bold text-gray-900 dark:text-white">
              {valuation.valuedItems > 0 ? money(valuation.totalValue) : "—"}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Calculated from quantity × product cost price (BDT).
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
                <p className="text-xs text-gray-500">Valued records</p>
                <p className="mt-1 text-xl font-semibold text-gray-900 dark:text-white">
                  {valuation.valuedItems}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
                <p className="text-xs text-gray-500">Missing cost price</p>
                <p className="mt-1 text-xl font-semibold text-gray-900 dark:text-white">
                  {valuation.missingCost}
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs text-gray-500">
              Valuation uses the currently loaded inventory records only. It is
              not a full-database total when more than 100 records exist.
            </p>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900 xl:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold text-gray-900 dark:text-white">
                Warehouse Overview
              </h2>
              <span className="text-sm text-gray-500">
                {warehouses.length} active warehouses
              </span>
            </div>
            {warehouses.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500">
                No active warehouses found.
              </p>
            ) : (
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {warehouses.map((warehouse) => (
                  <button
                    key={warehouse._id}
                    onClick={() => {
                      setWarehouseId(warehouse._id);
                      setTab("stock");
                      setPage(1);
                    }}
                    className="flex items-center gap-3 rounded-lg border border-gray-100 p-4 text-left hover:border-blue-300 hover:bg-blue-50/50 dark:border-gray-800 dark:hover:bg-blue-950/20"
                  >
                    <span className="rounded-lg bg-blue-50 p-2 text-blue-600 dark:bg-blue-950">
                      <WarehouseIcon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-gray-900 dark:text-white">
                        {warehouse.name}
                      </span>
                      <span className="text-xs text-gray-500">
                        {warehouse.code}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {tab === "stock" && (
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
            <h2 className="font-semibold text-gray-900 dark:text-white">
              Inventory Stock Report
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              Quantity, reserved stock, available stock and cost valuation.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[950px] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800">
                <tr>
                  <th className="px-5 py-3">Product</th>
                  <th className="px-5 py-3">Warehouse</th>
                  <th className="px-5 py-3">Quantity</th>
                  <th className="px-5 py-3">Reserved</th>
                  <th className="px-5 py-3">Available</th>
                  <th className="px-5 py-3">Threshold</th>
                  <th className="px-5 py-3">Cost Price</th>
                  <th className="px-5 py-3">Stock Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {loading ? (
                  <tr><td colSpan={8} className="p-10 text-center text-gray-500">Loading inventory...</td></tr>
                ) : inventory.length === 0 ? (
                  <tr><td colSpan={8} className="p-10 text-center text-gray-500">No inventory records found.</td></tr>
                ) : inventory.map((item) => {
                  const product = productInfo(item.productId);
                  const warehouse = warehouseInfo(item.warehouseId);
                  const available = item.availableQuantity ?? item.quantity - item.reservedQuantity;
                  const cost = product.costPrice;
                  return (
                    <tr key={item._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-5 py-4">
                        <p className="font-medium text-gray-900 dark:text-white">{product.name ?? "Unknown product"}</p>
                        <p className="text-xs text-gray-500">{product.sku ?? "—"}</p>
                      </td>
                      <td className="px-5 py-4 text-gray-600 dark:text-gray-300">{warehouse.name ?? "—"}</td>
                      <td className="px-5 py-4 font-semibold">{item.quantity}</td>
                      <td className="px-5 py-4">{item.reservedQuantity}</td>
                      <td className="px-5 py-4 font-semibold">{available}</td>
                      <td className="px-5 py-4">{item.lowStockThreshold}</td>
                      <td className="px-5 py-4">{typeof cost === "number" ? money(cost) : "—"}</td>
                      <td className="px-5 py-4 font-semibold">{typeof cost === "number" ? money(item.quantity * cost) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "alerts" && (
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white">Low Stock & Out of Stock</h2>
              <p className="mt-1 text-xs text-gray-500">
                {alertSummary.totalAlerts} stock alerts
              </p>
            </div>
            <div className="flex gap-2 text-xs">
              <span className="rounded-full bg-amber-100 px-3 py-1 font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                Low: {alertSummary.lowStock}
              </span>
              <span className="rounded-full bg-red-100 px-3 py-1 font-semibold text-red-700 dark:bg-red-950 dark:text-red-300">
                Out: {alertSummary.outOfStock}
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800">
                <tr>
                  <th className="px-5 py-3">Product</th>
                  <th className="px-5 py-3">Warehouse</th>
                  <th className="px-5 py-3">Quantity</th>
                  <th className="px-5 py-3">Reserved</th>
                  <th className="px-5 py-3">Available</th>
                  <th className="px-5 py-3">Threshold</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {loading ? (
                  <tr><td colSpan={7} className="p-10 text-center text-gray-500">Loading alerts...</td></tr>
                ) : alerts.length === 0 ? (
                  <tr><td colSpan={7} className="p-10 text-center text-gray-500">No stock alerts found.</td></tr>
                ) : alerts.map((item) => {
                  const product = productInfo(item.productId);
                  const warehouse = warehouseInfo(item.warehouseId);
                  return (
                    <tr key={item._id}>
                      <td className="px-5 py-4">
                        <p className="font-medium text-gray-900 dark:text-white">{product.name ?? "Unknown product"}</p>
                        <p className="text-xs text-gray-500">{product.sku ?? "—"}</p>
                      </td>
                      <td className="px-5 py-4">{warehouse.name ?? "—"}</td>
                      <td className="px-5 py-4">{item.quantity}</td>
                      <td className="px-5 py-4">{item.reservedQuantity}</td>
                      <td className="px-5 py-4 font-semibold">{item.availableQuantity}</td>
                      <td className="px-5 py-4">{item.lowStockThreshold}</td>
                      <td className="px-5 py-4">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          item.stockStatus === "OUT_OF_STOCK"
                            ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                        }`}>
                          {item.stockStatus === "OUT_OF_STOCK" ? "OUT OF STOCK" : "LOW STOCK"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "movements" && (
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
            <h2 className="font-semibold text-gray-900 dark:text-white">Stock Movement History</h2>
            <p className="mt-1 text-xs text-gray-500">
              Stock in, stock out, adjustments and warehouse transfers.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800">
                <tr>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Product</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Warehouse</th>
                  <th className="px-5 py-3">Destination</th>
                  <th className="px-5 py-3">Quantity</th>
                  <th className="px-5 py-3">Before → After</th>
                  <th className="px-5 py-3">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {loading ? (
                  <tr><td colSpan={8} className="p-10 text-center text-gray-500">Loading movements...</td></tr>
                ) : movements.length === 0 ? (
                  <tr><td colSpan={8} className="p-10 text-center text-gray-500">No stock movements found.</td></tr>
                ) : movements.map((item) => {
                  const product = productInfo(item.productId);
                  const warehouse = warehouseInfo(item.warehouseId);
                  const destination = item.destinationWarehouseId
                    ? warehouseInfo(item.destinationWarehouseId)
                    : undefined;
                  const Icon = item.type === "IN"
                    ? ArrowDownToLine
                    : item.type === "OUT"
                      ? ArrowUpFromLine
                      : item.type === "TRANSFER"
                        ? ArrowLeftRight
                        : RefreshCw;
                  return (
                    <tr key={item._id}>
                      <td className="whitespace-nowrap px-5 py-4 text-gray-500">{dateTime(item.createdAt)}</td>
                      <td className="px-5 py-4">
                        <p className="font-medium text-gray-900 dark:text-white">{product.name ?? "Unknown product"}</p>
                        <p className="text-xs text-gray-500">{product.sku ?? "—"}</p>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold dark:bg-gray-800">
                          <Icon className="h-3.5 w-3.5" />{item.type}
                        </span>
                      </td>
                      <td className="px-5 py-4">{warehouse.name ?? "—"}</td>
                      <td className="px-5 py-4">{destination?.name ?? "—"}</td>
                      <td className="px-5 py-4 font-semibold">{item.quantity}</td>
                      <td className="px-5 py-4">{item.quantityBefore} → {item.quantityAfter}</td>
                      <td className="max-w-56 truncate px-5 py-4" title={item.reason}>{item.reason}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab !== "overview" && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-500">
            {total.toLocaleString()} records · Page {page} of {totalPages}
            {loading ? " · Loading..." : ""}
          </p>
          <div className="flex gap-2">
            <button
              disabled={page <= 1 || loading}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:opacity-40 dark:border-gray-700"
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </button>
            <button
              disabled={page >= totalPages || loading}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:opacity-40 dark:border-gray-700"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
