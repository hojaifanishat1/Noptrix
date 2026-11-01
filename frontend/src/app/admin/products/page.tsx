"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";

import {
  Plus,
  Search,
  RefreshCw,
  Pencil,
  Trash2,
  X,
  Save,
  Package,
  Star,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Archive,
  Filter,
  ChevronDown,
} from "lucide-react";

import { productsAdminApi } from "@/services/api/products-admin.api";
import { warehouseAdminApi } from "@/services/api/warehouse-admin.api";
import { productTagsAdminApi } from "@/services/api/product-tags-admin.api";
import { productImagesAdminApi } from "@/services/api/product-images-admin.api";
import { attributesAdminApi } from "@/services/api/attributes-admin.api";
import { productVariantsAdminApi } from "@/services/api/product-variants-admin.api";
import type { Warehouse } from "@/features/warehouses/warehouse.types";
import type { ProductTag } from "@/features/product-tags/tag.types";
import type { Attribute } from "@/features/attributes/attribute.types";
import type { VariantInput } from "@/features/product-variants/variant.types";

import type {
  Product,
  ProductFilters,
  ProductInput,
  ProductOption,
  ProductStatus,
  ProductType,
  InventoryPolicy,
  ProductVisibility,
} from "@/features/products/product.types";

type FormState = {
  name: string;
  slug: string;
  description: string;
  shortDescription: string;
  type: ProductType;
  status: ProductStatus;
  visibility: ProductVisibility;
  publishAt: string;
  sku: string;
  barcode: string;
  sellerId: string;
  categoryId: string;
  subcategoryId: string;
  brandId: string;
  collectionIds: string[];
  tagIds: string[];
  price: string;
  compareAtPrice: string;
  costPrice: string;
  salePrice: string;
  saleStartsAt: string;
  saleEndsAt: string;
  currency: string;
  trackInventory: boolean;
  stockQuantity: string;
  lowStockThreshold: string;
  inventoryWarehouseId: string;
  inventoryPolicy: InventoryPolicy;
  requiresShipping: boolean;
  weight: string;
  weightUnit: "g" | "kg";
  length: string;
  width: string;
  height: string;
  dimensionUnit: "cm" | "m";
  tagsText: string;
  attributes: Record<string, unknown>;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  canonicalUrl: string;
  featured: boolean;
  sortOrder: string;
};

type VariantDraft = {
  options: Record<string, string>;
  title: string;
  sku: string;
  barcode: string;
  price: string;
  compareAtPrice: string;
  costPrice: string;
  trackInventory: boolean;
  stockQuantity: string;
  lowStockThreshold: string;
};

const PRODUCT_WIZARD_STEPS = [
  "Basic Info",
  "Classification",
  "Attributes",
  "Variants",
  "Images",
  "SEO",
  "Publish",
] as const;

const initialForm: FormState = {
  name: "",
  slug: "",
  description: "",
  shortDescription: "",
  type: "SIMPLE",
  status: "DRAFT",
  visibility: "VISIBLE",
  publishAt: "",
  sku: "",
  barcode: "",
  sellerId: "",
  categoryId: "",
  subcategoryId: "",
  brandId: "",
  collectionIds: [],
  tagIds: [],
  price: "0",
  compareAtPrice: "",
  costPrice: "",
  salePrice: "",
  saleStartsAt: "",
  saleEndsAt: "",
  currency: "BDT",
  trackInventory: true,
  stockQuantity: "0",
  lowStockThreshold: "5",
  inventoryWarehouseId: "",
  inventoryPolicy: "DENY",
  requiresShipping: true,
  weight: "",
  weightUnit: "kg",
  length: "",
  width: "",
  height: "",
  dimensionUnit: "cm",
  tagsText: "",
  attributes: {},
  seoTitle: "",
  seoDescription: "",
  seoKeywords: "",
  canonicalUrl: "",
  featured: false,
  sortOrder: "0",
};

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-gray-700 dark:bg-gray-800 dark:text-white";

const labelClass =
  "mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300";

function errorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (
      error as {
        response?: { data?: { message?: string } };
      }
    ).response;

    return response?.data?.message ?? "Something went wrong.";
  }

  return error instanceof Error ? error.message : "Something went wrong.";
}

function getReferenceId(value: string | { _id: string } | undefined): string {
  if (!value) return "";
  return typeof value === "string" ? value : value._id;
}

function toDateTimeLocal(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

function toIsoDateTime(value: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function getActiveSalePrice(product: Product): number | undefined {
  const now = Date.now();
  const startsAt = product.saleStartsAt
    ? new Date(product.saleStartsAt).getTime()
    : Number.NEGATIVE_INFINITY;
  const endsAt = product.saleEndsAt
    ? new Date(product.saleEndsAt).getTime()
    : Number.POSITIVE_INFINITY;

  return product.salePrice !== undefined && startsAt <= now && now < endsAt
    ? product.salePrice
    : undefined;
}

function createForm(product?: Product): FormState {
  if (!product) return { ...initialForm };

  return {
    name: product.name ?? "",
    slug: product.slug ?? "",
    description: product.description ?? "",
    shortDescription: product.shortDescription ?? "",
    type: product.type ?? "SIMPLE",
    status: product.status ?? "DRAFT",
    visibility: product.visibility ?? "VISIBLE",
    publishAt: toDateTimeLocal(product.publishAt),
    sku: product.sku ?? "",
    barcode: product.barcode ?? "",
    sellerId: product.sellerId ?? "",
    categoryId: getReferenceId(product.categoryId),
    subcategoryId: getReferenceId(product.subcategoryId),
    brandId: getReferenceId(product.brandId),
    collectionIds: (product.collectionIds ?? []).map(getReferenceId),
    tagIds: [],
    price: String(product.price ?? 0),
    compareAtPrice:
      product.compareAtPrice === undefined
        ? ""
        : String(product.compareAtPrice),
    costPrice: product.costPrice === undefined ? "" : String(product.costPrice),
    salePrice: product.salePrice === undefined ? "" : String(product.salePrice),
    saleStartsAt: toDateTimeLocal(product.saleStartsAt),
    saleEndsAt: toDateTimeLocal(product.saleEndsAt),
    currency: product.currency ?? "BDT",
    trackInventory: product.trackInventory ?? true,
    stockQuantity: String(product.stockQuantity ?? 0),
    lowStockThreshold: String(product.lowStockThreshold ?? 5),
    inventoryWarehouseId: "",
    inventoryPolicy: product.inventoryPolicy ?? "DENY",
    requiresShipping: product.requiresShipping ?? true,
    weight:
      product.shipping?.weight === undefined
        ? ""
        : String(product.shipping.weight),
    weightUnit: product.shipping?.weightUnit ?? "kg",
    length:
      product.shipping?.length === undefined
        ? ""
        : String(product.shipping.length),
    width:
      product.shipping?.width === undefined
        ? ""
        : String(product.shipping.width),
    height:
      product.shipping?.height === undefined
        ? ""
        : String(product.shipping.height),
    dimensionUnit: product.shipping?.dimensionUnit ?? "cm",
    tagsText: (product.tags ?? []).join(", "),
    attributes: { ...(product.attributes ?? {}) },
    seoTitle: product.seo?.title ?? "",
    seoDescription: product.seo?.description ?? "",
    seoKeywords: (product.seo?.keywords ?? []).join(", "),
    canonicalUrl: product.seo?.canonicalUrl ?? "",
    featured: product.featured ?? false,
    sortOrder: String(product.sortOrder ?? 0),
  };
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );
}

function MultiSelectDropdown({
  label,
  options,
  selectedIds,
  onChange,
  emptyMessage,
}: {
  label: string;
  options: Array<{ id: string; label: string }>;
  selectedIds: string[];
  onChange: (selectedIds: string[]) => void;
  emptyMessage: React.ReactNode;
}) {
  const [search, setSearch] = useState("");
  const selectedLabels = options
    .filter((option) => selectedIds.includes(option.id))
    .map((option) => option.label);
  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <div>
      <span className={labelClass}>{label}</span>
      <details className="group relative">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800">
          <span className="truncate text-gray-700 dark:text-gray-200">
            {selectedLabels.length > 0
              ? selectedLabels.join(", ")
              : "Choose one or more"}
          </span>
          <ChevronDown
            size={16}
            className="shrink-0 transition-transform group-open:rotate-180"
          />
        </summary>
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-700 dark:bg-gray-900">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={`Search ${label.toLowerCase()}...`}
            aria-label={`Search ${label.toLowerCase()}`}
            className={`${inputClass} mb-2`}
          />
          <div className="max-h-48 overflow-y-auto">
            {filteredOptions.map((option) => (
              <label
                key={option.id}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(option.id)}
                  onChange={() => {
                    onChange(
                      selectedIds.includes(option.id)
                        ? selectedIds.filter((id) => id !== option.id)
                        : [...selectedIds, option.id],
                    );
                  }}
                />
                <span>{option.label}</span>
              </label>
            ))}
            {filteredOptions.length === 0 && (
              <div className="px-2 py-3 text-sm text-gray-500">
                {options.length === 0 ? emptyMessage : "No matching options."}
              </div>
            )}
          </div>
        </div>
      </details>
      {selectedLabels.length > 0 && (
        <p className="mt-1 text-xs text-gray-500">
          {selectedLabels.length} selected
        </p>
      )}
    </div>
  );
}

function getAttributeInitialValue(attribute: Attribute): unknown {
  switch (attribute.type) {
    case "BOOLEAN":
      return undefined;
    case "MULTI_SELECT":
      return [];
    default:
      return "";
  }
}

