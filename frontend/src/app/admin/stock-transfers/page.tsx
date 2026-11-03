"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { productsAdminApi } from "@/services/api/products-admin.api";
import { warehouseAdminApi } from "@/services/api/warehouse-admin.api";
import { stockTransfersAdminApi } from "@/services/api/stock-transfers-admin.api";
import { productVariantsAdminApi } from "@/services/api/product-variants-admin.api";
import type { ProductVariant } from "@/features/product-variants/variant.types";
import type { Product } from "@/features/products/product.types";

import type {
  CreateStockTransferInput,
  StockTransfer,
  StockTransferAction,
  StockTransferFilters,
  StockTransferStatus,
} from "@/features/stock-transfers/stock-transfer.types";

type Option = {
  _id: string;
  name: string;
  sku?: string;
  code?: string;
  type?: Product["type"];
  trackInventory?: boolean;
};

const statuses: StockTransferStatus[] = [
  "DRAFT",
  "APPROVED",
  "DISPATCHED",
  "RECEIVED",
  "REJECTED",
  "CANCELLED",
];

const statusStyle: Record<StockTransferStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  APPROVED: "bg-blue-100 text-blue-700",
  DISPATCHED: "bg-amber-100 text-amber-700",
  RECEIVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-700",
  CANCELLED: "bg-gray-200 text-gray-700",
};

function getName(value: unknown): string {
  if (!value) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "object" && "name" in value) {
    return String((value as { name?: string }).name ?? "—");
  }
  if (typeof value === "object" && "title" in value) {
    return String((value as { title?: string }).title ?? "—");
  }
  return "—";
}

