"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";

import { stockMovementsAdminApi } from "@/services/api/stock-movements-admin.api";
import { warehouseAdminApi } from "@/services/api/warehouse-admin.api";
import { productsAdminApi } from "@/services/api/products-admin.api";
import { productVariantsAdminApi } from "@/services/api/product-variants-admin.api";

import type {
  CreateStockMovementInput,
  StockMovement,
  StockMovementType,
} from "@/features/stock-movements/stock-movement.types";

import type { Warehouse } from "@/features/warehouses/warehouse.types";
import type { Product } from "@/features/products/product.types";
import type { ProductVariant } from "@/features/product-variants/variant.types";

type Notice = {
  type: "success" | "error";
  message: string;
};

type MovementForm = {
  productId: string;
  variantId: string;
  warehouseId: string;
  destinationWarehouseId: string;
  type: StockMovementType;
  quantity: string;
  reason: string;
  reference: string;
  referenceType: string;
};

const initialForm: MovementForm = {
  productId: "",
  variantId: "",
  warehouseId: "",
  destinationWarehouseId: "",
  type: "IN",
  quantity: "",
  reason: "",
  reference: "",
  referenceType: "",
};

const initialPagination = {
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0,
  hasNextPage: false,
  hasPreviousPage: false,
};

function getId(value: unknown): string {
  if (typeof value === "string") return value;

  if (value && typeof value === "object" && "_id" in value) {
    return String((value as { _id: unknown })._id);
  }

  return "";
}

function getName(value: unknown): string {
  if (typeof value === "string") return value;

  if (value && typeof value === "object") {
    if ("name" in value) return String(value.name ?? "Unknown");
    if ("title" in value) return String(value.title ?? "Unknown");
  }

  return "Unknown";
}

function getErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "response" in error) {
    const response = (
      error as {
        response?: {
          data?: {
            message?: string;
            errors?: Array<{ message?: string }>;
          };
        };
      }
    ).response;

    return (
      response?.data?.message ??
      response?.data?.errors?.[0]?.message ??
      "Something went wrong."
    );
  }

  if (error instanceof Error) return error.message;

  return "Something went wrong.";
}

function formatDate(value?: string) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function movementLabel(type: StockMovementType) {
  const labels: Record<StockMovementType, string> = {
    IN: "Stock In",
    OUT: "Stock Out",
    ADJUSTMENT: "Adjustment",
    TRANSFER: "Transfer",
  };

  return labels[type];
}

function movementColor(type: StockMovementType) {
  const colors: Record<StockMovementType, string> = {
    IN: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    OUT: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
    ADJUSTMENT:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    TRANSFER:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  };

  return colors[type];
}

function signedQuantity(movement: StockMovement) {
  if (movement.type === "OUT" || movement.type === "TRANSFER") {
    return `-${movement.quantity}`;
  }

  if (movement.type === "ADJUSTMENT") {
    return movement.quantity > 0
      ? `+${movement.quantity}`
      : String(movement.quantity);
  }

  return `+${movement.quantity}`;
}

