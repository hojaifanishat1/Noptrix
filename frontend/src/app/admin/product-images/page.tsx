"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import { productImagesAdminApi } from "@/services/api/product-images-admin.api";

import type {
  ProductImage,
  VariableProduct,
} from "@/features/product-images/image.types";

const PAGE_SIZE = 20;
const MAX_FILES = 20;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

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

function formatBytes(bytes?: number): string {
  if (bytes === undefined) return "Unknown size";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function AdminProductImagesPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [products, setProducts] = useState<VariableProduct[]>([]);
  const [productId, setProductId] = useState("");

  const [images, setImages] = useState<ProductImage[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 0,
  });

  const [page, setPage] = useState(1);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingImages, setLoadingImages] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [actionId, setActionId] = useState("");

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [uploadAlt, setUploadAlt] = useState("");
  const [primaryIndex, setPrimaryIndex] = useState(0);

  const [editingImage, setEditingImage] = useState<ProductImage | null>(null);
  const [editAlt, setEditAlt] = useState("");
  const [editSortOrder, setEditSortOrder] = useState("0");
  const [savingEdit, setSavingEdit] = useState(false);

  const loadProducts = useCallback(async () => {
    setLoadingProducts(true);
    setError("");

    try {
      const result = await productImagesAdminApi.getProducts();
      const requestedProductId = new URLSearchParams(
        window.location.search,
      ).get("productId");
      let products = result.items;

      if (
        requestedProductId &&
        !products.some((product) => product._id === requestedProductId)
      ) {
        const requestedProduct =
          await productImagesAdminApi.getProduct(requestedProductId);
        products = [...products, requestedProduct];
      }

      setProducts(products);

      setProductId((current) => {
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

  useEffect(() => {
    void Promise.resolve().then(loadProducts);
  }, [loadProducts]);

  const loadImages = useCallback(async () => {
    if (!productId) {
      setImages([]);
      setPagination({
        page: 1,
        limit: PAGE_SIZE,
        total: 0,
        totalPages: 0,
      });
      return;
    }

    setLoadingImages(true);
    setError("");

    try {
      const result = await productImagesAdminApi.getAll(
        productId,
        page,
        PAGE_SIZE,
      );

      setImages(result.items);
      setPagination(result.pagination);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
      setImages([]);
    } finally {
      setLoadingImages(false);
    }
  }, [productId, page]);

  useEffect(() => {
    void Promise.resolve().then(loadImages);
  }, [loadImages, refreshKey]);

  useEffect(() => {
    return () => {
      previews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [previews]);

  const selectedProduct = products.find(
    (product) => product._id === productId,
  );

  const clearSelectedFiles = () => {
    previews.forEach((url) => URL.revokeObjectURL(url));
    setPreviews([]);
    setSelectedFiles([]);
    setPrimaryIndex(0);
    setUploadAlt("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return;

    const incoming = Array.from(fileList);

    if (incoming.length === 0) return;

    if (selectedFiles.length + incoming.length > MAX_FILES) {
      window.alert(`You can select at most ${MAX_FILES} images.`);
      return;
    }

    const invalid = incoming.find(
      (file) =>
        !file.type.startsWith("image/") || file.size > MAX_FILE_SIZE,
    );

    if (invalid) {
      window.alert(
        !invalid.type.startsWith("image/")
          ? `${invalid.name} is not an image file.`
          : `${invalid.name} exceeds the 10 MB file size limit.`,
      );
      return;
    }

    const nextFiles = [...selectedFiles, ...incoming];
    const nextPreviews = [
      ...previews,
      ...incoming.map((file) => URL.createObjectURL(file)),
    ];

    setSelectedFiles(nextFiles);
    setPreviews(nextPreviews);

    if (selectedFiles.length === 0) {
      setPrimaryIndex(0);
    }
  };

  const removeSelectedFile = (index: number) => {
    const nextFiles = selectedFiles.filter((_, i) => i !== index);
    const nextPreviews = previews.filter((_, i) => i !== index);

    if (previews[index]) {
      URL.revokeObjectURL(previews[index]);
    }

    setSelectedFiles(nextFiles);
    setPreviews(nextPreviews);

    setPrimaryIndex((current) => {
      if (nextFiles.length === 0) return 0;
      if (current === index) return 0;
      if (current > index) return current - 1;
      return current;
    });
  };

  const uploadImages = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!productId || selectedFiles.length === 0) return;

    setUploading(true);
    setError("");
    setNotice("");

    try {
      await productImagesAdminApi.upload(productId, {
        files: selectedFiles,
        alt: uploadAlt,
        primaryIndex,
      });

      clearSelectedFiles();
      setPage(1);
      setNotice("Images uploaded successfully.");
      setRefreshKey((key) => key + 1);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setUploading(false);
    }
  };

  const setPrimaryImage = async (image: ProductImage) => {
    if (image.isPrimary) return;

    setActionId(image._id);
    setError("");
    setNotice("");

    try {
      await productImagesAdminApi.update(productId, image._id, {
        isPrimary: true,
      });

      setNotice("Primary image updated.");
      setRefreshKey((key) => key + 1);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setActionId("");
    }
  };

  const openEdit = async (image: ProductImage) => {
    setActionId(image._id);
    setError("");

    try {
      const fullImage = await productImagesAdminApi.getById(
        productId,
        image._id,
      );

      setEditingImage(fullImage);
      setEditAlt(fullImage.alt ?? "");
      setEditSortOrder(String(fullImage.sortOrder ?? 0));
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setActionId("");
    }
  };

  const saveEdit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!editingImage) return;

    const sortOrder = Number(editSortOrder);

    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      window.alert("Sort order must be a non-negative integer.");
      return;
    }

    setSavingEdit(true);

    try {
      await productImagesAdminApi.update(
        productId,
        editingImage._id,
        {
          alt: editAlt,
          sortOrder,
        },
      );

      setEditingImage(null);
      setNotice("Image details updated.");
      setRefreshKey((key) => key + 1);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSavingEdit(false);
    }
  };

  const deleteImage = async (image: ProductImage) => {
    if (
      !window.confirm(
        `Delete this image?\n\n${image.isPrimary ? "Another image will automatically become primary if available." : "This action cannot be undone."}`,
      )
    ) {
      return;
    }

    setActionId(image._id);
    setError("");
    setNotice("");

    try {
      const result = await productImagesAdminApi.delete(
        productId,
        image._id,
      );

      setNotice(
        result.storageCleanupPending
          ? "Image deleted. Cloudinary cleanup is still pending."
          : "Image deleted successfully.",
      );

      if (images.length === 1 && page > 1) {
        setPage((current) => current - 1);
      } else {
        setRefreshKey((key) => key + 1);
      }
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setActionId("");
    }
  };

  const totalPages = Math.max(1, pagination.totalPages);

  return (
    <main className="min-h-full bg-slate-50 p-4 text-slate-900 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white">
              <ImageIcon className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Product Images
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Upload, organize and manage product gallery images.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setRefreshKey((key) => key + 1)}
            disabled={loadingImages}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${loadingImages ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
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
              onClick={() => setRefreshKey((key) => key + 1)}
              className="font-semibold underline"
            >
              Retry
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
          <label className="block max-w-xl text-sm font-medium text-slate-700">
            Select product
            <select
              value={productId}
              disabled={loadingProducts}
              onChange={(event) => {
                setProductId(event.target.value);
                setPage(1);
                setNotice("");
              }}
              className={inputClass}
            >
              <option value="">
                {loadingProducts ? "Loading products..." : "Select product"}
              </option>

              {products.map((product) => (
                <option key={product._id} value={product._id}>
                  {product.name}
                  {product.sku ? ` — ${product.sku}` : ""}
                </option>
              ))}
            </select>
          </label>

          {selectedProduct && (
            <div className="mt-3 rounded-lg bg-slate-50 px-4 py-3">
              <p className="font-semibold">{selectedProduct.name}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {selectedProduct.slug}
              </p>
            </div>
          )}
        </section>

        {!loadingProducts && products.length === 0 && (
          <section className="rounded-xl border border-amber-200 bg-amber-50 p-6">
            <h2 className="font-semibold text-amber-900">
              No products found
            </h2>
            <p className="mt-1 text-sm text-amber-800">
              Create a product before uploading images.
            </p>
            <Link
              href="/admin/products"
              className="mt-4 inline-flex rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"
            >
              Go to Products
            </Link>
          </section>
        )}

        {productId && (
          <>
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-4">
                <h2 className="font-semibold">Upload images</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Select up to 20 images. Maximum 10 MB per file.
                </p>
              </div>

              <form onSubmit={uploadImages} className="space-y-4">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex min-h-36 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-7 text-center transition hover:border-blue-400 hover:bg-blue-50/50 disabled:opacity-50"
                >
                  <Upload className="h-8 w-8 text-slate-400" />
                  <span className="mt-3 text-sm font-semibold">
                    Click to select images
                  </span>
                  <span className="mt-1 text-xs text-slate-500">
                    PNG, JPG, WEBP and other server-accepted image formats
                  </span>
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={(event) => {
                    handleFiles(event.target.files);
                    event.target.value = "";
                  }}
                />

                {selectedFiles.length > 0 && (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold">
                        {selectedFiles.length} selected
                      </p>
                      <button
                        type="button"
                        onClick={clearSelectedFiles}
                        className="text-sm font-medium text-red-600 hover:underline"
                      >
                        Clear selection
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                      {selectedFiles.map((file, index) => (
                        <div
                          key={`${file.name}-${file.size}-${index}`}
                          className="overflow-hidden rounded-xl border border-slate-200"
                        >
                          <div className="relative aspect-square bg-slate-100">
                            <img
                              src={previews[index]}
                              alt={file.name}
                              className="h-full w-full object-cover"
                            />

                            <button
                              type="button"
                              onClick={() => removeSelectedFile(index)}
                              className="absolute right-2 top-2 rounded-full bg-slate-950/75 p-1.5 text-white hover:bg-red-600"
                              aria-label={`Remove ${file.name}`}
                            >
                              <X className="h-4 w-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => setPrimaryIndex(index)}
                              className={`absolute bottom-2 left-2 rounded-full px-2.5 py-1 text-xs font-semibold ${
                                primaryIndex === index
                                  ? "bg-amber-400 text-amber-950"
                                  : "bg-slate-950/75 text-white"
                              }`}
                            >
                              {primaryIndex === index
                                ? "Primary"
                                : "Set primary"}
                            </button>
                          </div>

                          <div className="p-2">
                            <p className="truncate text-xs font-medium">
                              {file.name}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {formatBytes(file.size)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="text-sm font-medium text-slate-700">
                        Alt text
                        <input
                          value={uploadAlt}
                          maxLength={250}
                          onChange={(event) => setUploadAlt(event.target.value)}
                          placeholder="Describe the product images"
                          className={inputClass}
                        />
                      </label>

                      <div className="flex items-end text-xs text-slate-500">
                        The selected primary image will be used as the
                        product&apos;s primary gallery image.
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={uploading || !productId}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4" />
                          Upload {selectedFiles.length} image
                          {selectedFiles.length > 1 ? "s" : ""}
                        </>
                      )}
                    </button>
                  </>
                )}
              </form>
            </section>

            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
                <div>
                  <h2 className="font-semibold">Image gallery</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {loadingImages
                      ? "Loading images..."
                      : `${pagination.total.toLocaleString()} image${pagination.total === 1 ? "" : "s"}`}
                  </p>
                </div>
              </div>

              {loadingImages ? (
                <div className="p-12 text-center text-sm text-slate-500">
                  Loading product images...
                </div>
              ) : images.length === 0 ? (
                <div className="p-12 text-center">
                  <ImageIcon className="mx-auto h-10 w-10 text-slate-300" />
                  <h3 className="mt-3 font-semibold">No images uploaded</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Upload images to create this product&apos;s gallery.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {images.map((image) => (
                    <article
                      key={image._id}
                      className="overflow-hidden rounded-xl border border-slate-200 bg-white"
                    >
                      <div className="relative aspect-square bg-slate-100">
                        <img
                          src={image.url}
                          alt={image.alt || "Product image"}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />

                        {image.isPrimary && (
                          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-amber-400 px-2.5 py-1 text-xs font-bold text-amber-950 shadow-sm">
                            <Star className="h-3 w-3 fill-current" />
                            Primary
                          </span>
                        )}

                        <span className="absolute bottom-2 right-2 rounded-md bg-slate-950/70 px-2 py-1 text-xs text-white">
                          #{image.sortOrder}
                        </span>
                      </div>

                      <div className="space-y-2 p-3">
                        <p
                          className="truncate text-xs font-medium text-slate-700"
                          title={image.alt}
                        >
                          {image.alt || "No alt text"}
                        </p>

                        <p className="text-xs text-slate-400">
                          {image.width && image.height
                            ? `${image.width} × ${image.height}`
                            : "Dimensions unavailable"}
                        </p>

                        <p className="text-xs text-slate-400">
                          {formatBytes(image.bytes)}
                          {image.format ? ` · ${image.format.toUpperCase()}` : ""}
                        </p>

                        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-2">
                          {!image.isPrimary && (
                            <button
                              type="button"
                              disabled={actionId === image._id}
                              onClick={() => void setPrimaryImage(image)}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:underline disabled:opacity-50"
                            >
                              <Star className="h-3.5 w-3.5" />
                              Primary
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={actionId === image._id}
                            onClick={() => void openEdit(image)}
                            className="text-xs font-semibold text-blue-700 hover:underline disabled:opacity-50"
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            disabled={actionId === image._id}
                            onClick={() => void deleteImage(image)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:underline disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}

              <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 sm:px-5">
                <p className="text-sm text-slate-500">
                  Page {pagination.page} of {totalPages}
                </p>

                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={page <= 1 || loadingImages}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-sm disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </button>

                  <button
                    type="button"
                    disabled={page >= totalPages || loadingImages}
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

      {editingImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4">
          <section className="my-4 w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="font-bold">Edit image details</h2>
              <button
                type="button"
                onClick={() => setEditingImage(null)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Close editor"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <form onSubmit={saveEdit} className="space-y-4 p-5">
              <div className="overflow-hidden rounded-xl bg-slate-100">
                <img
                  src={editingImage.url}
                  alt={editingImage.alt || "Product image"}
                  className="mx-auto max-h-64 w-full object-contain"
                />
              </div>

              <label className="block text-sm font-medium text-slate-700">
                Alt text
                <input
                  value={editAlt}
                  maxLength={250}
                  onChange={(event) => setEditAlt(event.target.value)}
                  className={inputClass}
                />
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Sort order
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={editSortOrder}
                  onChange={(event) => setEditSortOrder(event.target.value)}
                  className={inputClass}
                />
              </label>

              {editingImage.isPrimary && (
                <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                  This is the primary image. To change it, select another
                  image as primary from the gallery.
                </p>
              )}

              <footer className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingImage(null)}
                  disabled={savingEdit}
                  className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={savingEdit}
                  className="h-10 rounded-lg bg-slate-900 px-5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {savingEdit ? "Saving..." : "Save changes"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