function formatDate(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function StatusBadge({ status }: { status: StockTransferStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle[status]}`}
    >
      {status}
    </span>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl dark:bg-gray-900">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1 text-xl hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function StockTransfersPage() {
  const [items, setItems] = useState<StockTransfer[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  });

  const [products, setProducts] = useState<Option[]>([]);
  const [warehouses, setWarehouses] = useState<Option[]>([]);
  const [variantsByProduct, setVariantsByProduct] = useState<
    Record<string, ProductVariant[]>
  >({});

  const [loading, setLoading] = useState(true);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [status, setStatus] = useState("");
  const [productId, setProductId] = useState("");
  const [sourceWarehouseId, setSourceWarehouseId] = useState("");
  const [destinationWarehouseId, setDestinationWarehouseId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);

  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<StockTransfer | null>(null);
  const [actionTarget, setActionTarget] = useState<{
    transfer: StockTransfer;
    action: StockTransferAction;
  } | null>(null);
  const [actionNote, setActionNote] = useState("");

  const [form, setForm] = useState({
    productId: "",
    variantId: "",
    sourceWarehouseId: "",
    destinationWarehouseId: "",
    quantity: "1",
    reason: "",
    referenceType: "",
    referenceId: "",
  });

  const filters = useMemo<StockTransferFilters>(
    () => ({
      page,
      limit: 20,
      sortOrder: "desc",
      ...(status ? { status: status as StockTransferStatus } : {}),
      ...(productId ? { productId } : {}),
      ...(sourceWarehouseId ? { sourceWarehouseId } : {}),
      ...(destinationWarehouseId ? { destinationWarehouseId } : {}),
      ...(fromDate
        ? { fromDate: new Date(`${fromDate}T00:00:00`).toISOString() }
        : {}),
      ...(toDate
        ? { toDate: new Date(`${toDate}T23:59:59.999`).toISOString() }
        : {}),
    }),
    [
      page,
      status,
      productId,
      sourceWarehouseId,
      destinationWarehouseId,
      fromDate,
      toDate,
    ],
  );

  const loadTransfers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await stockTransfersAdminApi.list(filters);
      setItems(result.items);
      setPagination(result.pagination);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load stock transfers.",
      );
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const loadOptions = useCallback(async () => {
    setOptionsLoading(true);

    try {
      const [productResult, warehouseResult] = await Promise.all([
        productsAdminApi.list({
          page: 1,
          limit: 100,
          status: "ACTIVE",
          sortBy: "name",
          sortOrder: "asc",
        }),
        warehouseAdminApi.list({
          page: 1,
          limit: 100,
          status: "ACTIVE",
          sortBy: "name",
          sortOrder: "asc",
        }),
      ]);

      const loadedProducts = productResult.items ?? [];
      setProducts(
        loadedProducts
          .filter((item) => item.type === "VARIABLE" || item.trackInventory)
          .map((item) => ({
            _id: item._id,
            name: item.name,
            sku: item.sku,
            type: item.type,
            trackInventory: item.trackInventory,
          })),
      );
      const variableProducts = loadedProducts.filter(
        (product) => product.type === "VARIABLE",
      );
      const variantResults = await Promise.allSettled(
        variableProducts.map(async (product) => ({
          productId: product._id,
          variants: (
            await productVariantsAdminApi.getAll(product._id, {
              page: 1,
              limit: 100,
              status: "ACTIVE",
            })
          ).items.filter((variant) => variant.trackInventory),
        })),
      );
      setVariantsByProduct(
        Object.fromEntries(
          variantResults.flatMap((result) =>
            result.status === "fulfilled"
              ? [[result.value.productId, result.value.variants]]
              : [],
          ),
        ),
      );
      const variantFailures = variantResults.flatMap((result, index) =>
        result.status === "rejected"
          ? [
              `Variants for ${variableProducts[index]?.name ?? "product"}: ${result.reason instanceof Error ? result.reason.message : "Could not load variants."}`,
            ]
          : [],
      );
      if (variantFailures.length) setError(variantFailures.join(" • "));

      setWarehouses(
        (warehouseResult.items ?? []).map((item) => ({
          _id: item._id,
          name: item.name,
          code: item.code,
        })),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load form options.",
      );
    } finally {
      setOptionsLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadOptions);
  }, [loadOptions]);

  useEffect(() => {
    void Promise.resolve().then(loadTransfers);
  }, [loadTransfers]);

  const refresh = async () => {
    await loadTransfers();
  };

  const updateForm = (key: string, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const createTransfer = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    const selectedProduct = products.find(
      (product) => product._id === form.productId,
    );
    if (
      !form.productId ||
      !form.sourceWarehouseId ||
      !form.destinationWarehouseId ||
      (selectedProduct?.type === "VARIABLE" && !form.variantId)
    ) {
      setError(
        "Select a product, its variant if required, and source/destination warehouses.",
      );
      return;
    }

    if (
      selectedProduct?.type !== "VARIABLE" &&
      selectedProduct?.trackInventory === false
    ) {
      setError("Inventory tracking is disabled for this product.");
      return;
    }

    if (
      selectedProduct?.type === "VARIABLE" &&
      !(variantsByProduct[form.productId] ?? []).some(
        (variant) => variant._id === form.variantId && variant.trackInventory,
      )
    ) {
      setError("Select an active variant with inventory tracking enabled.");
      return;
    }

    if (form.sourceWarehouseId === form.destinationWarehouseId) {
      setError("Source and destination warehouses must be different.");
      return;
    }

    const quantity = Number(form.quantity);

    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      setError("Quantity must be a positive whole number.");
      return;
    }

    if (form.reason.trim().length < 3 || form.reason.trim().length > 500) {
      setError("Reason must contain 3–500 characters.");
      return;
    }

    if (
      form.referenceType.trim().length > 60 ||
      (form.referenceId.trim() &&
        !/^[a-f\d]{24}$/i.test(form.referenceId.trim()))
    ) {
      setError(
        "Reference type must be at most 60 characters and reference ID must be a valid MongoDB ID.",
      );
      return;
    }

    const input: CreateStockTransferInput = {
      productId: form.productId,
      ...(form.variantId ? { variantId: form.variantId } : {}),
      sourceWarehouseId: form.sourceWarehouseId,
      destinationWarehouseId: form.destinationWarehouseId,
      quantity,
      reason: form.reason.trim(),
      ...(form.referenceType.trim()
        ? { referenceType: form.referenceType.trim() }
        : {}),
      ...(form.referenceId.trim()
        ? { referenceId: form.referenceId.trim() }
        : {}),
    };

    setSubmitting(true);

    try {
      await stockTransfersAdminApi.create(input);
      setShowCreate(false);
      setForm({
        productId: "",
        variantId: "",
        sourceWarehouseId: "",
        destinationWarehouseId: "",
        quantity: "1",
        reason: "",
        referenceType: "",
        referenceId: "",
      });
      setPage(1);
      setSuccess("Stock transfer created successfully.");
      await loadTransfers();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not create stock transfer.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const openDetails = async (transfer: StockTransfer) => {
    setError("");

    try {
      const latest = await stockTransfersAdminApi.get(transfer._id);
      setSelected(latest);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load transfer details.",
      );
    }
  };

  const performAction = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!actionTarget) return;

    const { transfer, action } = actionTarget;
    const note = actionNote.trim();

    if ((action === "reject" || action === "cancel") && !note) {
      setError("A reason is required for rejection and cancellation.");
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const updated = await stockTransfersAdminApi.action(
        transfer._id,
        action,
        { ...(note ? { note } : {}) },
      );

      setActionTarget(null);
      setActionNote("");
      setSelected(updated);
      setSuccess(`Transfer ${action} completed successfully.`);
      await loadTransfers();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : `Could not ${action} transfer.`,
      );
    } finally {
      setSubmitting(false);
    }
  };

  const actionButtons = (transfer: StockTransfer) => {
    const buttons: { action: StockTransferAction; label: string }[] = [];

    if (transfer.status === "DRAFT") {
      buttons.push(
        { action: "approve", label: "Approve" },
        { action: "reject", label: "Reject" },
        { action: "cancel", label: "Cancel" },
      );
    }

    if (transfer.status === "APPROVED") {
      buttons.push(
        { action: "dispatch", label: "Dispatch" },
        { action: "cancel", label: "Cancel" },
      );
    }

    if (transfer.status === "DISPATCHED") {
      buttons.push({ action: "receive", label: "Receive" });
    }

    return buttons;
  };

  const summary = useMemo(
    () => ({
      draft: items.filter((item) => item.status === "DRAFT").length,
      approved: items.filter((item) => item.status === "APPROVED").length,
      dispatched: items.filter((item) => item.status === "DISPATCHED").length,
      received: items.filter((item) => item.status === "RECEIVED").length,
    }),
    [items],
  );

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold">Stock Transfers</h1>
          <p className="mt-1 text-sm text-gray-500">
            Move inventory between warehouses and track every transfer.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            + New Transfer
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={() => setError("")} type="button">
            ×
          </button>
        </div>
      )}

      {success && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          <span>{success}</span>
          <button onClick={() => setSuccess("")} type="button">
            ×
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Draft", summary.draft],
          ["Approved", summary.approved],
          ["Dispatched", summary.dispatched],
          ["Received", summary.received],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-xl border bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
          >
            <p className="text-sm text-gray-500">{label}</p>
            <p className="mt-2 text-2xl font-bold">{value}</p>
            <p className="text-xs text-gray-400">On this page</p>
          </div>
        ))}
      </div>

      <section className="rounded-xl border bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Filters</h2>
          <button
            type="button"
            onClick={() => {
              setStatus("");
              setProductId("");
              setSourceWarehouseId("");
              setDestinationWarehouseId("");
              setFromDate("");
              setToDate("");
              setPage(1);
            }}
            className="text-sm text-blue-600 hover:underline"
          >
            Clear filters
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border bg-transparent px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            {statuses.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>

          <select
            value={productId}
            onChange={(e) => {
              setProductId(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border bg-transparent px-3 py-2 text-sm"
          >
            <option value="">All products</option>
            {products.map((item) => (
              <option key={item._id} value={item._id}>
                {item.name}
                {item.sku ? ` (${item.sku})` : ""}
              </option>
            ))}
          </select>

          <select
            value={sourceWarehouseId}
            onChange={(e) => {
              setSourceWarehouseId(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border bg-transparent px-3 py-2 text-sm"
          >
            <option value="">All source warehouses</option>
            {warehouses.map((item) => (
              <option key={item._id} value={item._id}>
                {item.name}
              </option>
            ))}
          </select>

          <select
            value={destinationWarehouseId}
            onChange={(e) => {
              setDestinationWarehouseId(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border bg-transparent px-3 py-2 text-sm"
          >
            <option value="">All destination warehouses</option>
            {warehouses.map((item) => (
              <option key={item._id} value={item._id}>
                {item.name}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={fromDate}
            onChange={(e) => {
              setFromDate(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border bg-transparent px-3 py-2 text-sm"
            aria-label="From date"
          />

          <input
            type="date"
            value={toDate}
            min={fromDate || undefined}
            onChange={(e) => {
              setToDate(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border bg-transparent px-3 py-2 text-sm"
            aria-label="To date"
          />
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between border-b p-4 dark:border-gray-800">
          <h2 className="font-semibold">Transfer history</h2>
          <span className="text-sm text-gray-500">
            {pagination.total} total transfers
          </span>
        </div>

        {loading ? (
          <div className="space-y-3 p-6">
            {[1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="h-12 animate-pulse rounded bg-gray-100 dark:bg-gray-800"
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center">
            <p className="font-semibold">No stock transfers found</p>
            <p className="mt-1 text-sm text-gray-500">
              Create a transfer or change your filters.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-3">Transfer</th>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Destination</th>
                    <th className="px-4 py-3">Quantity</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-gray-800">
                  {items.map((transfer) => (
                    <tr
                      key={transfer._id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    >
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => void openDetails(transfer)}
                          className="font-semibold text-blue-600 hover:underline"
                        >
                          {transfer.transferNumber}
                        </button>
                        <p className="mt-1 max-w-40 truncate text-xs text-gray-500">
                          {transfer.reason}
                        </p>
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {getName(transfer.productId)}
                        {transfer.variantId && (
                          <p className="text-xs text-gray-500">
                            {getName(transfer.variantId)}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {getName(transfer.sourceWarehouseId)}
                      </td>
                      <td className="px-4 py-3">
                        {getName(transfer.destinationWarehouseId)}
                      </td>
                      <td className="px-4 py-3 font-semibold tabular-nums">
                        {transfer.quantity}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={transfer.status} />
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {formatDate(transfer.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          <button
                            type="button"
                            onClick={() => void openDetails(transfer)}
                            className="rounded border px-2 py-1 text-xs hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            Details
                          </button>
                          {actionButtons(transfer).map(({ action, label }) => (
                            <button
                              type="button"
                              key={action}
                              onClick={() => {
                                setActionNote("");
                                setActionTarget({ transfer, action });
                              }}
                              className="rounded border border-blue-200 px-2 py-1 text-xs text-blue-700 hover:bg-blue-50"
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col items-center justify-between gap-3 border-t p-4 sm:flex-row dark:border-gray-800">
              <p className="text-sm text-gray-500">
                Page {pagination.page} of {Math.max(1, pagination.totalPages)}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!pagination.hasPreviousPage}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  className="rounded-lg border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={!pagination.hasNextPage}
                  onClick={() => setPage((current) => current + 1)}
                  className="rounded-lg border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {showCreate && (
        <Modal
          title="Create stock transfer"
          onClose={() => setShowCreate(false)}
        >
          <form onSubmit={createTransfer} className="space-y-4">
            {optionsLoading ? (
              <p className="text-sm text-gray-500">
                Loading products and warehouses…
              </p>
            ) : (
              <>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Product *
                  </label>
                  <select
                    required
                    value={form.productId}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        productId: e.target.value,
                        variantId: "",
                      }))
                    }
                    className="w-full rounded-lg border bg-transparent px-3 py-2"
                  >
                    <option value="">Select product</option>
                    {products.map((item) => (
                      <option key={item._id} value={item._id}>
                        {item.name}
                        {item.sku ? ` — ${item.sku}` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {products.find((item) => item._id === form.productId)?.type ===
                  "VARIABLE" && (
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Variant *
                    </label>
                    <select
                      required
                      value={form.variantId}
                      onChange={(e) => updateForm("variantId", e.target.value)}
                      className="w-full rounded-lg border bg-transparent px-3 py-2"
                    >
                      <option value="">Select variant</option>
                      {(variantsByProduct[form.productId] ?? []).map(
                        (variant) => (
                          <option key={variant._id} value={variant._id}>
                            {variant.title}
                            {variant.sku ? ` — ${variant.sku}` : ""}
                          </option>
                        ),
                      )}
                    </select>
                    {(variantsByProduct[form.productId] ?? []).length === 0 && (
                      <p className="mt-1 text-xs text-amber-600">
                        This product has no active inventory-tracked variants.
                      </p>
                    )}
                  </div>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Source warehouse *
                    </label>
                    <select
                      required
                      value={form.sourceWarehouseId}
                      onChange={(e) =>
                        updateForm("sourceWarehouseId", e.target.value)
                      }
                      className="w-full rounded-lg border bg-transparent px-3 py-2"
                    >
                      <option value="">Select source</option>
                      {warehouses.map((item) => (
                        <option key={item._id} value={item._id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Destination warehouse *
                    </label>
                    <select
                      required
                      value={form.destinationWarehouseId}
                      onChange={(e) =>
                        updateForm("destinationWarehouseId", e.target.value)
                      }
                      className="w-full rounded-lg border bg-transparent px-3 py-2"
                    >
                      <option value="">Select destination</option>
                      {warehouses
                        .filter((item) => item._id !== form.sourceWarehouseId)
                        .map((item) => (
                          <option key={item._id} value={item._id}>
                            {item.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Quantity *
                  </label>
                  <input
                    required
                    type="number"
                    min="1"
                    step="1"
                    value={form.quantity}
                    onChange={(e) => updateForm("quantity", e.target.value)}
                    className="w-full rounded-lg border bg-transparent px-3 py-2"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Reason *
                  </label>
                  <textarea
                    required
                    minLength={3}
                    maxLength={500}
                    rows={3}
                    value={form.reason}
                    onChange={(e) => updateForm("reason", e.target.value)}
                    placeholder="Why is this stock being transferred?"
                    className="w-full rounded-lg border bg-transparent px-3 py-2"
                  />
                  <p className="mt-1 text-right text-xs text-gray-400">
                    {form.reason.length}/500
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Reference type
                    </label>
                    <input
                      maxLength={60}
                      value={form.referenceType}
                      onChange={(e) =>
                        updateForm("referenceType", e.target.value)
                      }
                      placeholder="e.g. PURCHASE_ORDER"
                      className="w-full rounded-lg border bg-transparent px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Reference ID
                    </label>
                    <input
                      maxLength={24}
                      value={form.referenceId}
                      onChange={(e) =>
                        updateForm("referenceId", e.target.value)
                      }
                      placeholder="Optional MongoDB ObjectId"
                      className="w-full rounded-lg border bg-transparent px-3 py-2"
                    />
                  </div>
                </div>
              </>
            )}

            <div className="flex justify-end gap-2 border-t pt-4">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-lg border px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || optionsLoading}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {submitting ? "Creating…" : "Create transfer"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {actionTarget && (
        <Modal
          title={`${actionTarget.action[0].toUpperCase()}${actionTarget.action.slice(1)} transfer`}
          onClose={() => setActionTarget(null)}
        >
          <form onSubmit={performAction} className="space-y-4">
            <div className="rounded-lg bg-gray-50 p-3 text-sm dark:bg-gray-800">
              <p className="font-semibold">
                {actionTarget.transfer.transferNumber}
              </p>
              <p className="mt-1 text-gray-500">
                {getName(actionTarget.transfer.productId)}
                {actionTarget.transfer.variantId
                  ? ` — ${getName(actionTarget.transfer.variantId)}`
                  : ""}{" "}
                · {actionTarget.transfer.quantity} units
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                {actionTarget.action === "reject" ||
                actionTarget.action === "cancel"
                  ? "Reason *"
                  : "Note (optional)"}
              </label>
              <textarea
                rows={3}
                maxLength={500}
                required={
                  actionTarget.action === "reject" ||
                  actionTarget.action === "cancel"
                }
                minLength={
                  actionTarget.action === "reject" ||
                  actionTarget.action === "cancel"
                    ? 3
                    : undefined
                }
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
                placeholder="Add a note for this action"
                className="w-full rounded-lg border bg-transparent px-3 py-2"
              />
            </div>

            <div className="flex justify-end gap-2 border-t pt-4">
              <button
                type="button"
                onClick={() => setActionTarget(null)}
                className="rounded-lg border px-4 py-2 text-sm"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {submitting ? "Processing…" : "Confirm"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {selected && (
        <Modal
          title={`Transfer details — ${selected.transferNumber}`}
          onClose={() => setSelected(null)}
        >
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <StatusBadge status={selected.status} />
              <span className="text-sm text-gray-500">
                Created {formatDate(selected.createdAt)}
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                [
                  "Product",
                  `${getName(selected.productId)}${selected.variantId ? ` — ${getName(selected.variantId)}` : ""}`,
                ],
                ["Quantity", String(selected.quantity)],
                ["Source warehouse", getName(selected.sourceWarehouseId)],
                [
                  "Destination warehouse",
                  getName(selected.destinationWarehouseId),
                ],
                ["Created by", getName(selected.createdBy)],
                ["Reason", selected.reason],
                ["Reference type", selected.referenceType || "—"],
                ["Reference ID", selected.referenceId || "—"],
                ["Approved at", formatDate(selected.approvedAt)],
                ["Dispatched at", formatDate(selected.dispatchedAt)],
                ["Received at", formatDate(selected.receivedAt)],
                ["Cancelled at", formatDate(selected.cancelledAt)],
                ["Rejected at", formatDate(selected.rejectedAt)],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-lg border p-3 dark:border-gray-700"
                >
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="mt-1 break-words text-sm font-medium">
                    {value}
                  </p>
                </div>
              ))}
            </div>

            {selected.dispatchNote && (
              <p className="text-sm">
                <strong>Dispatch note:</strong> {selected.dispatchNote}
              </p>
            )}
            {selected.receiveNote && (
              <p className="text-sm">
                <strong>Receive note:</strong> {selected.receiveNote}
              </p>
            )}
            {selected.rejectionReason && (
              <p className="text-sm text-red-600">
                <strong>Rejection reason:</strong> {selected.rejectionReason}
              </p>
            )}
            {selected.cancellationReason && (
              <p className="text-sm text-gray-600">
                <strong>Cancellation reason:</strong>{" "}
                {selected.cancellationReason}
              </p>
            )}

            <div>
              <h3 className="mb-3 font-semibold">Audit history</h3>
              {!selected.auditTrail?.length ? (
                <p className="text-sm text-gray-500">
                  No audit history available.
                </p>
              ) : (
                <div className="space-y-3">
                  {selected.auditTrail.map((entry, index) => (
                    <div
                      key={`${entry.action}-${entry.performedAt}-${index}`}
                      className="border-l-2 border-blue-300 pl-4"
                    >
                      <p className="text-sm font-semibold">{entry.action}</p>
                      <p className="text-xs text-gray-500">
                        {getName(entry.performedBy)} ·{" "}
                        {formatDate(entry.performedAt)}
                      </p>
                      {entry.note && (
                        <p className="mt-1 text-sm">{entry.note}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
              {actionButtons(selected).map(({ action, label }) => (
                <button
                  key={action}
                  type="button"
                  onClick={() => {
                    setActionNote("");
                    setActionTarget({ transfer: selected, action });
                    setSelected(null);
                  }}
                  className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  {label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-lg border px-4 py-2 text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