function getVariantCombinations(
  selections: Array<{ name: string; values: string[] }>,
): Array<Record<string, string>> {
  return selections.reduce<Array<Record<string, string>>>(
    (combinations, selection) =>
      combinations.flatMap((combination) =>
        selection.values.map((value) => ({
          ...combination,
          [selection.name]: value,
        })),
      ),
    [{}],
  );
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductOption[]>([]);
  const [subcategories, setSubcategories] = useState<ProductOption[]>([]);
  const [brands, setBrands] = useState<ProductOption[]>([]);
  const [collections, setCollections] = useState<ProductOption[]>([]);
  const [managedTags, setManagedTags] = useState<ProductTag[]>([]);
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehousesLoading, setWarehousesLoading] = useState(true);
  const [warehouseError, setWarehouseError] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [relatedOptionsError, setRelatedOptionsError] = useState("");
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | ProductStatus>("");
  const [type, setType] = useState<"" | ProductType>("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [featuredFilter, setFeaturedFilter] = useState("");
  const [stockFilter, setStockFilter] = useState("");
  const [sortBy, setSortBy] = useState<ProductFilters["sortBy"]>("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeWizardStep, setActiveWizardStep] = useState(0);
  const [form, setForm] = useState<FormState>({ ...initialForm });
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const imagePreviewRef = useRef<string[]>([]);
  const [primaryImageIndex, setPrimaryImageIndex] = useState(0);
  const [variantAttributeIds, setVariantAttributeIds] = useState<string[]>([]);
  const [variantSelections, setVariantSelections] = useState<
    Record<string, string[]>
  >({});
  const [variantDrafts, setVariantDrafts] = useState<VariantDraft[]>([]);
  const [variantBuilderError, setVariantBuilderError] = useState("");
  const [createdProduct, setCreatedProduct] = useState<{
    id: string;
    name: string;
    type: ProductType;
    setupWarning?: string;
  } | null>(null);
  const [pendingImageProductId, setPendingImageProductId] = useState("");
  const [uploadingInitialImages, setUploadingInitialImages] = useState(false);
  const [pendingPublishStatus, setPendingPublishStatus] =
    useState<ProductStatus | null>(null);

  const loadProducts = useCallback(async () => {
    setLoading(true);

    try {
      const result = await productsAdminApi.list({
        page,
        limit: 20,
        search: search.trim() || undefined,
        status: status || undefined,
        type: type || undefined,
        categoryId: categoryFilter || undefined,
        brandId: brandFilter || undefined,
        featured: featuredFilter === "" ? undefined : featuredFilter === "true",
        inStock: stockFilter === "" ? undefined : stockFilter === "true",
        sortBy,
        sortOrder,
      });

      setProducts(result.items ?? []);
      setTotal(result.pagination?.total ?? 0);
      setTotalPages(Math.max(1, result.pagination?.totalPages ?? 1));
    } catch (error) {
      alert(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [
    page,
    search,
    status,
    type,
    categoryFilter,
    brandFilter,
    featuredFilter,
    stockFilter,
    sortBy,
    sortOrder,
  ]);

  const loadOptions = useCallback(async () => {
    const results = await Promise.allSettled([
      productsAdminApi.getCategories(),
      productsAdminApi.getSubcategories(),
      productsAdminApi.getBrands(),
      productsAdminApi.getCollections(),
      productTagsAdminApi.getAll({ page: 1, limit: 100 }),
      attributesAdminApi.getAll({ page: 1, limit: 100, status: "ACTIVE" }),
    ]);
    const optionNames = [
      "categories",
      "subcategories",
      "brands",
      "collections",
      "product tags",
      "attributes",
    ];
    const failures: string[] = [];

    results.forEach((result, index) => {
      if (result.status === "rejected") {
        failures.push(`${optionNames[index]}: ${errorMessage(result.reason)}`);
      }
    });

    if (results[0].status === "fulfilled") setCategories(results[0].value);
    if (results[1].status === "fulfilled") setSubcategories(results[1].value);
    if (results[2].status === "fulfilled") setBrands(results[2].value);
    if (results[3].status === "fulfilled") setCollections(results[3].value);
    if (results[4].status === "fulfilled") {
      setManagedTags(results[4].value.items);
    }
    if (results[5].status === "fulfilled") {
      setAttributes([...results[5].value.items]);
    }
    setRelatedOptionsError(failures.join(" • "));
  }, []);

  const loadWarehouses = useCallback(async () => {
    setWarehousesLoading(true);
    setWarehouseError("");

    try {
      const result = await warehouseAdminApi.list({
        page: 1,
        limit: 100,
        status: "ACTIVE",
        sortBy: "name",
        sortOrder: "asc",
      });
      setWarehouses(result.items);
    } catch (error) {
      setWarehouseError(errorMessage(error));
    } finally {
      setWarehousesLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadProducts);
  }, [loadProducts]);

  useEffect(() => {
    void Promise.resolve().then(loadOptions);
  }, [loadOptions]);

  useEffect(() => {
    void Promise.resolve().then(loadWarehouses);
  }, [loadWarehouses]);

  useEffect(
    () => () =>
      imagePreviewRef.current.forEach((preview) =>
        URL.revokeObjectURL(preview),
      ),
    [],
  );

  const availableSubcategories = useMemo(() => {
    if (!form.categoryId) return subcategories;

    return subcategories.filter((item) => {
      const parentId = getReferenceId(item.categoryId);
      return !parentId || parentId === form.categoryId;
    });
  }, [subcategories, form.categoryId]);

  const variantAttributes = useMemo(
    () =>
      attributes.filter(
        (attribute) =>
          attribute.isVariant &&
          (attribute.type === "SELECT" || attribute.type === "MULTI_SELECT") &&
          attribute.options.length > 0,
      ),
    [attributes],
  );

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  function generateVariantDrafts() {
    setVariantBuilderError("");
    const selectedAttributes = variantAttributeIds
      .map((id) => attributes.find((attribute) => attribute._id === id))
      .filter((attribute): attribute is Attribute => Boolean(attribute));

    if (selectedAttributes.length === 0) {
      setVariantBuilderError("Select at least one variant attribute.");
      return;
    }

    const selections = selectedAttributes.map((attribute) => ({
      name: attribute.name,
      values: variantSelections[attribute._id] ?? [],
    }));

    if (selections.some((selection) => selection.values.length === 0)) {
      setVariantBuilderError(
        "Choose at least one value for every selected attribute.",
      );
      return;
    }

    const combinations = getVariantCombinations(selections);
    if (combinations.length > 100) {
      setVariantBuilderError(
        "This creates more than 100 variants. Reduce selected values and try again.",
      );
      return;
    }

    setVariantDrafts(
      combinations.map((options) => ({
        options,
        title: Object.values(options).join(" / "),
        sku: "",
        barcode: "",
        price: form.price,
        compareAtPrice: "",
        costPrice: "",
        trackInventory: true,
        stockQuantity: "0",
        lowStockThreshold: form.lowStockThreshold || "5",
      })),
    );
  }

  function updateVariantDraft<K extends keyof VariantDraft>(
    index: number,
    key: K,
    value: VariantDraft[K],
  ) {
    setVariantDrafts((current) =>
      current.map((draft, draftIndex) =>
        draftIndex === index ? { ...draft, [key]: value } : draft,
      ),
    );
  }

  function handleImageSelection(files: File[]) {
    const invalid = files.find(
      (file) => !file.type.startsWith("image/") || file.size > 10 * 1024 * 1024,
    );

    if (files.length > 20 || invalid) {
      alert(
        files.length > 20
          ? "Select no more than 20 images."
          : `${invalid?.name ?? "Selected file"} must be an image no larger than 10 MB.`,
      );
      return;
    }

    setSelectedImages(files);
    imagePreviewRef.current.forEach((preview) => URL.revokeObjectURL(preview));
    const previews = files.map((file) => URL.createObjectURL(file));
    imagePreviewRef.current = previews;
    setImagePreviews(previews);
    setPrimaryImageIndex(0);
  }

  function clearImageSelection() {
    imagePreviewRef.current.forEach((preview) => URL.revokeObjectURL(preview));
    imagePreviewRef.current = [];
    setImagePreviews([]);
    setSelectedImages([]);
    setPrimaryImageIndex(0);
  }

  function openCreate() {
    setEditingId(null);
    setActiveWizardStep(0);
    clearImageSelection();
    setVariantAttributeIds([]);
    setVariantSelections({});
    setVariantDrafts([]);
    setVariantBuilderError("");
    const defaultWarehouse = warehouses.find(
      (warehouse) => warehouse.isDefault,
    );
    setForm({
      ...initialForm,
      type:
        new URLSearchParams(window.location.search).get("type") === "VARIABLE"
          ? "VARIABLE"
          : initialForm.type,
      inventoryWarehouseId: defaultWarehouse?._id ?? "",
    });
    setModalOpen(true);
  }

  async function openEdit(product: Product) {
    setEditingId(product._id);
    setActiveWizardStep(0);
    clearImageSelection();
    setVariantAttributeIds([]);
    setVariantSelections({});
    setVariantDrafts([]);

    try {
      const assignments = await productTagsAdminApi.getProductTags(product._id);
      setForm({
        ...createForm(product),
        tagIds: assignments.flatMap((assignment) => {
          if (typeof assignment.tagId === "string") {
            return [assignment.tagId];
          }
          return assignment.tagId?._id ? [assignment.tagId._id] : [];
        }),
      });
      setModalOpen(true);
    } catch (error) {
      alert(`Could not load product tags: ${errorMessage(error)}`);
    }
  }

  function validateWizardStep(step: number): boolean {
    if (step === 0) {
      if (form.name.trim().length < 2) {
        alert("Enter a product name with at least 2 characters.");
        return false;
      }

      const price = Number(form.price);
      if (!Number.isFinite(price) || price < 0) {
        alert("Enter a valid product price before continuing.");
        return false;
      }
    }

    if (step === 1 && !form.categoryId) {
      alert("Select a category before continuing.");
      return false;
    }

    if (step === 2) {
      const missingAttribute = attributes.find((attribute) => {
        if (
          !attribute.isRequired ||
          (form.type === "VARIABLE" && attribute.isVariant)
        ) {
          return false;
        }
        const value = form.attributes[attribute.slug];
        return (
          value === undefined ||
          value === null ||
          value === "" ||
          (Array.isArray(value) && value.length === 0)
        );
      });

      if (missingAttribute) {
        alert(`Please provide a value for ${missingAttribute.name}.`);
        return false;
      }
    }

    if (
      step === 3 &&
      !editingId &&
      form.type === "VARIABLE" &&
      variantDrafts.length === 0
    ) {
      alert("Generate at least one variant before continuing.");
      return false;
    }

    return true;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (activeWizardStep < PRODUCT_WIZARD_STEPS.length - 1) {
      if (!validateWizardStep(activeWizardStep)) return;

      setActiveWizardStep((step) =>
        Math.min(PRODUCT_WIZARD_STEPS.length - 1, step + 1),
      );
      return;
    }

    if (!form.name.trim()) {
      alert("Product name is required.");
      return;
    }

    if (!form.categoryId) {
      alert("Please select a category.");
      return;
    }

    if (
      !editingId &&
      form.type !== "VARIABLE" &&
      form.trackInventory &&
      !form.inventoryWarehouseId
    ) {
      alert("Please select an active warehouse for this product's inventory.");
      return;
    }

    if (form.type === "DIGITAL" && form.requiresShipping) {
      alert("Digital products cannot require shipping.");
      return;
    }

    const price = Number(form.price);
    const compareAtPrice =
      form.compareAtPrice.trim() === ""
        ? undefined
        : Number(form.compareAtPrice);

    const costPrice =
      form.costPrice.trim() === "" ? undefined : Number(form.costPrice);
    const salePrice =
      form.salePrice.trim() === "" ? undefined : Number(form.salePrice);
    const publishAt = toIsoDateTime(form.publishAt);
    const saleStartsAt = toIsoDateTime(form.saleStartsAt);
    const saleEndsAt = toIsoDateTime(form.saleEndsAt);

    if (!Number.isFinite(price) || price < 0) {
      alert("Please enter a valid product price.");
      return;
    }

    if (
      compareAtPrice !== undefined &&
      (!Number.isFinite(compareAtPrice) || compareAtPrice <= price)
    ) {
      alert("Compare-at price must be greater than the selling price.");
      return;
    }

    if (
      costPrice !== undefined &&
      (!Number.isFinite(costPrice) || costPrice < 0)
    ) {
      alert("Please enter a valid cost price.");
      return;
    }

    if (
      salePrice !== undefined &&
      (!Number.isFinite(salePrice) || salePrice < 0 || salePrice >= price)
    ) {
      alert(
        "Sale price must be a non-negative amount below the regular price.",
      );
      return;
    }

    if (
      form.salePrice.trim() &&
      ((form.saleStartsAt && !saleStartsAt) || (form.saleEndsAt && !saleEndsAt))
    ) {
      alert("Enter valid sale start and end dates.");
      return;
    }

    if (
      !form.salePrice.trim() &&
      (form.saleStartsAt.trim() || form.saleEndsAt.trim())
    ) {
      alert("Set a sale price before scheduling sale dates.");
      return;
    }

    if (
      saleStartsAt &&
      saleEndsAt &&
      new Date(saleStartsAt) >= new Date(saleEndsAt)
    ) {
      alert("Sale end time must be later than its start time.");
      return;
    }

    if (form.publishAt && (!publishAt || new Date(publishAt) <= new Date())) {
      alert("Scheduled publish time must be in the future.");
      return;
    }

    if (publishAt && form.status === "INACTIVE") {
      alert("Choose Draft or Active when scheduling a product to publish.");
      return;
    }

    const missingRequiredAttribute = attributes.find((attribute) => {
      if (
        !attribute.isRequired ||
        (form.type === "VARIABLE" && attribute.isVariant)
      ) {
        return false;
      }
      const value = form.attributes[attribute.slug];
      return (
        value === undefined ||
        value === null ||
        value === "" ||
        (Array.isArray(value) && value.length === 0)
      );
    });

    if (missingRequiredAttribute) {
      alert(`Please provide a value for ${missingRequiredAttribute.name}.`);
      return;
    }

    let variantInputs: VariantInput[] = [];
    if (!editingId && form.type === "VARIABLE") {
      if (variantDrafts.length === 0) {
        alert(
          "Generate at least one product variant before creating this product.",
        );
        return;
      }

      const optionCombinations = new Set<string>();
      const variantSkus = new Set<string>();
      const variantBarcodes = new Set<string>();
      const invalidVariant = variantDrafts.find((draft, index) => {
        const variantPrice = Number(draft.price);
        const variantCompareAtPrice =
          draft.compareAtPrice.trim() === ""
            ? undefined
            : Number(draft.compareAtPrice);
        const variantCostPrice =
          draft.costPrice.trim() === "" ? undefined : Number(draft.costPrice);
        const quantity = Number(draft.stockQuantity);
        const threshold = Number(draft.lowStockThreshold);
        const optionKey = JSON.stringify(
          Object.entries(draft.options)
            .map(([key, value]) => [key.toLowerCase(), value.toLowerCase()])
            .sort(([left], [right]) =>
              String(left).localeCompare(String(right)),
            ),
        );
        const sku = draft.sku.trim().toUpperCase();
        const barcode = draft.barcode.trim().toUpperCase();
        const invalid =
          !draft.title.trim() ||
          !draft.price.trim() ||
          Object.values(draft.options).some((value) => !value.trim()) ||
          !Number.isFinite(variantPrice) ||
          variantPrice < 0 ||
          (variantCompareAtPrice !== undefined &&
            (!Number.isFinite(variantCompareAtPrice) ||
              variantCompareAtPrice < variantPrice)) ||
          (variantCostPrice !== undefined &&
            (!Number.isFinite(variantCostPrice) || variantCostPrice < 0)) ||
          !Number.isSafeInteger(quantity) ||
          quantity < 0 ||
          !Number.isSafeInteger(threshold) ||
          threshold < 0 ||
          optionCombinations.has(optionKey) ||
          (Boolean(sku) && variantSkus.has(sku)) ||
          (Boolean(barcode) && variantBarcodes.has(barcode));

        optionCombinations.add(optionKey);
        if (sku) variantSkus.add(sku);
        if (barcode) variantBarcodes.add(barcode);

        if (invalid) {
          setVariantBuilderError(
            `Check the title, option combination, SKU, price, and stock values for variant ${index + 1}.`,
          );
        }
        return invalid;
      });

      if (invalidVariant) return;

      variantInputs = variantDrafts.map((draft, index) => ({
        title: draft.title.trim(),
        options: draft.options,
        ...(draft.sku.trim() ? { sku: draft.sku.trim() } : {}),
        ...(draft.barcode.trim() ? { barcode: draft.barcode.trim() } : {}),
        price: Number(draft.price),
        ...(draft.compareAtPrice.trim()
          ? { compareAtPrice: Number(draft.compareAtPrice) }
          : {}),
        ...(draft.costPrice.trim()
          ? { costPrice: Number(draft.costPrice) }
          : {}),
        trackInventory: draft.trackInventory,
        stockQuantity: draft.trackInventory ? Number(draft.stockQuantity) : 0,
        lowStockThreshold: draft.trackInventory
          ? Number(draft.lowStockThreshold)
          : 0,
        status: "ACTIVE",
        sortOrder: index,
      }));
    }

    const numberOrUndefined = (value: string) =>
      value.trim() === "" ? undefined : Number(value);
    const stockQuantity = numberOrUndefined(form.stockQuantity);

    if (
      !editingId &&
      form.type !== "VARIABLE" &&
      form.trackInventory &&
      (!Number.isSafeInteger(stockQuantity) || (stockQuantity ?? -1) < 0)
    ) {
      alert("Stock quantity must be a non-negative whole number.");
      return;
    }

    const payload: ProductInput = {
      name: form.name.trim(),
      slug: form.slug.trim() || undefined,
      description: form.description.trim() || undefined,
      shortDescription: form.shortDescription.trim() || undefined,
      type: form.type,
      status: publishAt ? "DRAFT" : form.status,
      visibility: form.visibility,
      publishAt: publishAt ?? (editingId && !form.publishAt ? null : undefined),
      sku: form.sku.trim() || undefined,
      barcode: form.barcode.trim() || undefined,
      sellerId: form.sellerId.trim() || undefined,
      categoryId: form.categoryId,
      subcategoryId: form.subcategoryId || undefined,
      brandId: form.brandId || undefined,
      collectionIds: form.collectionIds,
      tagIds: form.tagIds,
      price,
      compareAtPrice,
      costPrice,
      salePrice:
        salePrice ?? (editingId && !form.salePrice.trim() ? null : undefined),
      saleStartsAt:
        saleStartsAt ?? (editingId && !form.saleStartsAt ? null : undefined),
      saleEndsAt:
        saleEndsAt ?? (editingId && !form.saleEndsAt ? null : undefined),
      currency: form.currency.trim().toUpperCase(),
      ...(!editingId
        ? {
            trackInventory:
              form.type === "VARIABLE" ? false : form.trackInventory,
            stockQuantity: form.type === "VARIABLE" ? 0 : stockQuantity,
            lowStockThreshold: numberOrUndefined(form.lowStockThreshold),
            inventoryPolicy: form.inventoryPolicy,
          }
        : {}),
      requiresShipping: form.requiresShipping,
      shipping: {
        required: form.requiresShipping,
        weight: numberOrUndefined(form.weight),
        weightUnit: form.weightUnit,
        length: numberOrUndefined(form.length),
        width: numberOrUndefined(form.width),
        height: numberOrUndefined(form.height),
        dimensionUnit: form.dimensionUnit,
      },
      tags: form.tagsText
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      attributes: form.attributes,
      seo: {
        title: form.seoTitle.trim() || undefined,
        description: form.seoDescription.trim() || undefined,
        keywords: form.seoKeywords
          .split(",")
          .map((keyword) => keyword.trim())
          .filter(Boolean),
        canonicalUrl: form.canonicalUrl.trim() || undefined,
      },
      featured: form.featured,
      sortOrder: Number(form.sortOrder || 0),
    };

    setSaving(true);
    setError("");
    let keepSelectedImages = false;

    try {
      if (editingId) {
        await productsAdminApi.update(editingId, payload);
        alert("Product updated successfully.");
      } else {
        const setupRequiresSecondaryResources =
          variantInputs.length > 0 || selectedImages.length > 0;
        const shouldPublishAfterSetup =
          !publishAt &&
          form.status === "ACTIVE" &&
          setupRequiresSecondaryResources;
        setPendingPublishStatus(shouldPublishAfterSetup ? "ACTIVE" : null);
        const product = await productsAdminApi.create({
          ...payload,
          ...(shouldPublishAfterSetup ? { status: "DRAFT" as const } : {}),
          inventoryWarehouseId:
            form.type !== "VARIABLE" && form.trackInventory
              ? form.inventoryWarehouseId
              : undefined,
        });
        setCreatedProduct({
          id: product._id,
          name: product.name,
          type: product.type,
        });

        let variantSetupWarning = "";
        let createdVariantCount = 0;
        for (const variantInput of variantInputs) {
          try {
            await productVariantsAdminApi.create(product._id, variantInput);
            createdVariantCount += 1;
          } catch (variantError) {
            variantSetupWarning =
              `${createdVariantCount} of ${variantInputs.length} variants were created. ` +
              `Variant setup stopped because: ${errorMessage(variantError)} ` +
              "Use the Product Variants page to finish setup.";
            break;
          }
        }

        if (variantSetupWarning) {
          setPendingPublishStatus(null);
        }

        let imagesUploaded = selectedImages.length === 0;
        if (selectedImages.length > 0) {
          setUploadingInitialImages(true);
          setPendingImageProductId(product._id);
          try {
            await productImagesAdminApi.upload(product._id, {
              files: selectedImages,
              primaryIndex: primaryImageIndex,
            });
            clearImageSelection();
            setPendingImageProductId("");
            imagesUploaded = true;
          } catch (imageError) {
            keepSelectedImages = true;
            setError(
              `Product was created, but image upload failed: ${errorMessage(imageError)}`,
            );
          } finally {
            setUploadingInitialImages(false);
          }
        }

        if (shouldPublishAfterSetup && imagesUploaded && !variantSetupWarning) {
          try {
            await productsAdminApi.updateStatus(product._id, "ACTIVE");
            setPendingPublishStatus(null);
          } catch (publishError) {
            variantSetupWarning =
              `Product and related setup were created, but publishing failed: ${errorMessage(publishError)} ` +
              "Change its status from the Products list.";
            setPendingPublishStatus(null);
          }
        }

        if (variantSetupWarning) {
          setCreatedProduct({
            id: product._id,
            name: product.name,
            type: product.type,
            setupWarning: variantSetupWarning,
          });
        }
      }

      setModalOpen(false);
      setEditingId(null);
      setForm({ ...initialForm });
      setVariantAttributeIds([]);
      setVariantSelections({});
      setVariantDrafts([]);
      if (!keepSelectedImages) {
        clearImageSelection();
      }
      await loadProducts();
    } catch (error) {
      if (!editingId) {
        setPendingPublishStatus(null);
      }
      alert(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function retryInitialImageUpload() {
    if (!pendingImageProductId || selectedImages.length === 0) return;

    setUploadingInitialImages(true);
    setError("");

    try {
      await productImagesAdminApi.upload(pendingImageProductId, {
        files: selectedImages,
        primaryIndex: primaryImageIndex,
      });
      clearImageSelection();
      if (pendingPublishStatus === "ACTIVE") {
        try {
          await productsAdminApi.updateStatus(
            pendingImageProductId,
            pendingPublishStatus,
          );
          setPendingPublishStatus(null);
        } catch (publishError) {
          setCreatedProduct((current) =>
            current
              ? {
                  ...current,
                  setupWarning:
                    `Images uploaded, but product publishing failed: ${errorMessage(publishError)} ` +
                    "Change its status from the Products list.",
                }
              : current,
          );
          setPendingPublishStatus(null);
        }
      }
      setPendingImageProductId("");
      setError("");
    } catch (error) {
      setError(`Image upload failed: ${errorMessage(error)}`);
    } finally {
      setUploadingInitialImages(false);
    }
  }

  async function handleStatusChange(
    product: Product,
    nextStatus: ProductStatus,
  ) {
    if (product.status === "ARCHIVED") {
      alert("Archived products cannot be reactivated.");
      return;
    }

    if (!window.confirm(`Change "${product.name}" to ${nextStatus}?`)) {
      return;
    }

    try {
      await productsAdminApi.updateStatus(product._id, nextStatus);
      await loadProducts();
    } catch (error) {
      alert(errorMessage(error));
    }
  }

  async function handleArchive(product: Product) {
    if (
      !window.confirm(
        `Archive "${product.name}"? Archived products cannot be edited or reactivated through the status endpoint.`,
      )
    ) {
      return;
    }

    try {
      await productsAdminApi.archive(product._id);
      await loadProducts();
    } catch (error) {
      alert(errorMessage(error));
    }
  }

  const selectedCategoryName = (product: Product) =>
    typeof product.categoryId === "string"
      ? product.categoryId
      : (product.categoryId?.name ?? "—");

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Products
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage product catalog, pricing, inventory and SEO.
          </p>
        </div>

        <button
          onClick={openCreate}
          disabled={Boolean(pendingImageProductId)}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus size={18} />
          Create Product
        </button>
      </div>

      {createdProduct && (
        <section className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="font-semibold">
            {createdProduct.name} was created. Continue product setup:
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {createdProduct.type === "VARIABLE" && (
              <Link
                href={`/admin/product-variants?productId=${createdProduct.id}`}
                className="font-medium underline"
              >
                Manage variants
              </Link>
            )}
            <Link
              href={`/admin/product-images?productId=${createdProduct.id}`}
              className="font-medium underline"
            >
              Manage images
            </Link>
            <Link
              href={`/admin/product-tags?productId=${createdProduct.id}`}
              className="font-medium underline"
            >
              Manage tags
            </Link>
            <Link
              href={`/admin/inventory?productId=${createdProduct.id}`}
              className="font-medium underline"
            >
              Manage inventory
            </Link>
          </div>
          {createdProduct.setupWarning && (
            <p
              role="alert"
              className="rounded-md bg-amber-100 p-3 text-amber-900"
            >
              {createdProduct.setupWarning}
            </p>
          )}
          {pendingImageProductId && (
            <button
              type="button"
              disabled={uploadingInitialImages}
              onClick={() => void retryInitialImageUpload()}
              className="font-semibold underline disabled:opacity-50"
            >
              {uploadingInitialImages
                ? "Retrying image upload..."
                : "Retry image upload"}
            </button>
          )}
        </section>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      {relatedOptionsError && (
        <p
          role="alert"
          className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800"
        >
          Some product options could not be loaded: {relatedOptionsError}
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <p className="text-sm text-gray-500">Total Products</p>
          <p className="mt-1 text-2xl font-bold">{total}</p>
        </div>

        <div className="rounded-xl border bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <p className="text-sm text-gray-500">Loaded Products</p>
          <p className="mt-1 text-2xl font-bold">{products.length}</p>
        </div>

        <div className="rounded-xl border bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <p className="text-sm text-gray-500">Featured on Page</p>
          <p className="mt-1 text-2xl font-bold">
            {products.filter((product) => product.featured).length}
          </p>
        </div>
      </div>

      <div className="space-y-3 rounded-xl border bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <div className="relative">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search product name, SKU, barcode..."
            className="w-full rounded-lg border py-2.5 pl-10 pr-3 dark:border-gray-700 dark:bg-gray-800"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as "" | ProductStatus);
              setPage(1);
            }}
            className={inputClass}
          >
            <option value="">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="ARCHIVED">Archived</option>
          </select>

          <select
            value={type}
            onChange={(event) => {
              setType(event.target.value as "" | ProductType);
              setPage(1);
            }}
            className={inputClass}
          >
            <option value="">All Types</option>
            <option value="SIMPLE">Simple</option>
            <option value="VARIABLE">Variable</option>
            <option value="DIGITAL">Digital</option>
            <option value="SERVICE">Service</option>
          </select>

          <select
            value={categoryFilter}
            onChange={(event) => {
              setCategoryFilter(event.target.value);
              setPage(1);
            }}
            className={inputClass}
          >
            <option value="">All Categories</option>
            {categories.map((item) => (
              <option key={item._id} value={item._id}>
                {item.name}
              </option>
            ))}
          </select>

          <select
            value={brandFilter}
            onChange={(event) => {
              setBrandFilter(event.target.value);
              setPage(1);
            }}
            className={inputClass}
          >
            <option value="">All Brands</option>
            {brands.map((item) => (
              <option key={item._id} value={item._id}>
                {item.name}
              </option>
            ))}
          </select>

          <select
            value={featuredFilter}
            onChange={(event) => {
              setFeaturedFilter(event.target.value);
              setPage(1);
            }}
            className={inputClass}
          >
            <option value="">Featured: All</option>
            <option value="true">Featured</option>
            <option value="false">Not Featured</option>
          </select>

          <select
            value={stockFilter}
            onChange={(event) => {
              setStockFilter(event.target.value);
              setPage(1);
            }}
            className={inputClass}
          >
            <option value="">Stock: All</option>
            <option value="true">In Stock</option>
            <option value="false">Out of Stock</option>
          </select>

          <select
            value={sortBy}
            onChange={(event) => {
              setSortBy(event.target.value as ProductFilters["sortBy"]);
              setPage(1);
            }}
            className={inputClass}
          >
            <option value="createdAt">Created Date</option>
            <option value="updatedAt">Updated Date</option>
            <option value="name">Name</option>
            <option value="price">Price</option>
            <option value="sortOrder">Sort Order</option>
          </select>

          <select
            value={sortOrder}
            onChange={(event) => {
              setSortOrder(event.target.value as "asc" | "desc");
              setPage(1);
            }}
            className={inputClass}
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </div>

        <div className="flex justify-end">
          <button
            onClick={() => void loadProducts()}
            className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white dark:border-gray-700 dark:bg-gray-900">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-gray-500">
            <Loader2 className="animate-spin" size={20} />
            Loading products...
          </div>
        ) : products.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Package className="mx-auto mb-3" size={36} />
            <p className="font-medium">No products found</p>
            <p className="mt-1 text-sm">
              Try changing your filters or create a product.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800">
                <tr>
                  <th className="px-5 py-4">Product</th>
                  <th className="px-5 py-4">SKU</th>
                  <th className="px-5 py-4">Category</th>
                  <th className="px-5 py-4">Type</th>
                  <th className="px-5 py-4">Price</th>
                  <th className="px-5 py-4">Stock</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y dark:divide-gray-800">
                {products.map((product) => {
                  const activeSalePrice = getActiveSalePrice(product);

                  return (
                    <tr
                      key={product._id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
                            <Package size={18} className="text-gray-400" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white">
                              {product.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {product.slug}
                            </p>
                            {product.featured && (
                              <span className="mt-1 inline-flex items-center gap-1 text-xs text-amber-600">
                                <Star size={12} fill="currentColor" />
                                Featured
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">{product.sku || "—"}</td>
                      <td className="px-5 py-4">
                        {selectedCategoryName(product)}
                      </td>
                      <td className="px-5 py-4">{product.type}</td>
                      <td className="px-5 py-4">
                        {activeSalePrice !== undefined ? (
                          <div>
                            <span className="font-semibold text-red-600">
                              {activeSalePrice} {product.currency ?? "BDT"}
                            </span>
                            <span className="ml-2 text-xs text-gray-500 line-through">
                              {product.price}
                            </span>
                          </div>
                        ) : (
                          <>
                            {product.price} {product.currency ?? "BDT"}
                          </>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {product.trackInventory === false
                          ? "Not tracked"
                          : (product.stockQuantity ?? 0)}
                      </td>

                      <td className="px-5 py-4">
                        <select
                          value={product.status}
                          disabled={product.status === "ARCHIVED"}
                          onChange={(event) =>
                            void handleStatusChange(
                              product,
                              event.target.value as ProductStatus,
                            )
                          }
                          className="rounded-lg border px-2 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-800 disabled:opacity-50"
                        >
                          <option value="DRAFT">Draft</option>
                          <option value="ACTIVE">Active</option>
                          <option value="INACTIVE">Inactive</option>
                          {product.status === "ARCHIVED" && (
                            <option value="ARCHIVED">Archived</option>
                          )}
                        </select>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            title="Edit product"
                            disabled={product.status === "ARCHIVED"}
                            onClick={() => openEdit(product)}
                            className="rounded-lg border p-2 hover:bg-gray-100 disabled:opacity-40 dark:border-gray-700 dark:hover:bg-gray-800"
                          >
                            <Pencil size={16} />
                          </button>

                          <button
                            title="Archive product"
                            disabled={product.status === "ARCHIVED"}
                            onClick={() => void handleArchive(product)}
                            className="rounded-lg border p-2 text-red-600 hover:bg-red-50 disabled:opacity-40 dark:border-gray-700 dark:hover:bg-red-950"
                          >
                            <Archive size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-col items-center justify-between gap-3 border-t p-4 dark:border-gray-800 sm:flex-row">
          <p className="text-sm text-gray-500">
            {total} products · Page {page} of {totalPages}
          </p>

          <div className="flex gap-2">
            <button
              disabled={page <= 1 || loading}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              className="rounded-lg border p-2 disabled:opacity-40 dark:border-gray-700"
            >
              <ChevronLeft size={18} />
            </button>

            <button
              disabled={page >= totalPages || loading}
              onClick={() =>
                setPage((value) => Math.min(totalPages, value + 1))
              }
              className="rounded-lg border p-2 disabled:opacity-40 dark:border-gray-700"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-3">
          <div className="my-6 w-full max-w-5xl rounded-2xl bg-white p-5 shadow-xl dark:bg-gray-900 md:p-7">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">
                  {editingId ? "Edit Product" : "Create Product"}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Configure product information and settings.
                </p>
              </div>

              <button
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X size={20} />
              </button>
            </div>

            <nav
              aria-label="Product creation steps"
              className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7"
            >
              {PRODUCT_WIZARD_STEPS.map((step, index) => (
                <button
                  key={step}
                  type="button"
                  aria-current={activeWizardStep === index ? "step" : undefined}
                  onClick={() => {
                    if (
                      index <= activeWizardStep ||
                      validateWizardStep(activeWizardStep)
                    ) {
                      setActiveWizardStep(index);
                    }
                  }}
                  className={`rounded-lg border px-3 py-2 text-left text-xs font-medium ${
                    activeWizardStep === index
                      ? "border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                      : "border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-300"
                  }`}
                >
                  <span className="mr-1 opacity-60">{index + 1}.</span>
                  {step}
                </button>
              ))}
            </nav>

            <form noValidate onSubmit={handleSubmit} className="space-y-7">
              <section
                className={activeWizardStep === 0 ? "space-y-4" : "hidden"}
              >
                <h3 className="border-b pb-2 font-semibold dark:border-gray-700">
                  Basic Information
                </h3>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Product Name *">
                    <input
                      required
                      minLength={2}
                      maxLength={180}
                      value={form.name}
                      onChange={(event) =>
                        updateForm("name", event.target.value)
                      }
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Slug">
                    <input
                      maxLength={200}
                      value={form.slug}
                      onChange={(event) =>
                        updateForm("slug", event.target.value)
                      }
                      className={inputClass}
                      placeholder="product-slug"
                    />
                  </Field>

                  <Field label="Product Type">
                    <select
                      value={form.type}
                      onChange={(event) =>
                        updateForm("type", event.target.value as ProductType)
                      }
                      className={inputClass}
                    >
                      <option value="SIMPLE">Simple</option>
                      <option value="VARIABLE">Variable</option>
                      <option value="DIGITAL">Digital</option>
                      <option value="SERVICE">Service</option>
                    </select>
                  </Field>
                </div>

                <Field label="Short Description">
                  <textarea
                    rows={2}
                    maxLength={500}
                    value={form.shortDescription}
                    onChange={(event) =>
                      updateForm("shortDescription", event.target.value)
                    }
                    className={inputClass}
                  />
                </Field>

                <Field label="Full Description">
                  <textarea
                    rows={5}
                    maxLength={30000}
                    value={form.description}
                    onChange={(event) =>
                      updateForm("description", event.target.value)
                    }
                    className={inputClass}
                  />
                </Field>
              </section>

              <section
                className={activeWizardStep === 1 ? "space-y-4" : "hidden"}
              >
                <h3 className="border-b pb-2 font-semibold dark:border-gray-700">
                  Product Classification
                </h3>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Category *">
                    <select
                      required
                      value={form.categoryId}
                      onChange={(event) => {
                        updateForm("categoryId", event.target.value);
                        updateForm("subcategoryId", "");
                      }}
                      className={inputClass}
                    >
                      <option value="">Select category</option>
                      {categories.map((item) => (
                        <option key={item._id} value={item._id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  {categories.length === 0 && (
                    <p className="text-xs text-gray-500">
                      No categories loaded.{" "}
                      <Link
                        href="/admin/categories"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-blue-600 underline"
                      >
                        Manage categories
                      </Link>
                    </p>
                  )}

                  <Field label="Subcategory">
                    <select
                      value={form.subcategoryId}
                      onChange={(event) =>
                        updateForm("subcategoryId", event.target.value)
                      }
                      className={inputClass}
                    >
                      <option value="">Select subcategory</option>
                      {availableSubcategories.map((item) => (
                        <option key={item._id} value={item._id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Brand">
                    <select
                      value={form.brandId}
                      onChange={(event) =>
                        updateForm("brandId", event.target.value)
                      }
                      className={inputClass}
                    >
                      <option value="">Select brand</option>
                      {brands.map((item) => (
                        <option key={item._id} value={item._id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  {brands.length === 0 && (
                    <p className="text-xs text-gray-500">
                      No brands loaded.{" "}
                      <Link
                        href="/admin/brands"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-blue-600 underline"
                      >
                        Manage brands
                      </Link>
                    </p>
                  )}

                  <Field label="Seller ID (optional)">
                    <input
                      value={form.sellerId}
                      onChange={(event) =>
                        updateForm("sellerId", event.target.value)
                      }
                      className={inputClass}
                    />
                  </Field>
                </div>

                <MultiSelectDropdown
                  label="Collections"
                  options={collections.map((item) => ({
                    id: item._id,
                    label: item.name,
                  }))}
                  selectedIds={form.collectionIds}
                  onChange={(selectedIds) =>
                    updateForm("collectionIds", selectedIds)
                  }
                  emptyMessage={
                    <>
                      No collections available.{" "}
                      <Link
                        href="/admin/collections"
                        className="font-medium text-blue-600 underline"
                      >
                        Create a collection
                      </Link>
                    </>
                  }
                />
              </section>

              <section
                className={activeWizardStep === 0 ? "space-y-4" : "hidden"}
              >
                <h3 className="border-b pb-2 font-semibold dark:border-gray-700">
                  Pricing
                </h3>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <Field label="Price *">
                    <input
                      required
                      type="number"
                      min={0}
                      step="any"
                      value={form.price}
                      onChange={(event) =>
                        updateForm("price", event.target.value)
                      }
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Compare-at Price">
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={form.compareAtPrice}
                      onChange={(event) =>
                        updateForm("compareAtPrice", event.target.value)
                      }
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Cost Price">
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={form.costPrice}
                      onChange={(event) =>
                        updateForm("costPrice", event.target.value)
                      }
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Currency">
                    <input
                      maxLength={3}
                      minLength={3}
                      value={form.currency}
                      onChange={(event) =>
                        updateForm("currency", event.target.value.toUpperCase())
                      }
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Scheduled sale price">
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={form.salePrice}
                      onChange={(event) =>
                        updateForm("salePrice", event.target.value)
                      }
                      className={inputClass}
                      placeholder="Optional"
                    />
                  </Field>
                  <Field label="Sale starts">
                    <input
                      type="datetime-local"
                      value={form.saleStartsAt}
                      onChange={(event) =>
                        updateForm("saleStartsAt", event.target.value)
                      }
                      className={inputClass}
                      disabled={!form.salePrice}
                    />
                  </Field>
                  <Field label="Sale ends">
                    <input
                      type="datetime-local"
                      value={form.saleEndsAt}
                      onChange={(event) =>
                        updateForm("saleEndsAt", event.target.value)
                      }
                      className={inputClass}
                      disabled={!form.salePrice}
                    />
                  </Field>
                </div>
                <p className="text-xs text-gray-500">
                  Leave sale dates blank to make the sale price effective
                  immediately and keep it active until changed.
                </p>
              </section>

              <section
                className={activeWizardStep === 0 ? "space-y-4" : "hidden"}
              >
                <h3 className="border-b pb-2 font-semibold dark:border-gray-700">
                  Product Identifiers
                </h3>

                <div className="grid gap-4 md:grid-cols-3">
                  <Field label="SKU">
                    <input
                      maxLength={100}
                      value={form.sku}
                      onChange={(event) =>
                        updateForm("sku", event.target.value)
                      }
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Barcode">
                    <input
                      maxLength={100}
                      value={form.barcode}
                      onChange={(event) =>
                        updateForm("barcode", event.target.value)
                      }
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Sort Order">
                    <input
                      type="number"
                      min={-100000}
                      max={100000}
                      value={form.sortOrder}
                      onChange={(event) =>
                        updateForm("sortOrder", event.target.value)
                      }
                      className={inputClass}
                    />
                  </Field>
                </div>
              </section>

              <section
                className={activeWizardStep === 6 ? "space-y-4" : "hidden"}
              >
                <h3 className="border-b pb-2 font-semibold dark:border-gray-700">
                  Inventory
                </h3>

                {form.type === "VARIABLE" ? (
                  <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800 dark:bg-blue-950/30 dark:text-blue-200">
                    Inventory is managed per variant. Set stock levels for each
                    option below.
                  </p>
                ) : (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.trackInventory}
                      disabled={Boolean(editingId)}
                      onChange={(event) =>
                        updateForm("trackInventory", event.target.checked)
                      }
                    />
                    Track inventory
                  </label>
                )}

                {editingId && form.type !== "VARIABLE" && (
                  <p className="text-sm text-gray-500">
                    Manage warehouse stock and adjustments on the{" "}
                    <a
                      href="/admin/inventory"
                      className="font-medium text-blue-600 underline dark:text-blue-400"
                    >
                      Inventory page
                    </a>
                    .
                  </p>
                )}

                {!editingId &&
                  form.type !== "VARIABLE" &&
                  form.trackInventory && (
                    <>
                      <Field label="Initial Stock Warehouse *">
                        <select
                          required
                          value={form.inventoryWarehouseId}
                          disabled={
                            warehousesLoading || warehouses.length === 0
                          }
                          onChange={(event) =>
                            updateForm(
                              "inventoryWarehouseId",
                              event.target.value,
                            )
                          }
                          className={inputClass}
                        >
                          <option value="">
                            {warehousesLoading
                              ? "Loading warehouses..."
                              : "Select warehouse"}
                          </option>
                          {warehouses.map((warehouse) => (
                            <option key={warehouse._id} value={warehouse._id}>
                              {warehouse.name} ({warehouse.code})
                              {warehouse.isDefault ? " — Default" : ""}
                            </option>
                          ))}
                        </select>
                      </Field>
                      {warehouseError && (
                        <p role="alert" className="text-sm text-red-600">
                          Could not load warehouses: {warehouseError}
                        </p>
                      )}
                      {!warehousesLoading &&
                        !warehouseError &&
                        warehouses.length === 0 && (
                          <p className="text-sm text-amber-700 dark:text-amber-400">
                            Create an active warehouse before adding an
                            inventory-tracked product.{" "}
                            <a
                              href="/admin/warehouses"
                              className="font-medium underline"
                            >
                              Manage warehouses
                            </a>
                          </p>
                        )}
                    </>
                  )}

                {form.type !== "VARIABLE" && (
                  <div className="grid gap-4 md:grid-cols-3">
                    <Field label="Stock Quantity">
                      <input
                        type="number"
                        min={0}
                        disabled={!form.trackInventory || Boolean(editingId)}
                        value={form.stockQuantity}
                        onChange={(event) =>
                          updateForm("stockQuantity", event.target.value)
                        }
                        className={inputClass}
                      />
                    </Field>

                    <Field label="Low Stock Threshold">
                      <input
                        type="number"
                        min={0}
                        disabled={!form.trackInventory || Boolean(editingId)}
                        value={form.lowStockThreshold}
                        onChange={(event) =>
                          updateForm("lowStockThreshold", event.target.value)
                        }
                        className={inputClass}
                      />
                    </Field>

                    <Field label="Inventory Policy">
                      <select
                        value={form.inventoryPolicy}
                        disabled={!form.trackInventory || Boolean(editingId)}
                        onChange={(event) =>
                          updateForm(
                            "inventoryPolicy",
                            event.target.value as InventoryPolicy,
                          )
                        }
                        className={inputClass}
                      >
                        <option value="DENY">Deny when out of stock</option>
                        <option value="CONTINUE">Continue selling</option>
                      </select>
                    </Field>
                  </div>
                )}
              </section>

              <section
                className={activeWizardStep === 6 ? "space-y-4" : "hidden"}
              >
                <h3 className="border-b pb-2 font-semibold dark:border-gray-700">
                  Shipping
                </h3>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.requiresShipping}
                    onChange={(event) =>
                      updateForm("requiresShipping", event.target.checked)
                    }
                  />
                  This product requires shipping
                </label>

                <div className="grid gap-4 md:grid-cols-3">
                  <Field label="Weight">
                    <input
                      type="number"
                      min={0}
                      step="any"
                      disabled={!form.requiresShipping}
                      value={form.weight}
                      onChange={(event) =>
                        updateForm("weight", event.target.value)
                      }
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Weight Unit">
                    <select
                      disabled={!form.requiresShipping}
                      value={form.weightUnit}
                      onChange={(event) =>
                        updateForm(
                          "weightUnit",
                          event.target.value as "g" | "kg",
                        )
                      }
                      className={inputClass}
                    >
                      <option value="g">Gram</option>
                      <option value="kg">Kilogram</option>
                    </select>
                  </Field>

                  <Field label="Dimension Unit">
                    <select
                      disabled={!form.requiresShipping}
                      value={form.dimensionUnit}
                      onChange={(event) =>
                        updateForm(
                          "dimensionUnit",
                          event.target.value as "cm" | "m",
                        )
                      }
                      className={inputClass}
                    >
                      <option value="cm">Centimeter</option>
                      <option value="m">Meter</option>
                    </select>
                  </Field>

                  {(["length", "width", "height"] as const).map((key) => (
                    <Field
                      key={key}
                      label={key[0].toUpperCase() + key.slice(1)}
                    >
                      <input
                        type="number"
                        min={0}
                        step="any"
                        disabled={!form.requiresShipping}
                        value={form[key]}
                        onChange={(event) =>
                          updateForm(key, event.target.value)
                        }
                        className={inputClass}
                      />
                    </Field>
                  ))}
                </div>

                {form.type === "DIGITAL" && (
                  <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
                    Digital products cannot require shipping. Disable shipping
                    before saving.
                  </p>
                )}
              </section>

              <section
                className={activeWizardStep === 2 ? "space-y-4" : "hidden"}
              >
                <h3 className="border-b pb-2 font-semibold dark:border-gray-700">
                  Tags and Attributes
                </h3>

                <Field label="Search keywords (comma separated)">
                  <input
                    value={form.tagsText}
                    onChange={(event) =>
                      updateForm("tagsText", event.target.value)
                    }
                    className={inputClass}
                    placeholder="summer, trending, new"
                  />
                </Field>

                <MultiSelectDropdown
                  label="Managed product tags"
                  options={managedTags.map((tag) => ({
                    id: tag._id,
                    label: tag.name,
                  }))}
                  selectedIds={form.tagIds}
                  onChange={(selectedIds) => updateForm("tagIds", selectedIds)}
                  emptyMessage={
                    <>
                      No managed tags available.{" "}
                      <Link
                        href="/admin/product-tags"
                        className="font-medium text-blue-600 underline"
                      >
                        Create product tags
                      </Link>
                    </>
                  }
                />
                {relatedOptionsError.includes("product tags") && (
                  <p className="text-sm text-amber-700">
                    Tag options may be incomplete.{" "}
                    <Link
                      href="/admin/product-tags"
                      className="font-medium underline"
                    >
                      Manage product tags
                    </Link>
                  </p>
                )}

                <div className="space-y-3">
                  <div>
                    <span className={labelClass}>Product attributes</span>
                    <p className="text-xs text-gray-500">
                      Choose attributes from your catalog. Variant attributes
                      are marked for variable products.
                    </p>
                  </div>

                  <Field label="Add an attribute">
                    <select
                      value=""
                      onChange={(event) => {
                        const attribute = attributes.find(
                          (item) => item._id === event.target.value,
                        );
                        if (!attribute) return;

                        updateForm("attributes", {
                          ...form.attributes,
                          [attribute.slug]: getAttributeInitialValue(attribute),
                        });
                      }}
                      className={inputClass}
                    >
                      <option value="">Choose an attribute...</option>
                      {attributes
                        .filter(
                          (attribute) =>
                            !Object.prototype.hasOwnProperty.call(
                              form.attributes,
                              attribute.slug,
                            ),
                        )
                        .map((attribute) => (
                          <option key={attribute._id} value={attribute._id}>
                            {attribute.name}
                            {attribute.isVariant ? " — Variant option" : ""}
                            {attribute.isRequired ? " — Required" : ""}
                          </option>
                        ))}
                    </select>
                  </Field>

                  {attributes
                    .filter((attribute) =>
                      Object.prototype.hasOwnProperty.call(
                        form.attributes,
                        attribute.slug,
                      ),
                    )
                    .map((attribute) => {
                      const value = form.attributes[attribute.slug];
                      const updateAttributeValue = (nextValue: unknown) =>
                        updateForm("attributes", {
                          ...form.attributes,
                          [attribute.slug]: nextValue,
                        });

                      return (
                        <div
                          key={attribute._id}
                          className="grid gap-3 rounded-lg border p-3 dark:border-gray-700 sm:grid-cols-[1fr_auto] sm:items-end"
                        >
                          <Field label={attribute.name}>
                            {attribute.type === "SELECT" ? (
                              <select
                                value={typeof value === "string" ? value : ""}
                                onChange={(event) =>
                                  updateAttributeValue(event.target.value)
                                }
                                className={inputClass}
                              >
                                <option value="">
                                  Choose {attribute.name}
                                </option>
                                {attribute.options.map((option) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </select>
                            ) : attribute.type === "MULTI_SELECT" ? (
                              <select
                                multiple
                                size={Math.min(
                                  Math.max(attribute.options.length, 2),
                                  5,
                                )}
                                value={
                                  Array.isArray(value) ? value.map(String) : []
                                }
                                onChange={(event) =>
                                  updateAttributeValue(
                                    Array.from(
                                      event.currentTarget.selectedOptions,
                                      (option) => option.value,
                                    ),
                                  )
                                }
                                className={inputClass}
                              >
                                {attribute.options.map((option) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </select>
                            ) : attribute.type === "BOOLEAN" ? (
                              <select
                                value={
                                  typeof value === "boolean"
                                    ? String(value)
                                    : ""
                                }
                                onChange={(event) =>
                                  updateAttributeValue(
                                    event.target.value === "true",
                                  )
                                }
                                className={inputClass}
                              >
                                <option value="">Choose an option</option>
                                <option value="true">Yes</option>
                                <option value="false">No</option>
                              </select>
                            ) : (
                              <input
                                type={
                                  attribute.type === "NUMBER"
                                    ? "number"
                                    : "text"
                                }
                                step={
                                  attribute.type === "NUMBER"
                                    ? "any"
                                    : undefined
                                }
                                value={
                                  typeof value === "string" ||
                                  typeof value === "number"
                                    ? value
                                    : ""
                                }
                                onChange={(event) =>
                                  updateAttributeValue(
                                    attribute.type === "NUMBER" &&
                                      event.target.value !== ""
                                      ? Number(event.target.value)
                                      : event.target.value,
                                  )
                                }
                                className={inputClass}
                              />
                            )}
                          </Field>
                          <button
                            type="button"
                            disabled={attribute.isRequired}
                            onClick={() => {
                              const nextAttributes = { ...form.attributes };
                              delete nextAttributes[attribute.slug];
                              updateForm("attributes", nextAttributes);
                            }}
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-3 text-sm text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                            aria-label={`Remove ${attribute.name}`}
                          >
                            <X size={15} />
                            Remove
                          </button>
                        </div>
                      );
                    })}

                  {attributes.length === 0 && (
                    <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                      {relatedOptionsError.includes("attributes")
                        ? "Could not load active attributes. Existing values will be preserved. "
                        : "No active attributes found. "}
                      <Link
                        href="/admin/attributes/new"
                        className="font-medium text-blue-600 underline"
                      >
                        Create an attribute
                      </Link>
                    </p>
                  )}

                  {Object.keys(form.attributes).some(
                    (key) =>
                      !attributes.some((attribute) => attribute.slug === key),
                  ) && (
                    <details className="rounded-lg border p-3 text-sm dark:border-gray-700">
                      <summary className="cursor-pointer font-medium">
                        Existing custom attributes are preserved
                      </summary>
                      <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs text-gray-500">
                        {JSON.stringify(
                          Object.fromEntries(
                            Object.entries(form.attributes).filter(
                              ([key]) =>
                                !attributes.some(
                                  (attribute) => attribute.slug === key,
                                ),
                            ),
                          ),
                          null,
                          2,
                        )}
                      </pre>
                    </details>
                  )}
                </div>
              </section>

              {!editingId && form.type === "VARIABLE" && (
                <section
                  className={activeWizardStep === 3 ? "space-y-4" : "hidden"}
                >
                  <div className="border-b pb-2 dark:border-gray-700">
                    <h3 className="font-semibold">Product Variants</h3>
                    <p className="mt-1 text-xs text-gray-500">
                      Build size/color combinations from your saved variant
                      attributes, then set SKU, price, and stock per variant.
                    </p>
                  </div>

                  {variantAttributes.length === 0 ? (
                    <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                      Create an active Select or Multi-select attribute marked
                      as a variant option first.{" "}
                      <Link
                        href="/admin/attributes/new"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium underline"
                      >
                        Create variant attribute
                      </Link>
                    </p>
                  ) : (
                    <>
                      <div className="space-y-3">
                        {variantAttributes.map((attribute) => {
                          const checked = variantAttributeIds.includes(
                            attribute._id,
                          );
                          const selectedValues =
                            variantSelections[attribute._id] ?? [];

                          return (
                            <div
                              key={attribute._id}
                              className="rounded-lg border p-3 dark:border-gray-700"
                            >
                              <label className="flex items-center gap-2 text-sm font-medium">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(event) => {
                                    setVariantAttributeIds((current) =>
                                      event.target.checked
                                        ? [...current, attribute._id]
                                        : current.filter(
                                            (id) => id !== attribute._id,
                                          ),
                                    );
                                    setVariantBuilderError("");
                                  }}
                                />
                                {attribute.name}
                                <span className="text-xs font-normal text-gray-500">
                                  {attribute.type === "MULTI_SELECT"
                                    ? "Choose values"
                                    : "Choose options"}
                                </span>
                              </label>
                              {checked && (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {attribute.options.map((option) => (
                                    <label
                                      key={option}
                                      className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm dark:border-gray-700"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={selectedValues.includes(
                                          option,
                                        )}
                                        onChange={(event) =>
                                          setVariantSelections((current) => ({
                                            ...current,
                                            [attribute._id]: event.target
                                              .checked
                                              ? [...selectedValues, option]
                                              : selectedValues.filter(
                                                  (value) => value !== option,
                                                ),
                                          }))
                                        }
                                      />
                                      {option}
                                    </label>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <button
                        type="button"
                        onClick={generateVariantDrafts}
                        className="rounded-lg border border-blue-200 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-950/30"
                      >
                        {variantDrafts.length > 0
                          ? "Regenerate variants"
                          : "Generate variant combinations"}
                      </button>
                    </>
                  )}

                  {variantBuilderError && (
                    <p role="alert" className="text-sm text-red-600">
                      {variantBuilderError}
                    </p>
                  )}

                  {variantDrafts.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-sm font-medium">
                        {variantDrafts.length} variant
                        {variantDrafts.length === 1 ? "" : "s"} generated
                      </p>
                      {variantDrafts.map((variant, index) => (
                        <div
                          key={`${JSON.stringify(variant.options)}-${index}`}
                          className="space-y-3 rounded-xl border p-4 dark:border-gray-700"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-medium">
                              {Object.entries(variant.options)
                                .map(([name, value]) => `${name}: ${value}`)
                                .join(" / ")}
                            </p>
                            <button
                              type="button"
                              onClick={() =>
                                setVariantDrafts((current) =>
                                  current.filter(
                                    (_, draftIndex) => draftIndex !== index,
                                  ),
                                )
                              }
                              className="inline-flex items-center gap-1 text-xs text-red-600"
                              aria-label={`Remove variant ${variant.title}`}
                            >
                              <X size={14} />
                              Remove
                            </button>
                          </div>
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={variant.trackInventory}
                              onChange={(event) =>
                                updateVariantDraft(
                                  index,
                                  "trackInventory",
                                  event.target.checked,
                                )
                              }
                            />
                            Track inventory for this variant
                          </label>
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            <Field label="Variant title">
                              <input
                                required
                                value={variant.title}
                                onChange={(event) =>
                                  updateVariantDraft(
                                    index,
                                    "title",
                                    event.target.value,
                                  )
                                }
                                className={inputClass}
                              />
                            </Field>
                            <Field label="SKU">
                              <input
                                value={variant.sku}
                                onChange={(event) =>
                                  updateVariantDraft(
                                    index,
                                    "sku",
                                    event.target.value,
                                  )
                                }
                                className={inputClass}
                              />
                            </Field>
                            <Field label="Barcode">
                              <input
                                value={variant.barcode}
                                onChange={(event) =>
                                  updateVariantDraft(
                                    index,
                                    "barcode",
                                    event.target.value,
                                  )
                                }
                                className={inputClass}
                              />
                            </Field>
                            <Field label="Price">
                              <input
                                required
                                type="number"
                                min={0}
                                step="any"
                                value={variant.price}
                                onChange={(event) =>
                                  updateVariantDraft(
                                    index,
                                    "price",
                                    event.target.value,
                                  )
                                }
                                className={inputClass}
                              />
                            </Field>
                            <Field label="Compare-at price">
                              <input
                                type="number"
                                min={0}
                                step="any"
                                value={variant.compareAtPrice}
                                onChange={(event) =>
                                  updateVariantDraft(
                                    index,
                                    "compareAtPrice",
                                    event.target.value,
                                  )
                                }
                                className={inputClass}
                              />
                            </Field>
                            <Field label="Cost price">
                              <input
                                type="number"
                                min={0}
                                step="any"
                                value={variant.costPrice}
                                onChange={(event) =>
                                  updateVariantDraft(
                                    index,
                                    "costPrice",
                                    event.target.value,
                                  )
                                }
                                className={inputClass}
                              />
                            </Field>
                            <Field label="Initial stock">
                              <input
                                type="number"
                                min={0}
                                step={1}
                                disabled={!variant.trackInventory}
                                value={variant.stockQuantity}
                                onChange={(event) =>
                                  updateVariantDraft(
                                    index,
                                    "stockQuantity",
                                    event.target.value,
                                  )
                                }
                                className={inputClass}
                              />
                            </Field>
                            <Field label="Low stock threshold">
                              <input
                                type="number"
                                min={0}
                                step={1}
                                disabled={!variant.trackInventory}
                                value={variant.lowStockThreshold}
                                onChange={(event) =>
                                  updateVariantDraft(
                                    index,
                                    "lowStockThreshold",
                                    event.target.value,
                                  )
                                }
                                className={inputClass}
                              />
                            </Field>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-gray-500">
                    Product and variants are saved in sequence. If a variant
                    cannot be saved, the product remains available and you can
                    finish setup from Product Variants.
                  </p>
                </section>
              )}
              {(editingId || form.type !== "VARIABLE") &&
                activeWizardStep === 3 && (
                  <section className="space-y-3 rounded-xl border p-4 dark:border-gray-700">
                    <h3 className="font-semibold">Product Variants</h3>
                    {editingId ? (
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        Manage existing variants after saving product changes.{" "}
                        <Link
                          href={`/admin/product-variants?productId=${editingId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-blue-600 underline"
                        >
                          Open Product Variants
                        </Link>
                      </p>
                    ) : (
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        This is a {form.type.toLowerCase()} product, so it
                        doesn&apos;t need product variants. Change Product Type
                        to Variable in Basic Info if this item has options.
                      </p>
                    )}
                  </section>
                )}

              {!editingId && (
                <section
                  className={activeWizardStep === 4 ? "space-y-4" : "hidden"}
                >
                  <h3 className="border-b pb-2 font-semibold dark:border-gray-700">
                    Product Images
                  </h3>
                  <Field label="Images (optional, up to 20 files, 10 MB each)">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(event) => {
                        handleImageSelection(
                          Array.from(event.currentTarget.files ?? []),
                        );
                      }}
                      className={inputClass}
                    />
                  </Field>
                  {selectedImages.length > 0 && (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                      {selectedImages.map((file, index) => (
                        <div
                          key={`${file.name}-${file.lastModified}-${index}`}
                          className="overflow-hidden rounded-lg border dark:border-gray-700"
                        >
                          <div className="relative aspect-square bg-gray-100 dark:bg-gray-800">
                            <Image
                              src={imagePreviews[index] ?? ""}
                              alt={`Product image preview: ${file.name}`}
                              fill
                              unoptimized
                              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                              className="object-cover"
                            />
                          </div>
                          <div className="space-y-2 p-2">
                            <p className="truncate text-xs" title={file.name}>
                              {file.name}
                            </p>
                            <div className="flex items-center justify-between gap-1">
                              <button
                                type="button"
                                onClick={() => setPrimaryImageIndex(index)}
                                className={`rounded px-2 py-1 text-xs ${
                                  primaryImageIndex === index
                                    ? "bg-blue-600 text-white"
                                    : "border dark:border-gray-700"
                                }`}
                              >
                                {primaryImageIndex === index
                                  ? "Primary"
                                  : "Set primary"}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const nextPreviews = imagePreviews.filter(
                                    (_, imageIndex) => imageIndex !== index,
                                  );
                                  const removedPreview = imagePreviews[index];
                                  if (removedPreview) {
                                    URL.revokeObjectURL(removedPreview);
                                  }
                                  imagePreviewRef.current = nextPreviews;
                                  setSelectedImages((current) =>
                                    current.filter(
                                      (_, imageIndex) => imageIndex !== index,
                                    ),
                                  );
                                  setImagePreviews(nextPreviews);
                                  setPrimaryImageIndex((current) =>
                                    current === index
                                      ? 0
                                      : current > index
                                        ? current - 1
                                        : current,
                                  );
                                }}
                                aria-label={`Remove ${file.name}`}
                                className="rounded p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                              >
                                <X size={15} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-gray-500">
                    Choose image files from your device. Images upload after
                    product creation; select which one should be primary.
                  </p>
                </section>
              )}
              {editingId && activeWizardStep === 4 && (
                <section className="space-y-3 rounded-xl border p-4 dark:border-gray-700">
                  <h3 className="font-semibold">Product Images</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Manage existing product images from the dedicated image
                    library.{" "}
                    <Link
                      href={`/admin/product-images?productId=${editingId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-blue-600 underline"
                    >
                      Open Product Images
                    </Link>
                  </p>
                </section>
              )}

              <section
                className={activeWizardStep === 5 ? "space-y-4" : "hidden"}
              >
                <h3 className="border-b pb-2 font-semibold dark:border-gray-700">
                  SEO
                </h3>

                <Field label="SEO Title">
                  <input
                    maxLength={70}
                    value={form.seoTitle}
                    onChange={(event) =>
                      updateForm("seoTitle", event.target.value)
                    }
                    className={inputClass}
                  />
                </Field>

                <Field label="SEO Description">
                  <textarea
                    rows={2}
                    maxLength={320}
                    value={form.seoDescription}
                    onChange={(event) =>
                      updateForm("seoDescription", event.target.value)
                    }
                    className={inputClass}
                  />
                </Field>

                <Field label="SEO Keywords (comma separated)">
                  <input
                    value={form.seoKeywords}
                    onChange={(event) =>
                      updateForm("seoKeywords", event.target.value)
                    }
                    className={inputClass}
                  />
                </Field>

                <Field label="Canonical URL">
                  <input
                    type="url"
                    value={form.canonicalUrl}
                    onChange={(event) =>
                      updateForm("canonicalUrl", event.target.value)
                    }
                    className={inputClass}
                  />
                </Field>
              </section>

              <section
                className={`flex flex-wrap gap-6 border-t pt-5 dark:border-gray-700 ${
                  activeWizardStep === 6 ? "" : "hidden"
                }`}
              >
                <h3 className="w-full border-b pb-2 font-semibold dark:border-gray-700">
                  Publish
                </h3>
                <div className="grid w-full gap-4 md:grid-cols-2">
                  <Field label="Product status">
                    <select
                      value={form.status}
                      onChange={(event) =>
                        updateForm(
                          "status",
                          event.target.value as ProductStatus,
                        )
                      }
                      className={inputClass}
                      disabled={Boolean(form.publishAt)}
                    >
                      <option value="DRAFT">Draft</option>
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                    </select>
                  </Field>
                  <Field label="Store visibility">
                    <select
                      value={form.visibility}
                      onChange={(event) =>
                        updateForm(
                          "visibility",
                          event.target.value as ProductVisibility,
                        )
                      }
                      className={inputClass}
                    >
                      <option value="VISIBLE">Visible in storefront</option>
                      <option value="HIDDEN">Hidden from storefront</option>
                    </select>
                  </Field>
                  <Field label="Schedule publication (optional)">
                    <input
                      type="datetime-local"
                      min={toDateTimeLocal(new Date().toISOString())}
                      value={form.publishAt}
                      onChange={(event) =>
                        updateForm("publishAt", event.target.value)
                      }
                      className={inputClass}
                    />
                  </Field>
                  <div className="flex items-end">
                    <p className="text-xs text-gray-500">
                      Scheduled products stay in Draft and publish automatically
                      at the chosen time. Visibility controls whether an active
                      product appears in the storefront.
                    </p>
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.featured}
                    onChange={(event) =>
                      updateForm("featured", event.target.checked)
                    }
                  />
                  <Star size={16} className="text-amber-500" />
                  Featured Product
                </label>
              </section>

              <div className="flex justify-end gap-3 border-t pt-5 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border px-4 py-2.5 dark:border-gray-700"
                >
                  Cancel
                </button>

                {activeWizardStep > 0 && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() =>
                      setActiveWizardStep((step) => Math.max(0, step - 1))
                    }
                    className="rounded-lg border px-4 py-2.5 dark:border-gray-700"
                  >
                    Back
                  </button>
                )}
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="animate-spin" size={17} />
                  ) : activeWizardStep === PRODUCT_WIZARD_STEPS.length - 1 ? (
                    <Save size={17} />
                  ) : null}
                  {activeWizardStep === PRODUCT_WIZARD_STEPS.length - 1
                    ? editingId
                      ? "Save Changes"
                      : "Create Product"
                    : `Continue to ${PRODUCT_WIZARD_STEPS[activeWizardStep + 1]}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