export default function StockMovementsPage() {
  const [items, setItems] = useState<StockMovement[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [formVariants, setFormVariants] = useState<ProductVariant[]>([]);
  const [filterVariants, setFilterVariants] = useState<ProductVariant[]>([]);
  const [loadingVariants, setLoadingVariants] = useState(false);
  const formVariantRequest = useRef(0);
  const filterVariantRequest = useRef(0);

  const [loading, setLoading] = useState(true);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(initialPagination);

  const [typeFilter, setTypeFilter] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [variantFilter, setVariantFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const [showCreate, setShowCreate] = useState(false);
  const [selectedMovement, setSelectedMovement] =
    useState<StockMovement | null>(null);

  const [form, setForm] = useState<MovementForm>(initialForm);
  const [notice, setNotice] = useState<Notice | null>(null);

  const activeWarehouses = useMemo(
    () => warehouses.filter((warehouse) => warehouse.status === "ACTIVE"),
    [warehouses],
  );
  const selectedProduct = products.find(
    (product) => product._id === form.productId,
  );
  const selectedFilterProduct = products.find(
    (product) => product._id === productFilter,
  );

  const loadOptions = useCallback(async () => {
    setLoadingOptions(true);

    try {
      const [warehouseResult, productResult] = await Promise.all([
        warehouseAdminApi.list({
          page: 1,
          limit: 100,
          status: "ACTIVE",
          sortBy: "name",
          sortOrder: "asc",
        }),
        productsAdminApi.list({
          page: 1,
          limit: 100,
          sortBy: "name",
          sortOrder: "asc",
        }),
      ]);

      setWarehouses(warehouseResult.items);
      setProducts(
        productResult.items.filter(
          (product) =>
            product.status !== "ARCHIVED" &&
            (product.type === "VARIABLE" || product.trackInventory),
        ),
      );
    } catch (error) {
      setNotice({
        type: "error",
        message: `Could not load products or warehouses: ${getErrorMessage(error)}`,
      });
    } finally {
      setLoadingOptions(false);
    }
  }, []);

  const loadMovements = useCallback(async () => {
    setLoading(true);

    try {
      const result = await stockMovementsAdminApi.list({
        page,
        limit: 20,
        sortOrder,
        ...(typeFilter ? { type: typeFilter as StockMovementType } : {}),
        ...(warehouseFilter ? { warehouseId: warehouseFilter } : {}),
        ...(productFilter ? { productId: productFilter } : {}),
        ...(variantFilter ? { variantId: variantFilter } : {}),
        ...(fromDate
          ? { fromDate: new Date(`${fromDate}T00:00:00`).toISOString() }
          : {}),
        ...(toDate
          ? { toDate: new Date(`${toDate}T23:59:59.999`).toISOString() }
          : {}),
      });

      setItems(result.items);
      setPagination(result.pagination);
    } catch (error) {
      setNotice({
        type: "error",
        message: getErrorMessage(error),
      });
    } finally {
      setLoading(false);
    }
  }, [
    page,
    sortOrder,
    typeFilter,
    warehouseFilter,
    productFilter,
    variantFilter,
    fromDate,
    toDate,
  ]);

  useEffect(() => {
    void Promise.resolve().then(loadOptions);
  }, [loadOptions]);

  useEffect(() => {
    void Promise.resolve().then(loadMovements);
  }, [loadMovements]);

  useEffect(() => {
    if (!notice) return;

    const timeout = window.setTimeout(() => {
      setNotice(null);
    }, 5000);

    return () => window.clearTimeout(timeout);
  }, [notice]);

  const resetFilters = () => {
    filterVariantRequest.current += 1;
    setPage(1);
    setTypeFilter("");
    setWarehouseFilter("");
    setProductFilter("");
    setVariantFilter("");
    setFilterVariants([]);
    setFromDate("");
    setToDate("");
    setSortOrder("desc");
  };

  const openCreateModal = () => {
    formVariantRequest.current += 1;
    setLoadingVariants(false);
    setForm(initialForm);
    setFormVariants([]);
    setShowCreate(true);
  };

  const selectFilterProduct = async (productId: string) => {
    const requestId = ++filterVariantRequest.current;
    setProductFilter(productId);
    setVariantFilter("");
    setFilterVariants([]);
    setPage(1);

    const product = products.find((candidate) => candidate._id === productId);
    if (product?.type !== "VARIABLE") return;

    try {
      const result = await productVariantsAdminApi.getAll(productId, {
        page: 1,
        limit: 100,
        status: "ACTIVE",
      });
      if (requestId === filterVariantRequest.current) {
        setFilterVariants(
          result.items.filter((variant) => variant.trackInventory),
        );
      }
    } catch (error) {
      if (requestId === filterVariantRequest.current) {
        setNotice({
          type: "error",
          message: `Could not load product variants: ${getErrorMessage(error)}`,
        });
      }
    }
  };

  const selectFormProduct = async (productId: string) => {
    const requestId = ++formVariantRequest.current;
    setForm((current) => ({ ...current, productId, variantId: "" }));
    setFormVariants([]);
    setLoadingVariants(false);

    const product = products.find((candidate) => candidate._id === productId);
    if (product?.type !== "VARIABLE") return;

    setLoadingVariants(true);
    try {
      const result = await productVariantsAdminApi.getAll(productId, {
        page: 1,
        limit: 100,
        status: "ACTIVE",
      });
      if (requestId === formVariantRequest.current) {
        setFormVariants(
          result.items.filter((variant) => variant.trackInventory),
        );
      }
    } catch (error) {
      if (requestId === formVariantRequest.current) {
        setNotice({
          type: "error",
          message: `Could not load product variants: ${getErrorMessage(error)}`,
        });
      }
    } finally {
      if (requestId === formVariantRequest.current) {
        setLoadingVariants(false);
      }
    }
  };

  const submitMovement = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const quantity = Number(form.quantity);

    if (
      !form.productId ||
      !form.warehouseId ||
      (selectedProduct?.type === "VARIABLE" && !form.variantId)
    ) {
      setNotice({
        type: "error",
        message:
          selectedProduct?.type === "VARIABLE"
            ? "Select a product, variant, and warehouse."
            : "Select a product and warehouse.",
      });
      return;
    }

    if (
      selectedProduct?.type === "VARIABLE" &&
      !formVariants.find((variant) => variant._id === form.variantId)
        ?.trackInventory
    ) {
      setNotice({
        type: "error",
        message: "Inventory tracking is disabled for this product variant.",
      });
      return;
    }

    if (!Number.isSafeInteger(quantity) || quantity === 0) {
      setNotice({
        type: "error",
        message: "Enter a valid non-zero integer quantity.",
      });
      return;
    }

    if (form.type !== "ADJUSTMENT" && quantity < 0) {
      setNotice({
        type: "error",
        message: "Only adjustments can use a negative quantity.",
      });
      return;
    }

    if (
      form.type === "TRANSFER" &&
      (!form.destinationWarehouseId ||
        form.destinationWarehouseId === form.warehouseId)
    ) {
      setNotice({
        type: "error",
        message: "Choose a different destination warehouse.",
      });
      return;
    }

    if (form.reason.trim().length < 3) {
      setNotice({
        type: "error",
        message: "Reason must contain at least 3 characters.",
      });
      return;
    }

    const input: CreateStockMovementInput = {
      productId: form.productId,
      ...(form.variantId ? { variantId: form.variantId } : {}),
      warehouseId: form.warehouseId,
      type: form.type,
      quantity,
      reason: form.reason.trim(),
      ...(form.type === "TRANSFER"
        ? { destinationWarehouseId: form.destinationWarehouseId }
        : {}),
      ...(form.reference.trim() ? { reference: form.reference.trim() } : {}),
      ...(form.referenceType.trim()
        ? { referenceType: form.referenceType.trim() }
        : {}),
      idempotencyKey: `noptrix-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`,
    };

    setSubmitting(true);

    try {
      await stockMovementsAdminApi.create(input);

      setShowCreate(false);
      setForm(initialForm);
      setPage(1);

      setNotice({
        type: "success",
        message: "Stock movement recorded successfully.",
      });

      if (page === 1) {
        await loadMovements();
      }
    } catch (error) {
      setNotice({
        type: "error",
        message: getErrorMessage(error),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const openDetails = async (movement: StockMovement) => {
    setSelectedMovement(movement);

    try {
      const latest = await stockMovementsAdminApi.get(movement._id);
      setSelectedMovement(latest);
    } catch {
      // Keep the already loaded list item available.
    }
  };

  const totalVisible = items.length;

  const inCount = items.filter((item) => item.type === "IN").length;
  const outCount = items.filter((item) => item.type === "OUT").length;
  const transferCount = items.filter((item) => item.type === "TRANSFER").length;

  const updateForm = <K extends keyof MovementForm>(
    key: K,
    value: MovementForm[K],
  ) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  return (
    <div className="min-h-screen space-y-6 bg-gray-50 p-4 text-gray-900 dark:bg-gray-950 dark:text-white sm:p-6 lg:p-8">
      {/* HEADER */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <span>Admin</span>
            <span>/</span>
            <span>Inventory</span>
            <span>/</span>
            <span className="text-gray-900 dark:text-white">
              Stock Movements
            </span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Stock Movements
          </h1>

          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Track incoming, outgoing, adjusted and transferred stock.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void loadMovements()}
            disabled={loading}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-gray-100 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800"
          >
            {loading ? "Refreshing..." : "↻ Refresh"}
          </button>

          <button
            type="button"
            onClick={openCreateModal}
            disabled={loadingOptions}
            className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
          >
            + Record Movement
          </button>
        </div>
      </div>

      {/* NOTIFICATION */}
      {notice && (
        <div
          role="alert"
          className={`flex items-start justify-between gap-3 rounded-xl border p-4 text-sm ${
            notice.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
          }`}
        >
          <span>{notice.message}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Dismiss notification"
          >
            ✕
          </button>
        </div>
      )}

      {/* SUMMARY */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Records on this page"
          value={totalVisible}
          description={`Page ${pagination.page} of ${pagination.totalPages || 1}`}
          symbol="▤"
        />

        <SummaryCard
          title="Stock In"
          value={inCount}
          description="Visible records"
          symbol="↗"
          color="text-emerald-600"
        />

        <SummaryCard
          title="Stock Out"
          value={outCount}
          description="Visible records"
          symbol="↘"
          color="text-rose-600"
        />

        <SummaryCard
          title="Transfers"
          value={transferCount}
          description="Visible records"
          symbol="⇄"
          color="text-blue-600"
        />
      </div>

      {/* FILTERS */}
      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold">Filters</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Narrow down your stock movement history.
            </p>
          </div>

          <button
            type="button"
            onClick={resetFilters}
            className="text-sm font-semibold text-blue-600 hover:text-blue-700"
          >
            Reset filters
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <FilterField label="Movement type">
            <select
              value={typeFilter}
              onChange={(event) => {
                setTypeFilter(event.target.value);
                setPage(1);
              }}
              className="input-field"
            >
              <option value="">All movement types</option>
              <option value="IN">Stock In</option>
              <option value="OUT">Stock Out</option>
              <option value="ADJUSTMENT">Adjustment</option>
              <option value="TRANSFER">Transfer</option>
            </select>
          </FilterField>

          <FilterField label="Product">
            <select
              value={productFilter}
              onChange={(event) => void selectFilterProduct(event.target.value)}
              className="input-field"
            >
              <option value="">All products</option>
              {products.map((product) => (
                <option key={product._id} value={product._id}>
                  {product.name}
                  {product.sku ? ` (${product.sku})` : ""}
                </option>
              ))}
            </select>
          </FilterField>

          {selectedFilterProduct?.type === "VARIABLE" && (
            <FilterField label="Variant">
              <select
                value={variantFilter}
                onChange={(event) => {
                  setVariantFilter(event.target.value);
                  setPage(1);
                }}
                className="input-field"
              >
                <option value="">All variants</option>
                {filterVariants.map((variant) => (
                  <option key={variant._id} value={variant._id}>
                    {variant.title}
                    {variant.sku ? ` (${variant.sku})` : ""}
                  </option>
                ))}
              </select>
            </FilterField>
          )}

          <FilterField label="Warehouse">
            <select
              value={warehouseFilter}
              onChange={(event) => {
                setWarehouseFilter(event.target.value);
                setPage(1);
              }}
              className="input-field"
            >
              <option value="">All warehouses</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse._id} value={warehouse._id}>
                  {warehouse.name} ({warehouse.code})
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField label="From date">
            <input
              type="date"
              value={fromDate}
              onChange={(event) => {
                setFromDate(event.target.value);
                setPage(1);
              }}
              className="input-field"
            />
          </FilterField>

          <FilterField label="To date">
            <input
              type="date"
              value={toDate}
              min={fromDate || undefined}
              onChange={(event) => {
                setToDate(event.target.value);
                setPage(1);
              }}
              className="input-field"
            />
          </FilterField>

          <FilterField label="Sort order">
            <select
              value={sortOrder}
              onChange={(event) => {
                setSortOrder(event.target.value as "asc" | "desc");
                setPage(1);
              }}
              className="input-field"
            >
              <option value="desc">Newest first</option>
              <option value="asc">Oldest first</option>
            </select>
          </FilterField>
        </div>
      </section>

      {/* TABLE */}
      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 p-4 dark:border-gray-800">
          <div>
            <h2 className="font-semibold">Movement History</h2>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {pagination.total.toLocaleString()} total records
            </p>
          </div>

          <span className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
            {loading ? "Loading..." : `${items.length} displayed`}
          </span>
        </div>

        {loading ? (
          <div className="space-y-4 p-6">
            {[1, 2, 3, 4, 5].map((item) => (
              <div
                key={item}
                className="h-12 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800"
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mb-3 text-4xl text-gray-300">▤</div>
            <h3 className="font-semibold">No stock movements found</h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Try changing your filters or record a new stock movement.
            </p>

            <button
              type="button"
              onClick={openCreateModal}
              className="mt-5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Record Movement
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:bg-gray-800/70 dark:text-gray-400">
                  <tr>
                    <th className="px-5 py-4">Movement</th>
                    <th className="px-5 py-4">Product</th>
                    <th className="px-5 py-4">Warehouse</th>
                    <th className="px-5 py-4">Quantity</th>
                    <th className="px-5 py-4">Stock change</th>
                    <th className="px-5 py-4">Reason</th>
                    <th className="px-5 py-4">Date</th>
                    <th className="px-5 py-4 text-right">Action</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {items.map((movement) => (
                    <tr
                      key={movement._id}
                      className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    >
                      <td className="px-5 py-4">
                        <div className="flex flex-col items-start gap-1.5">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${movementColor(movement.type)}`}
                          >
                            {movementLabel(movement.type)}
                          </span>
                          <span className="font-mono text-[10px] text-gray-400">
                            {movement._id.slice(-8).toUpperCase()}
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <p className="font-medium">
                          {getName(movement.productId)}
                        </p>
                        {movement.variantId && (
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Variant: {getName(movement.variantId)}
                          </p>
                        )}
                        <p className="mt-1 text-xs text-gray-500">
                          {typeof movement.productId === "object"
                            ? movement.productId.sku ||
                              getId(movement.productId)
                            : movement.productId}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <p>{getName(movement.warehouseId)}</p>

                        {movement.type === "TRANSFER" && (
                          <p className="mt-1 text-xs text-blue-600">
                            → {getName(movement.destinationWarehouseId)}
                          </p>
                        )}
                      </td>

                      <td className="px-5 py-4 font-semibold tabular-nums">
                        {movement.quantity.toLocaleString()}
                      </td>

                      <td className="px-5 py-4">
                        <div className="font-semibold tabular-nums">
                          <span
                            className={
                              movement.type === "OUT"
                                ? "text-rose-600"
                                : movement.type === "IN"
                                  ? "text-emerald-600"
                                  : movement.type === "TRANSFER"
                                    ? "text-blue-600"
                                    : "text-amber-600"
                            }
                          >
                            {signedQuantity(movement)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-gray-500">
                          {movement.quantityBefore} → {movement.quantityAfter}
                        </p>
                      </td>

                      <td className="max-w-[180px] px-5 py-4">
                        <p className="truncate" title={movement.reason}>
                          {movement.reason}
                        </p>
                        {movement.reference && (
                          <p className="mt-1 truncate text-xs text-gray-500">
                            Ref: {movement.reference}
                          </p>
                        )}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-gray-500">
                        {formatDate(movement.createdAt)}
                      </td>

                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => void openDetails(movement)}
                          className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* PAGINATION */}
            <div className="flex flex-col justify-between gap-3 border-t border-gray-200 p-4 dark:border-gray-800 sm:flex-row sm:items-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Showing{" "}
                {pagination.total === 0 ? 0 : (page - 1) * pagination.limit + 1}
                {" – "}
                {Math.min(page * pagination.limit, pagination.total)}
                {" of "}
                {pagination.total}
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!pagination.hasPreviousPage || loading}
                  onClick={() => setPage((current) => current - 1)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700"
                >
                  Previous
                </button>

                <span className="px-2 text-sm text-gray-500">
                  {pagination.page} / {Math.max(1, pagination.totalPages)}
                </span>

                <button
                  type="button"
                  disabled={!pagination.hasNextPage || loading}
                  onClick={() => setPage((current) => current + 1)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {/* CREATE MOVEMENT MODAL */}
      {showCreate && (
        <Modal
          title="Record Stock Movement"
          subtitle="Create a stock transaction in your inventory."
          onClose={() => !submitting && setShowCreate(false)}
        >
          <form onSubmit={submitMovement} className="space-y-5">
            <div>
              <label className="form-label">Movement type *</label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(
                  ["IN", "OUT", "ADJUSTMENT", "TRANSFER"] as StockMovementType[]
                ).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      updateForm("type", type);
                      if (type !== "TRANSFER") {
                        updateForm("destinationWarehouseId", "");
                      }
                    }}
                    className={`rounded-lg border p-3 text-center text-xs font-semibold transition ${
                      form.type === type
                        ? "border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                        : "border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                    }`}
                  >
                    {movementLabel(type)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="form-label">Product *</label>
              <select
                required
                value={form.productId}
                onChange={(event) => void selectFormProduct(event.target.value)}
                className="input-field"
              >
                <option value="">Select product</option>
                {products.map((product) => (
                  <option key={product._id} value={product._id}>
                    {product.name}
                    {product.sku ? ` — ${product.sku}` : ""}
                  </option>
                ))}
              </select>
              {products.length === 0 && !loadingOptions && (
                <p className="mt-1 text-xs text-amber-600">
                  No inventory-tracked products are available for stock
                  movement.
                </p>
              )}
            </div>

            {selectedProduct?.type === "VARIABLE" && (
              <div>
                <label className="form-label">Product variant *</label>
                <select
                  required
                  value={form.variantId}
                  onChange={(event) =>
                    updateForm("variantId", event.target.value)
                  }
                  disabled={loadingVariants || formVariants.length === 0}
                  className="input-field"
                >
                  <option value="">
                    {loadingVariants
                      ? "Loading variants..."
                      : formVariants.length
                        ? "Select variant"
                        : "No active variants available"}
                  </option>
                  {formVariants.map((variant) => (
                    <option key={variant._id} value={variant._id}>
                      {variant.title}
                      {variant.sku ? ` — ${variant.sku}` : ""}
                      {!variant.trackInventory
                        ? " (inventory tracking disabled)"
                        : ""}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Select the exact size, color, or SKU whose stock is changing.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="form-label">
                  {form.type === "TRANSFER"
                    ? "Source warehouse *"
                    : "Warehouse *"}
                </label>
                <select
                  required
                  value={form.warehouseId}
                  onChange={(event) =>
                    updateForm("warehouseId", event.target.value)
                  }
                  className="input-field"
                >
                  <option value="">Select warehouse</option>
                  {activeWarehouses.map((warehouse) => (
                    <option key={warehouse._id} value={warehouse._id}>
                      {warehouse.name} ({warehouse.code})
                    </option>
                  ))}
                </select>
              </div>

              {form.type === "TRANSFER" && (
                <div>
                  <label className="form-label">Destination warehouse *</label>
                  <select
                    required
                    value={form.destinationWarehouseId}
                    onChange={(event) =>
                      updateForm("destinationWarehouseId", event.target.value)
                    }
                    className="input-field"
                  >
                    <option value="">Select destination</option>
                    {activeWarehouses
                      .filter((warehouse) => warehouse._id !== form.warehouseId)
                      .map((warehouse) => (
                        <option key={warehouse._id} value={warehouse._id}>
                          {warehouse.name} ({warehouse.code})
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </div>

            <div>
              <label className="form-label">
                Quantity *{" "}
                {form.type === "ADJUSTMENT" && (
                  <span className="font-normal text-gray-500">
                    (use negative value to decrease stock)
                  </span>
                )}
              </label>
              <input
                required
                type="number"
                step="1"
                min={form.type === "ADJUSTMENT" ? undefined : 1}
                value={form.quantity}
                onChange={(event) => updateForm("quantity", event.target.value)}
                placeholder={
                  form.type === "ADJUSTMENT" ? "e.g. -5 or 10" : "e.g. 25"
                }
                className="input-field"
              />
            </div>

            <div>
              <label className="form-label">Reason *</label>
              <textarea
                required
                minLength={3}
                maxLength={500}
                rows={3}
                value={form.reason}
                onChange={(event) => updateForm("reason", event.target.value)}
                placeholder="Explain why this stock movement is being recorded..."
                className="input-field resize-y"
              />
              <p className="mt-1 text-right text-xs text-gray-400">
                {form.reason.length}/500
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="form-label">Reference</label>
                <input
                  maxLength={120}
                  value={form.reference}
                  onChange={(event) =>
                    updateForm("reference", event.target.value)
                  }
                  placeholder="Purchase order / invoice"
                  className="input-field"
                />
              </div>

              <div>
                <label className="form-label">Reference type</label>
                <input
                  maxLength={60}
                  value={form.referenceType}
                  onChange={(event) =>
                    updateForm("referenceType", event.target.value)
                  }
                  placeholder="PURCHASE / RETURN / MANUAL"
                  className="input-field"
                />
              </div>
            </div>

            <div className="rounded-lg bg-gray-50 p-3 text-xs leading-5 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
              {form.type === "IN" &&
                "Stock In increases the selected warehouse quantity."}
              {form.type === "OUT" &&
                "Stock Out decreases available stock. Reserved quantities are protected."}
              {form.type === "ADJUSTMENT" &&
                "Positive adjustment increases stock. Negative adjustment decreases stock."}
              {form.type === "TRANSFER" &&
                "Stock will be moved atomically from the source warehouse to the destination warehouse."}
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-gray-200 pt-4 dark:border-gray-700 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setShowCreate(false)}
                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-800"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={
                  submitting ||
                  loadingOptions ||
                  products.length === 0 ||
                  activeWarehouses.length === 0
                }
                className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? "Recording..." : "Record Movement"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* DETAILS MODAL */}
      {selectedMovement && (
        <Modal
          title="Movement Details"
          subtitle={`Transaction ID: ${selectedMovement._id}`}
          onClose={() => setSelectedMovement(null)}
        >
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span
                className={`rounded-full px-3 py-1.5 text-sm font-semibold ${movementColor(selectedMovement.type)}`}
              >
                {movementLabel(selectedMovement.type)}
              </span>

              <span className="text-sm text-gray-500">
                {formatDate(selectedMovement.createdAt)}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DetailField
                label="Product"
                value={getName(selectedMovement.productId)}
              />
              {selectedMovement.variantId && (
                <DetailField
                  label="Variant / SKU"
                  value={`${getName(selectedMovement.variantId)}${
                    typeof selectedMovement.variantId === "object" &&
                    selectedMovement.variantId.sku
                      ? ` (${selectedMovement.variantId.sku})`
                      : ""
                  }`}
                />
              )}
              <DetailField
                label="Quantity"
                value={selectedMovement.quantity.toLocaleString()}
              />
              <DetailField
                label="Source warehouse"
                value={getName(selectedMovement.warehouseId)}
              />
              <DetailField
                label="Destination warehouse"
                value={
                  selectedMovement.destinationWarehouseId
                    ? getName(selectedMovement.destinationWarehouseId)
                    : "—"
                }
              />
              <DetailField
                label="Stock before"
                value={selectedMovement.quantityBefore.toLocaleString()}
              />
              <DetailField
                label="Stock after"
                value={selectedMovement.quantityAfter.toLocaleString()}
              />
              {selectedMovement.type === "TRANSFER" && (
                <>
                  <DetailField
                    label="Destination stock before"
                    value={String(
                      selectedMovement.destinationQuantityBefore ?? "—",
                    )}
                  />
                  <DetailField
                    label="Destination stock after"
                    value={String(
                      selectedMovement.destinationQuantityAfter ?? "—",
                    )}
                  />
                </>
              )}
              <DetailField
                label="Reference"
                value={selectedMovement.reference || "—"}
              />
              <DetailField
                label="Reference type"
                value={selectedMovement.referenceType || "—"}
              />
              <DetailField
                label="Created by"
                value={getName(selectedMovement.createdBy)}
              />
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Reason
              </p>
              <div className="rounded-lg bg-gray-50 p-4 text-sm dark:bg-gray-800">
                {selectedMovement.reason}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedMovement(null)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              Close
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function SummaryCard({
  title,
  value,
  description,
  symbol,
  color = "text-gray-700 dark:text-gray-200",
}: {
  title: string;
  value: number;
  description: string;
  symbol: string;
  color?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
          <p className={`mt-3 text-3xl font-bold tabular-nums ${color}`}>
            {value.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-gray-400">{description}</p>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-xl dark:bg-gray-800">
          {symbol}
        </span>
      </div>
    </div>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-400">
        {label}
      </label>
      {children}
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-100 p-3 dark:border-gray-800">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold">{value}</p>
    </div>
  );
}

function Modal({
  title,
  subtitle,
  children,
  onClose,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-3 backdrop-blur-sm sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="my-auto max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div>
            <h2 className="text-lg font-bold">{title}</h2>
            {subtitle && (
              <p className="mt-1 break-all text-xs text-gray-500">{subtitle}</p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-lg px-2 py-1 text-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            ×
          </button>
        </div>

        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
