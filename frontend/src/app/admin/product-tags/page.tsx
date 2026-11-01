"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Tag,
  Trash2,
  X,
} from "lucide-react";

import { productTagsAdminApi } from "@/services/api/product-tags-admin.api";

import type {
  ProductTag,
  ProductTagAssignment,
  ProductTagInput,
  ProductTagProduct,
} from "@/features/product-tags/tag.types";

const PAGE_SIZE = 20;

const inputClass =
  "mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

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

function getAssignedTag(
  assignment: ProductTagAssignment,
): ProductTag | null {
  return typeof assignment.tagId === "object" ? assignment.tagId : null;
}

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .trim()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function AdminProductTagsPage() {
  const [tags, setTags] = useState<ProductTag[]>([]);
  const [products, setProducts] = useState<ProductTagProduct[]>([]);
  const [assignments, setAssignments] = useState<ProductTagAssignment[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState("");

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  });

  const [showEditor, setShowEditor] = useState(false);
  const [editingTag, setEditingTag] = useState<ProductTag | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [customSlug, setCustomSlug] = useState(false);

  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedTagId, setSelectedTagId] = useState("");

  const loadTags = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await productTagsAdminApi.getAll({
        page,
        limit: PAGE_SIZE,
        search: search || undefined,
      });

      setTags(result.items);
      setPagination(result.pagination);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
      setTags([]);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  const loadProducts = useCallback(async () => {
    setLoadingProducts(true);

    try {
      const result = await productTagsAdminApi.getProducts();
      const requestedProductId = new URLSearchParams(
        window.location.search,
      ).get("productId");
      let products = result.items;

      if (
        requestedProductId &&
        !products.some((product) => product._id === requestedProductId)
      ) {
        const requestedProduct =
          await productTagsAdminApi.getProduct(requestedProductId);
        products = [...products, requestedProduct];
      }

      setProducts(products);

      setSelectedProductId((current) => {
        if (requestedProductId && products.some((item) => item._id === requestedProductId)) {
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

  const loadAssignments = useCallback(async () => {
    if (!selectedProductId) {
      setAssignments([]);
      return;
    }

    setLoadingAssignments(true);

    try {
      const result =
        await productTagsAdminApi.getProductTags(selectedProductId);

      setAssignments(result);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
      setAssignments([]);
    } finally {
      setLoadingAssignments(false);
    }
  }, [selectedProductId]);

  useEffect(() => {
    void Promise.resolve().then(loadTags);
  }, [loadTags]);

  useEffect(() => {
    void Promise.resolve().then(loadProducts);
  }, [loadProducts]);

  useEffect(() => {
    void Promise.resolve().then(loadAssignments);
  }, [loadAssignments]);

  const openCreate = () => {
    setEditingTag(null);
    setName("");
    setSlug("");
    setDescription("");
    setCustomSlug(false);
    setShowEditor(true);
  };

  const openEdit = (tag: ProductTag) => {
    setEditingTag(tag);
    setName(tag.name);
    setSlug(tag.slug);
    setDescription(tag.description ?? "");
    setCustomSlug(true);
    setShowEditor(true);
  };

  const closeEditor = () => {
    setShowEditor(false);
    setEditingTag(null);
  };

  const handleNameChange = (value: string) => {
    setName(value);

    if (!customSlug) {
      setSlug(slugify(value));
    }
  };

  const saveTag = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedName = name.trim();
    const trimmedSlug = slug.trim();

    if (trimmedName.length < 2 || trimmedName.length > 100) {
      window.alert("Tag name must contain 2–100 characters.");
      return;
    }

    if (
      trimmedSlug.length < 2 ||
      trimmedSlug.length > 120 ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(trimmedSlug)
    ) {
      window.alert(
        "Slug must contain lowercase letters, numbers and hyphens.",
      );
      return;
    }

    if (description.trim().length > 500) {
      window.alert("Description cannot exceed 500 characters.");
      return;
    }

    const input: ProductTagInput = {
      name: trimmedName,
      slug: trimmedSlug,
      ...(description.trim()
        ? { description: description.trim() }
        : {}),
    };

    setSaving(true);
    setError("");
    setNotice("");

    try {
      if (editingTag) {
        await productTagsAdminApi.update(editingTag._id, input);
        setNotice("Product tag updated successfully.");
      } else {
        await productTagsAdminApi.create(input);
        setNotice("Product tag created successfully.");
      }

      closeEditor();
      setPage(1);

      if (page === 1) {
        await loadTags();
      }
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  const deleteTag = async (tag: ProductTag) => {
    if (
      !window.confirm(
        `Delete "${tag.name}"?\n\nAll product assignments for this tag will also be deleted.`,
      )
    ) {
      return;
    }

    setActionId(tag._id);
    setError("");
    setNotice("");

    try {
      await productTagsAdminApi.delete(tag._id);
      setNotice("Product tag and its assignments deleted.");

      if (tags.length === 1 && page > 1) {
        setPage((current) => current - 1);
      } else {
        await loadTags();
      }

      await loadAssignments();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setActionId("");
    }
  };

  const assignTag = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedProductId || !selectedTagId) return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      await productTagsAdminApi.assign(selectedProductId, selectedTagId);
      setSelectedTagId("");
      setNotice("Tag assigned to product successfully.");
      await loadAssignments();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  const unassignTag = async (assignment: ProductTagAssignment) => {
    const tag = getAssignedTag(assignment);

    if (!tag) {
      setError("Could not read the assigned tag details.");
      return;
    }

    if (
      !window.confirm(
        `Remove "${tag.name}" from the selected product?`,
      )
    ) {
      return;
    }

    setActionId(tag._id);
    setError("");
    setNotice("");

    try {
      await productTagsAdminApi.unassign(selectedProductId, tag._id);
      setNotice("Tag removed from product.");
      await loadAssignments();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setActionId("");
    }
  };

  const assignedTagIds = new Set(
    assignments
      .map(getAssignedTag)
      .filter((tag): tag is ProductTag => tag !== null)
      .map((tag) => tag._id),
  );

  const availableTags = tags.filter(
    (tag) => !assignedTagIds.has(tag._id),
  );

  const totalPages = Math.max(1, pagination.totalPages);

  return (
    <main className="min-h-full bg-slate-50 p-4 text-slate-900 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white">
              <Tag className="h-6 w-6" />
            </div>

            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Product Tags
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Manage tags and assign them to products.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                void loadTags();
                void loadAssignments();
              }}
              disabled={loading || loadingAssignments}
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${
                  loading || loadingAssignments ? "animate-spin" : ""
                }`}
              />
              Refresh
            </button>

            <button
              type="button"
              onClick={openCreate}
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-700"
            >
              <Plus className="h-4 w-4" />
              Create tag
            </button>
          </div>
        </header>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <span className="flex-1">{error}</span>
            <button
              type="button"
              onClick={() => setError("")}
              aria-label="Dismiss error"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {notice && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <Check className="h-5 w-5 shrink-0" />
            <span className="flex-1">{notice}</span>
            <button
              type="button"
              onClick={() => setNotice("")}
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4">
            <h2 className="font-semibold">Assign tags to a product</h2>
            <p className="mt-1 text-sm text-slate-500">
              Choose a product, then assign or remove its tags.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Product
              <select
                value={selectedProductId}
                disabled={loadingProducts}
                onChange={(event) =>
                  setSelectedProductId(event.target.value)
                }
                className={inputClass}
              >
                <option value="">
                  {loadingProducts ? "Loading products..." : "Select product"}
                </option>

                {products.map((product) => (
                  <option key={product._id} value={product._id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </label>

            <form onSubmit={assignTag} className="flex items-end gap-2">
              <label className="block min-w-0 flex-1 text-sm font-medium text-slate-700">
                Available tags
                <select
                  value={selectedTagId}
                  onChange={(event) => setSelectedTagId(event.target.value)}
                  disabled={
                    !selectedProductId ||
                    availableTags.length === 0 ||
                    loadingAssignments
                  }
                  className={inputClass}
                >
                  <option value="">
                    {availableTags.length === 0
                      ? "No available tags"
                      : "Select tag"}
                  </option>

                  {availableTags.map((tag) => (
                    <option key={tag._id} value={tag._id}>
                      {tag.name}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="submit"
                disabled={!selectedProductId || !selectedTagId || saving}
                className="mb-0 h-10 shrink-0 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "..." : "Assign"}
              </button>
            </form>
          </div>

          <div className="mt-5 border-t border-slate-100 pt-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                Assigned tags
              </h3>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                {assignments.length}
              </span>
            </div>

            {!selectedProductId ? (
              <p className="text-sm text-slate-500">
                Select a product to view its assigned tags.
              </p>
            ) : loadingAssignments ? (
              <p className="text-sm text-slate-500">
                Loading assigned tags...
              </p>
            ) : assignments.length === 0 ? (
              <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
                No tags assigned to this product yet.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {assignments.map((assignment) => {
                  const tag = getAssignedTag(assignment);

                  if (!tag) return null;

                  return (
                    <span
                      key={assignment._id}
                      className="inline-flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800"
                    >
                      <Tag className="h-3.5 w-3.5" />
                      {tag.name}

                      <button
                        type="button"
                        disabled={actionId === tag._id}
                        onClick={() => void unassignTag(assignment)}
                        aria-label={`Remove ${tag.name}`}
                        className="rounded p-0.5 hover:bg-blue-100 disabled:opacity-50"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col justify-between gap-4 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:p-5">
            <div>
              <h2 className="font-semibold">All product tags</h2>
              <p className="mt-1 text-sm text-slate-500">
                {pagination.total.toLocaleString()} total tags
              </p>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                setPage(1);
                setSearch(searchInput.trim());
              }}
              className="flex w-full gap-2 sm:max-w-md"
            >
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchInput}
                  maxLength={150}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Search name or slug..."
                  className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <button
                type="submit"
                className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold hover:bg-slate-50"
              >
                Search
              </button>
            </form>
          </div>

          {loading ? (
            <div className="p-12 text-center text-sm text-slate-500">
              Loading product tags...
            </div>
          ) : tags.length === 0 ? (
            <div className="p-12 text-center">
              <Tag className="mx-auto h-10 w-10 text-slate-300" />
              <h3 className="mt-3 font-semibold">No tags found</h3>
              <p className="mt-1 text-sm text-slate-500">
                Create a tag or change your search.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Name</th>
                    <th className="px-5 py-3 font-semibold">Slug</th>
                    <th className="px-5 py-3 font-semibold">Description</th>
                    <th className="px-5 py-3 text-right font-semibold">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {tags.map((tag) => (
                    <tr key={tag._id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 font-semibold text-slate-800">
                          <Tag className="h-4 w-4 text-slate-400" />
                          {tag.name}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <code className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600">
                          {tag.slug}
                        </code>
                      </td>

                      <td className="max-w-xs truncate px-5 py-4 text-slate-500">
                        {tag.description || "—"}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(tag)}
                            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            disabled={actionId === tag._id}
                            onClick={() => void deleteTag(tag)}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-100 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </button>
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
                disabled={!pagination.hasPreviousPage || loading}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-sm disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>

              <button
                type="button"
                disabled={!pagination.hasNextPage || loading}
                onClick={() => setPage((current) => current + 1)}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-sm disabled:opacity-40"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </footer>
        </section>
      </div>

      {showEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4">
          <section className="my-4 w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="font-bold">
                  {editingTag ? "Edit product tag" : "Create product tag"}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Configure tag name, slug and description.
                </p>
              </div>

              <button
                type="button"
                onClick={closeEditor}
                disabled={saving}
                aria-label="Close editor"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <form onSubmit={saveTag} className="space-y-4 p-5">
              <label className="block text-sm font-medium text-slate-700">
                Tag name *
                <input
                  required
                  minLength={2}
                  maxLength={100}
                  value={name}
                  onChange={(event) => handleNameChange(event.target.value)}
                  placeholder="e.g. Best Seller"
                  className={inputClass}
                />
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Slug *
                <input
                  required
                  minLength={2}
                  maxLength={120}
                  value={slug}
                  onChange={(event) => {
                    setCustomSlug(true);
                    setSlug(
                      event.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9-]/g, ""),
                    );
                  }}
                  placeholder="best-seller"
                  className={inputClass}
                />
                <span className="mt-1 block text-xs text-slate-400">
                  Lowercase letters, numbers and hyphens only.
                </span>
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Description
                <textarea
                  maxLength={500}
                  rows={4}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Optional tag description..."
                  className="mt-1.5 w-full resize-y rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
                <span className="mt-1 block text-right text-xs text-slate-400">
                  {description.length}/500
                </span>
              </label>

              <footer className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={closeEditor}
                  disabled={saving}
                  className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-900 px-5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {saving
                    ? "Saving..."
                    : editingTag
                      ? "Save changes"
                      : "Create tag"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
