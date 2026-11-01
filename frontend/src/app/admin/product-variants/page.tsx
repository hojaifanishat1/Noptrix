"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Boxes,
  ChevronLeft,
  ChevronRight,
  Edit,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";

import { productVariantsAdminApi } from "@/services/api/product-variants-admin.api";

import type {
  ProductVariant,
  VariantInput,
  VariantStatus,
  VariableProduct,
} from "@/features/product-variants/variant.types";

const PAGE_SIZE = 20;

const inputClass =
  "mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

function getErrorMessage(error: unknown): string {
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

    if (data?.errors?.length) {
      return data.errors
        .map((item) => `${item.field ?? "Field"}: ${item.message ?? ""}`)
        .join(" | ");
    }

    if (data?.message) return data.message;
  }

  return error instanceof Error ? error.message : "Something went wrong.";
}

const emptyForm = {
  title: "",
  sku: "",
  barcode: "",
  options: '{\n  "Color": "Black"\n}',
  price: "",
  compareAtPrice: "",
  costPrice: "",
  trackInventory: true,
  stockQuantity: "0",
  lowStockThreshold: "5",
  status: "ACTIVE" as VariantStatus,
  sortOrder: "0",
};

export default function AdminProductVariantsPage() {
  const [products, setProducts] = useState<VariableProduct[]>([]);
  const [productId, setProductId] = useState("");

  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 0,
  });

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [actionId, setActionId] = useState("");

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(
    null,
  );
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadProducts = useCallback(async () => {
    setLoadingProducts(true);

    try {
      const result = await productVariantsAdminApi.getVariableProducts();
      const requestedProductId = new URLSearchParams(
        window.location.search,
      ).get("productId");
      let products = result.items;

      if (
        requestedProductId &&
        !products.some((product) => product._id === requestedProductId)
      ) {
        const requestedProduct =
          await productVariantsAdminApi.getProduct(requestedProductId);
        if (requestedProduct.type === "VARIABLE") {
          products = [...products, requestedProduct];
        }
      }

      setProducts(products);

      setProductId((current) => {
        if (
          requestedProductId &&
          products.some((item) => item._id === requestedProductId)
        ) {
          return requestedProductId;
        }
        if (current && products.some((item) => item._id === current)) {
          return current;
        }

        return products[0]?._id ?? "";
      });
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadProducts);
  }, [loadProducts]);

  const loadVariants = useCallback(async () => {
    if (!productId) {
      setVariants([]);
      setPagination({
        page: 1,
        limit: PAGE_SIZE,
        total: 0,
        totalPages: 0,
      });
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await productVariantsAdminApi.getAll(productId, {
        page,
        limit: PAGE_SIZE,
        sortBy: "sortOrder",
        sortOrder: "asc",
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(status ? { status: status as VariantStatus } : {}),
      });

      setVariants(result.items);
      setPagination(result.pagination);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
      setVariants([]);
    } finally {
      setLoading(false);
    }
  }, [productId, page, search, status]);

  useEffect(() => {
    void Promise.resolve().then(loadVariants);
  }, [loadVariants, refreshKey]);

  const openCreate = () => {
    setEditingVariant(null);
    setForm({ ...emptyForm });
    setEditorOpen(true);
  };

  const openEdit = async (variant: ProductVariant) => {
    setSaving(true);

    try {
      const fullVariant = await productVariantsAdminApi.getById(
        productId,
        variant._id,
      );

      setEditingVariant(fullVariant);

      setForm({
        title: fullVariant.title,
        sku: fullVariant.sku ?? "",
        barcode: fullVariant.barcode ?? "",
        options: JSON.stringify(fullVariant.options ?? {}, null, 2),
        price: fullVariant.price?.toString() ?? "",
        compareAtPrice: fullVariant.compareAtPrice?.toString() ?? "",
        costPrice: fullVariant.costPrice?.toString() ?? "",
        trackInventory: fullVariant.trackInventory,
        stockQuantity: String(fullVariant.stockQuantity ?? 0),
        lowStockThreshold: String(fullVariant.lowStockThreshold ?? 5),
        status: fullVariant.status,
        sortOrder: String(fullVariant.sortOrder ?? 0),
      });

      setEditorOpen(true);
    } catch (requestError) {
      window.alert(getErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  const saveVariant = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!productId) {
      window.alert("Select a VARIABLE product first.");
      return;
    }

    let options: Record<string, string>;

    try {
      options = JSON.parse(form.options);

      if (!options || Array.isArray(options) || typeof options !== "object") {
        throw new Error("Options must be a JSON object.");
      }

      if (Object.keys(options).length === 0) {
        throw new Error("At least one variant option is required.");
      }

      for (const [key, value] of Object.entries(options)) {
        if (!key.trim() || typeof value !== "string" || !value.trim()) {
          throw new Error("Every option must have a name and string value.");
        }
      }

      if (Object.keys(options).length > 20) {
        throw new Error("A variant cannot have more than 20 options.");
      }
    } catch (parseError) {
      window.alert(
        parseError instanceof Error
          ? parseError.message
          : "Invalid options JSON.",
      );
      return;
    }

    const price = form.price.trim() ? Number(form.price) : undefined;
    const compareAtPrice = form.compareAtPrice.trim()
      ? Number(form.compareAtPrice)
      : undefined;
    const costPrice = form.costPrice.trim()
      ? Number(form.costPrice)
      : undefined;

    const stockQuantity = Number(form.stockQuantity);
    const lowStockThreshold = Number(form.lowStockThreshold);
    const sortOrder = Number(form.sortOrder);

    const numericValues = [
      price,
      compareAtPrice,
      costPrice,
      stockQuantity,
      lowStockThreshold,
      sortOrder,
    ];

    if (
      numericValues.some(
        (value) =>
          value !== undefined && (!Number.isFinite(value) || value < 0),
      )
    ) {
      window.alert("Numeric values must be valid non-negative numbers.");
      return;
    }

    if (
      !Number.isInteger(stockQuantity) ||
      !Number.isInteger(lowStockThreshold) ||
      !Number.isInteger(sortOrder)
    ) {
      window.alert(
        "Stock quantity, low stock threshold and sort order must be integers.",
      );
      return;
    }

    if (
      price !== undefined &&
      compareAtPrice !== undefined &&
      compareAtPrice < price
    ) {
      window.alert("Compare-at price must be greater than or equal to price.");
      return;
    }

    const payload: VariantInput = {
      title: form.title.trim(),
      options,
      trackInventory: form.trackInventory,
      stockQuantity,
      lowStockThreshold,
      status: form.status,
      sortOrder,
      ...(form.sku.trim() ? { sku: form.sku.trim() } : {}),
      ...(form.barcode.trim() ? { barcode: form.barcode.trim() } : {}),
      ...(price !== undefined ? { price } : {}),
      ...(compareAtPrice !== undefined ? { compareAtPrice } : {}),
      ...(costPrice !== undefined ? { costPrice } : {}),
    };

    if (!payload.title) {
      window.alert("Variant title is required.");
      return;
    }

    setSaving(true);

    try {
      if (editingVariant) {
        await productVariantsAdminApi.update(
          productId,
          editingVariant._id,
          payload,
        );
      } else {
        await productVariantsAdminApi.create(productId, payload);
      }

      setEditorOpen(false);
      setEditingVariant(null);
      setForm({ ...emptyForm });

      await loadVariants();
    } catch (requestError) {
      window.alert(getErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  const deactivateVariant = async (variant: ProductVariant) => {
    if (
      !window.confirm(
        `Deactivate "${variant.title}"?\n\nThe variant will be preserved for historical records.`,
      )
    ) {
      return;
    }

    setActionId(variant._id);

    try {
      await productVariantsAdminApi.deactivate(productId, variant._id);
      await loadVariants();
    } catch (requestError) {
      window.alert(getErrorMessage(requestError));
    } finally {
      setActionId("");
    }
  };

  const selectedProduct = products.find((product) => product._id === productId);

  const totalPages = Math.max(1, pagination.totalPages);

  return (
    <main className="min-h-full bg-slate-50 p-4 text-slate-900 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white">
              <Boxes className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Product Variants
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Manage product options, SKU, pricing and inventory.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setRefreshKey((key) => key + 1)}
              disabled={loading}
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>

            {productId && (
              <button
                type="button"
                onClick={openCreate}
                disabled={loadingProducts}
                className="inline-flex h-11 items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                Add Variant
              </button>
            )}
          </div>
        </header>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              Select VARIABLE product
              <select
                value={productId}
                disabled={loadingProducts}
                onChange={(event) => {
                  setProductId(event.target.value);
                  setPage(1);
                  setSearch("");
                  setStatus("");
                }}
                className={inputClass}
              >
                <option value="">
                  {loadingProducts ? "Loading products..." : "Select a product"}
                </option>

                {products.map((product) => (
                  <option key={product._id} value={product._id}>
                    {product.name}
                    {product.sku ? ` — ${product.sku}` : ""}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-end">
              {selectedProduct ? (
                <div className="w-full rounded-lg bg-slate-50 px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Selected product
                  </p>
                  <p className="mt-1 font-semibold text-slate-900">
                    {selectedProduct.name}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {selectedProduct.slug}
                  </p>
                </div>
              ) : (
                <p className="pb-3 text-sm text-slate-500">
                  Select a variable product to manage its variants.
                </p>
              )}
            </div>
          </div>
        </section>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <span className="flex-1">{error}</span>
            <button
              type="button"
              onClick={() => setRefreshKey((key) => key + 1)}
              className="font-semibold underline"
            >
              Retry
            </button>
          </div>
        )}

        {!loadingProducts && products.length === 0 && (
          <section className="rounded-xl border border-amber-200 bg-amber-50 p-6">
            <h2 className="font-semibold text-amber-900">
              No VARIABLE products found
            </h2>
            <p className="mt-1 text-sm text-amber-800">
              Variants belong to a VARIABLE product. Create a product with type
              VARIABLE in Catalog → Products, then select it here to add and
              manage its variants.
            </p>
          </section>
        )}

        {productId && (
          <>
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium text-slate-700">
                  Search variants
                  <span className="relative mt-1.5 block">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="search"
                      value={search}
                      onChange={(event) => {
                        setSearch(event.target.value);
                        setPage(1);
                      }}
                      placeholder="Title, SKU or barcode"
                      className={`${inputClass} mt-0 pl-9`}
                    />
                  </span>
                </label>

                <label className="text-sm font-medium text-slate-700">
                  Status
                  <select
                    value={status}
                    onChange={(event) => {
                      setStatus(event.target.value);
                      setPage(1);
                    }}
                    className={inputClass}
                  >
                    <option value="">All statuses</option>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </label>
              </div>
            </section>

            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-4 sm:px-5">
                <div>
                  <h2 className="font-semibold">Variant directory</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {loading
                      ? "Loading variants..."
                      : `${pagination.total.toLocaleString()} variant${pagination.total === 1 ? "" : "s"} found`}
                  </p>
                </div>
              </div>

              {loading ? (
                <div className="p-12 text-center text-sm text-slate-500">
                  Loading variants...
                </div>
              ) : variants.length === 0 ? (
                <div className="p-12 text-center">
                  <Boxes className="mx-auto h-10 w-10 text-slate-300" />
                  <h3 className="mt-3 font-semibold">No variants found</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Add a variant or change your search filters.
                  </p>
                  <button
                    type="button"
                    onClick={openCreate}
                    className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"
                  >
                    <Plus className="h-4 w-4" />
                    Add Variant
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1050px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-5 py-3">Variant</th>
                        <th className="px-5 py-3">Options</th>
                        <th className="px-5 py-3">SKU / Barcode</th>
                        <th className="px-5 py-3">Price</th>
                        <th className="px-5 py-3">Inventory</th>
                        <th className="px-5 py-3">Status</th>
                        <th className="px-5 py-3">Actions</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {variants.map((variant) => (
                        <tr
                          key={variant._id}
                          className="align-middle hover:bg-slate-50/70"
                        >
                          <td className="px-5 py-4">
                            <p className="font-semibold">{variant.title}</p>
                            <p className="mt-1 text-xs text-slate-400">
                              Order: {variant.sortOrder}
                            </p>
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex max-w-64 flex-wrap gap-1.5">
                              {Object.entries(variant.options ?? {}).map(
                                ([key, value]) => (
                                  <span
                                    key={key}
                                    className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700"
                                  >
                                    {key}: {value}
                                  </span>
                                ),
                              )}
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <p>{variant.sku || "—"}</p>
                            <p className="mt-1 text-xs text-slate-400">
                              {variant.barcode || "No barcode"}
                            </p>
                          </td>

                          <td className="px-5 py-4">
                            <p className="font-semibold">
                              {variant.price !== undefined
                                ? variant.price.toLocaleString()
                                : "—"}
                            </p>
                            {variant.compareAtPrice !== undefined && (
                              <p className="text-xs text-slate-400">
                                Compare:{" "}
                                {variant.compareAtPrice.toLocaleString()}
                              </p>
                            )}
                          </td>

                          <td className="px-5 py-4">
                            {variant.trackInventory ? (
                              <>
                                <p className="font-semibold">
                                  {variant.stockQuantity} units
                                </p>
                                <p className="text-xs text-slate-500">
                                  Low stock: {variant.lowStockThreshold}
                                </p>
                              </>
                            ) : (
                              <span className="text-slate-500">
                                Not tracked
                              </span>
                            )}
                          </td>

                          <td className="px-5 py-4">
                            <span
                              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                                variant.status === "ACTIVE"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {variant.status}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                disabled={saving || actionId === variant._id}
                                onClick={() => void openEdit(variant)}
                                className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:underline disabled:opacity-50"
                              >
                                <Edit className="h-3.5 w-3.5" />
                                Edit
                              </button>

                              {variant.status === "ACTIVE" && (
                                <button
                                  type="button"
                                  disabled={actionId === variant._id}
                                  onClick={() =>
                                    void deactivateVariant(variant)
                                  }
                                  className="inline-flex items-center gap-1 font-medium text-red-600 hover:underline disabled:opacity-50"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Deactivate
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 sm:px-5">
                <p className="text-sm text-slate-500">
                  Page {pagination.page} of {totalPages}
                </p>

                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={page <= 1 || loading}
                    onClick={() =>
                      setPage((current) => Math.max(1, current - 1))
                    }
                    className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-sm disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </button>

                  <button
                    type="button"
                    disabled={page >= totalPages || loading}
                    onClick={() => setPage((current) => current + 1)}
                    className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-sm disabled:opacity-40"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </footer>
            </section>
          </>
        )}
      </div>

      {editorOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 p-4 sm:items-center">
          <section className="my-4 w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold">
                  {editingVariant ? "Edit variant" : "Create variant"}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {selectedProduct?.name}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Close editor"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <form onSubmit={saveVariant} className="space-y-5 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium text-slate-700">
                  Variant title *
                  <input
                    required
                    maxLength={160}
                    value={form.title}
                    onChange={(event) =>
                      setForm({ ...form, title: event.target.value })
                    }
                    placeholder="Black / Large"
                    className={inputClass}
                  />
                </label>

                <label className="text-sm font-medium text-slate-700">
                  SKU
                  <input
                    maxLength={100}
                    value={form.sku}
                    onChange={(event) =>
                      setForm({ ...form, sku: event.target.value })
                    }
                    placeholder="PRODUCT-BLK-L"
                    className={inputClass}
                  />
                </label>

                <label className="text-sm font-medium text-slate-700">
                  Barcode
                  <input
                    maxLength={100}
                    value={form.barcode}
                    onChange={(event) =>
                      setForm({ ...form, barcode: event.target.value })
                    }
                    className={inputClass}
                  />
                </label>

                <label className="text-sm font-medium text-slate-700">
                  Status
                  <select
                    value={form.status}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        status: event.target.value as VariantStatus,
                      })
                    }
                    className={inputClass}
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </label>
              </div>

              <label className="block text-sm font-medium text-slate-700">
                Variant options (JSON) *
                <textarea
                  required
                  rows={5}
                  value={form.options}
                  onChange={(event) =>
                    setForm({ ...form, options: event.target.value })
                  }
                  spellCheck={false}
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
                <span className="mt-1 block text-xs font-normal text-slate-500">
                  Example: <code>{'{"Color": "Black", "Size": "Large"}'}</code>.
                  Maximum 20 options.
                </span>
              </label>

              <div className="grid gap-4 sm:grid-cols-3">
                <label className="text-sm font-medium text-slate-700">
                  Price
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.price}
                    onChange={(event) =>
                      setForm({ ...form, price: event.target.value })
                    }
                    className={inputClass}
                  />
                </label>

                <label className="text-sm font-medium text-slate-700">
                  Compare-at price
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.compareAtPrice}
                    onChange={(event) =>
                      setForm({ ...form, compareAtPrice: event.target.value })
                    }
                    className={inputClass}
                  />
                </label>

                <label className="text-sm font-medium text-slate-700">
                  Cost price
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.costPrice}
                    onChange={(event) =>
                      setForm({ ...form, costPrice: event.target.value })
                    }
                    className={inputClass}
                  />
                </label>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={form.trackInventory}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        trackInventory: event.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <span>
                    <span className="block text-sm font-semibold">
                      Track inventory
                    </span>
                    <span className="block text-xs text-slate-500">
                      Track stock quantity for this variant.
                    </span>
                  </span>
                </label>

                {form.trackInventory && (
                  <div className="mt-4 grid gap-4 sm:grid-cols-3">
                    <label className="text-sm font-medium text-slate-700">
                      Stock quantity
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={form.stockQuantity}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            stockQuantity: event.target.value,
                          })
                        }
                        className={inputClass}
                      />
                    </label>

                    <label className="text-sm font-medium text-slate-700">
                      Low stock threshold
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={form.lowStockThreshold}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            lowStockThreshold: event.target.value,
                          })
                        }
                        className={inputClass}
                      />
                    </label>

                    <label className="text-sm font-medium text-slate-700">
                      Sort order
                      <input
                        type="number"
                        step="1"
                        value={form.sortOrder}
                        onChange={(event) =>
                          setForm({ ...form, sortOrder: event.target.value })
                        }
                        className={inputClass}
                      />
                    </label>
                  </div>
                )}
              </div>

              {!form.trackInventory && (
                <label className="block text-sm font-medium text-slate-700">
                  Sort order
                  <input
                    type="number"
                    step="1"
                    value={form.sortOrder}
                    onChange={(event) =>
                      setForm({ ...form, sortOrder: event.target.value })
                    }
                    className={inputClass}
                  />
                </label>
              )}

              <footer className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setEditorOpen(false)}
                  disabled={saving}
                  className="h-11 rounded-lg border border-slate-200 px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="h-11 rounded-lg bg-slate-900 px-5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
                >
                  {saving
                    ? "Saving..."
                    : editingVariant
                      ? "Save changes"
                      : "Create variant"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
