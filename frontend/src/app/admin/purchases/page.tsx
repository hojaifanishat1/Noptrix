"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Search,
  RefreshCw,
  Plus,
  Eye,
  Pencil,
  CheckCircle,
  ClipboardList,
  Truck,
  PackageCheck,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ShoppingCart,
  Wallet,
  X,
} from "lucide-react";

import { purchasesAdminApi } from "@/services/api/purchases-admin.api";
import { productVariantsAdminApi } from "@/services/api/product-variants-admin.api";

import type {
  Purchase,
  PurchaseFilters,
  PurchaseInput,
  PurchaseItemInput,
  PurchaseStatus,
  PurchaseSummary,
  SupplierOption,
} from "@/features/purchases/purchase.types";

import type { Warehouse } from "@/features/warehouses/warehouse.types";
import type { Product } from "@/features/products/product.types";
import type { ProductVariant } from "@/features/product-variants/variant.types";

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-gray-700 dark:bg-gray-800 dark:text-white";

const labelClass =
  "mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300";

const emptyPagination = {
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0,
  hasNextPage: false,
  hasPreviousPage: false,
};

const emptySummary: PurchaseSummary = {
  total: 0,
  byStatus: [],
  paymentSummary: [],
};

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

function money(value: number, currency = "BDT") {
  const amount = Number(value || 0);

  if (currency === "BDT") {
    return `৳${amount.toLocaleString("en-BD", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function referenceName(
  value: string | { _id: string; name?: string; code?: string },
) {
  return typeof value === "string"
    ? value
    : value.name || value.code || value._id;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    DRAFT: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    PENDING: "bg-amber-100 text-amber-700",
    APPROVED: "bg-blue-100 text-blue-700",
    ORDERED: "bg-indigo-100 text-indigo-700",
    PARTIALLY_RECEIVED: "bg-orange-100 text-orange-700",
    RECEIVED: "bg-green-100 text-green-700",
    CANCELLED: "bg-red-100 text-red-700",
    UNPAID: "bg-red-100 text-red-700",
    PARTIALLY_PAID: "bg-amber-100 text-amber-700",
    PAID: "bg-green-100 text-green-700",
    REFUNDED: "bg-purple-100 text-purple-700",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
        styles[status] || styles.DRAFT
      }`}
    >
      {status.replaceAll("_", " ")}
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
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
      <div className="my-8 w-full max-w-3xl rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-200 p-5 dark:border-gray-800">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X size={19} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export default function AdminPurchasesPage() {
  const [items, setItems] = useState<Purchase[]>([]);
  const [summary, setSummary] = useState<PurchaseSummary>(emptySummary);
  const [pagination, setPagination] = useState(emptyPagination);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [variantsByProduct, setVariantsByProduct] = useState<
    Record<string, ProductVariant[]>
  >({});
  const [linkProducts, setLinkProducts] = useState<Product[]>([]);

  const [filters, setFilters] = useState<PurchaseFilters>({
    page: 1,
    limit: 20,
    search: "",
    supplierId: "",
    warehouseId: "",
    status: "",
    paymentStatus: "",
    sortBy: "createdAt",
    sortOrder: "desc",
  });

  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [optionsError, setOptionsError] = useState("");
  const [actionError, setActionError] = useState("");
  const [linkingItemId, setLinkingItemId] = useState("");
  const [productLinks, setProductLinks] = useState<Record<string, string>>({});
  const [receiveQuantities, setReceiveQuantities] = useState<
    Record<string, string>
  >({});

  const [modal, setModal] = useState<
    | ""
    | "create"
    | "edit"
    | "details"
    | "receive"
    | "payment"
    | "cancel"
    | "order"
  >("");

  const [selected, setSelected] = useState<Purchase | null>(null);

  const [form, setForm] = useState<PurchaseInput>({
    supplierId: "",
    warehouseId: "",
    items: [
      { productId: "", productMode: "catalog", quantity: 1, unitCost: 0 },
    ],
    discountAmount: 0,
    shippingCost: 0,
    currency: "BDT",
    notes: "",
    referenceNumber: "",
  });

  const [actionForm, setActionForm] = useState({
    note: "",
    reason: "",
    amount: "",
    method: "CASH",
    referenceNumber: "",
    expectedDeliveryDate: "",
  });

  const loadOptions = useCallback(async () => {
    const results = await Promise.allSettled([
      purchasesAdminApi.suppliers(),
      purchasesAdminApi.warehouses(),
      purchasesAdminApi.products(),
    ]);

    let variantFailures: string[] = [];

    if (results[0].status === "fulfilled") setSuppliers(results[0].value);
    if (results[1].status === "fulfilled") setWarehouses(results[1].value);
    if (results[2].status === "fulfilled") {
      const loadedProducts = results[2].value.filter(
        (product) =>
          product.status !== "ARCHIVED" &&
          (product.type === "VARIABLE" || product.trackInventory),
      );
      setProducts(loadedProducts);
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
          ).items,
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
      variantFailures = variantResults.flatMap((result, index) =>
        result.status === "rejected"
          ? [
              `variants for ${variableProducts[index]?.name ?? "product"}: ${errorMessage(result.reason)}`,
            ]
          : [],
      );
    }

    const optionNames = ["suppliers", "warehouses", "products"];
    const failures = results.flatMap((result, index) =>
      result.status === "rejected"
        ? [`${optionNames[index]}: ${errorMessage(result.reason)}`]
        : [],
    );
    failures.push(...variantFailures);
    setOptionsError(
      failures.length
        ? `Could not load form options (${failures.join("; ")}).`
        : "",
    );
  }, []);

  const loadProductsForLinking = useCallback(async () => {
    try {
      const result = await purchasesAdminApi.products();
      const availableProducts = result.filter(
        (product) =>
          product.status !== "ARCHIVED" &&
          (product.type === "VARIABLE" || product.trackInventory),
      );
      setLinkProducts(availableProducts);
      const variableProducts = availableProducts.filter(
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
      setVariantsByProduct((current) => ({
        ...current,
        ...Object.fromEntries(
          variantResults.flatMap((variantResult) =>
            variantResult.status === "fulfilled"
              ? [[variantResult.value.productId, variantResult.value.variants]]
              : [],
          ),
        ),
      }));
      const failedVariants = variantResults.filter(
        (variantResult) => variantResult.status === "rejected",
      );
      if (failedVariants.length) {
        setActionError(
          `Could not load variant choices for ${failedVariants.length} product(s).`,
        );
      }
    } catch (err) {
      setActionError(errorMessage(err));
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [result, summaryResult] = await Promise.all([
        purchasesAdminApi.list(filters),
        purchasesAdminApi.summary(),
      ]);

      setItems(result.items);
      setPagination(result.pagination);
      setSummary(summaryResult);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void Promise.resolve().then(loadOptions);
  }, [loadOptions]);

  useEffect(() => {
    void Promise.resolve().then(loadData);
  }, [loadData]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("restock") !== "1") return;

    const productId = params.get("productId") || "";
    const variantId = params.get("variantId") || "";
    const warehouseId = params.get("warehouseId") || "";
    const quantity = Number(params.get("quantity"));
    const objectIdPattern = /^[a-f\d]{24}$/i;

    void Promise.resolve().then(() => {
      if (
        !objectIdPattern.test(productId) ||
        !objectIdPattern.test(warehouseId) ||
        (variantId && !objectIdPattern.test(variantId)) ||
        !Number.isSafeInteger(quantity) ||
        quantity < 1
      ) {
        setActionError("Could not prepare a restock purchase from this alert.");
        setModal("create");
        return;
      }

      setForm((current) => ({
        ...current,
        warehouseId,
        items: [
          {
            productId,
            ...(variantId ? { variantId } : {}),
            productMode: "catalog",
            quantity,
            unitCost: 0,
          },
        ],
      }));
      setModal("create");
      window.history.replaceState(
        window.history.state,
        "",
        window.location.pathname,
      );
    });
  }, []);

  const updateFilter = <K extends keyof PurchaseFilters>(
    key: K,
    value: PurchaseFilters[K],
  ) => {
    setFilters((current) => ({ ...current, [key]: value, page: 1 }));
  };

  const resetForm = () => {
    setForm({
      supplierId: "",
      warehouseId: "",
      items: [
        { productId: "", productMode: "catalog", quantity: 1, unitCost: 0 },
      ],
      discountAmount: 0,
      shippingCost: 0,
      currency: "BDT",
      notes: "",
      referenceNumber: "",
    });
  };

  const openCreate = () => {
    setSelected(null);
    resetForm();
    setActionError("");
    setModal("create");
  };

  const openEdit = (purchase: Purchase) => {
    setSelected(purchase);

    setForm({
      supplierId:
        typeof purchase.supplierId === "string"
          ? purchase.supplierId
          : purchase.supplierId._id,
      warehouseId:
        typeof purchase.warehouseId === "string"
          ? purchase.warehouseId
          : purchase.warehouseId._id,
      items: purchase.items.map((item) => ({
        productId: item.productId
          ? typeof item.productId === "string"
            ? item.productId
            : item.productId._id
          : "",
        productMode: item.productId ? "catalog" : "new",
        ...(!item.productId
          ? { productName: item.productName, sku: item.sku }
          : {}),
        ...(item.variantId
          ? {
              variantId:
                typeof item.variantId === "string"
                  ? item.variantId
                  : item.variantId._id,
            }
          : {}),
        quantity: item.quantity,
        unitCost: item.unitCost,
        discountAmount: item.discountAmount,
        taxRate: item.taxRate,
      })),
      discountAmount: purchase.discountAmount,
      shippingCost: purchase.shippingCost,
      currency: "BDT",
      expectedDeliveryDate: purchase.expectedDeliveryDate?.slice(0, 10),
      notes: purchase.notes || "",
      referenceNumber: purchase.referenceNumber || "",
    });

    setActionError("");
    setModal("edit");
  };

  const openDetails = async (purchase: Purchase) => {
    setSelected(purchase);
    setActionError("");
    setModal("details");

    try {
      const latest = await purchasesAdminApi.get(purchase._id);
      setSelected(latest);
    } catch (err) {
      setActionError(errorMessage(err));
    }
  };

  const savePurchase = async () => {
    setSaving(true);
    setActionError("");

    try {
      if (
        !suppliers.some((supplier) => supplier._id === form.supplierId) ||
        !warehouses.some((warehouse) => warehouse._id === form.warehouseId) ||
        !form.items.length
      ) {
        throw new Error("Supplier, warehouse and items are required.");
      }

      if (
        form.items.some((item) => {
          const product = products.find(
            (candidate) => candidate._id === item.productId,
          );
          const variant = item.variantId
            ? variantsByProduct[item.productId ?? ""]?.find(
                (candidate) => candidate._id === item.variantId,
              )
            : undefined;
          const validIdentity =
            item.productMode === "new"
              ? Boolean(
                  item.productName?.trim() &&
                  item.productName.trim().length >= 2 &&
                  item.productName.trim().length <= 250,
                )
              : Boolean(
                  product &&
                  (product.type === "VARIABLE" || product.trackInventory),
                );
          const needsVariant = product?.type === "VARIABLE";
          return (
            !validIdentity ||
            (needsVariant && (!variant || !variant.trackInventory)) ||
            (item.variantId && !needsVariant) ||
            !Number.isSafeInteger(item.quantity) ||
            item.quantity < 1 ||
            item.quantity > 1_000_000 ||
            !Number.isFinite(item.unitCost) ||
            item.unitCost < 0 ||
            item.unitCost > 1_000_000_000 ||
            !Number.isFinite(item.discountAmount ?? 0) ||
            (item.discountAmount ?? 0) < 0 ||
            (item.discountAmount ?? 0) > 1_000_000_000 ||
            (item.discountAmount ?? 0) > item.quantity * item.unitCost ||
            !Number.isFinite(item.taxRate ?? 0) ||
            (item.taxRate ?? 0) < 0 ||
            (item.taxRate ?? 0) > 100
          );
        })
      ) {
        throw new Error(
          "Choose a tracked product and valid tracked variant, or enter a product name; quantities, costs, discounts, and tax rates must be valid.",
        );
      }

      if (
        !Number.isFinite(form.discountAmount ?? 0) ||
        (form.discountAmount ?? 0) < 0 ||
        (form.discountAmount ?? 0) > 1_000_000_000 ||
        !Number.isFinite(form.shippingCost ?? 0) ||
        (form.shippingCost ?? 0) < 0 ||
        (form.shippingCost ?? 0) > 1_000_000_000
      ) {
        throw new Error(
          "Purchase discount and shipping cost must be valid amounts.",
        );
      }

      const payload: PurchaseInput = {
        ...form,
        items: form.items.map((item) => {
          if (item.productMode === "new") {
            return {
              productName: item.productName?.trim(),
              sku: item.sku?.trim() || undefined,
              quantity: item.quantity,
              unitCost: item.unitCost,
              discountAmount: item.discountAmount,
              taxRate: item.taxRate,
            };
          }

          return {
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            unitCost: item.unitCost,
            discountAmount: item.discountAmount,
            taxRate: item.taxRate,
          };
        }),
        currency: "BDT",
        expectedDeliveryDate: form.expectedDeliveryDate || undefined,
        notes: form.notes || undefined,
        referenceNumber: form.referenceNumber || undefined,
      };

      if (modal === "edit" && selected) {
        await purchasesAdminApi.update(selected._id, payload);
      } else {
        await purchasesAdminApi.create(payload);
      }

      setModal("");
      setSelected(null);
      resetForm();
      await loadData();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (action: string) => {
    if (!selected) return;

    setSaving(true);
    setActionError("");

    try {
      if (action === "approve") {
        await purchasesAdminApi.approve(
          selected._id,
          actionForm.note || undefined,
        );
      } else if (action === "order") {
        await purchasesAdminApi.order(selected._id, {
          note: actionForm.note || undefined,
          expectedDeliveryDate: actionForm.expectedDeliveryDate || undefined,
        });
      } else if (action === "receive") {
        const receiveItems = selected.items
          .map((item, index) => ({
            productId: item.productId
              ? typeof item.productId === "string"
                ? item.productId
                : item.productId._id
              : "",
            ...(item.variantId
              ? {
                  variantId:
                    typeof item.variantId === "string"
                      ? item.variantId
                      : item.variantId._id,
                }
              : {}),
            quantity: Number(receiveQuantities[item._id ?? String(index)] ?? 0),
            remaining: item.quantity - item.receivedQuantity,
          }))
          .filter((item) => item.quantity > 0);

        if (
          !receiveItems.length ||
          receiveItems.some(
            (item) =>
              !item.productId ||
              !Number.isSafeInteger(item.quantity) ||
              item.quantity > item.remaining,
          )
        ) {
          throw new Error(
            "Choose a linked item and enter a whole quantity within its remaining amount.",
          );
        }

        await purchasesAdminApi.receive(selected._id, {
          items: receiveItems.map(({ productId, variantId, quantity }) => ({
            productId,
            ...(variantId ? { variantId } : {}),
            quantity,
          })),
          note: actionForm.note || undefined,
        });
      } else if (action === "payment") {
        const amount = Number(actionForm.amount);
        if (!Number.isFinite(amount) || amount <= 0) {
          throw new Error("Enter a valid payment amount.");
        }

        await purchasesAdminApi.recordPayment(selected._id, {
          amount,
          method: actionForm.method,
          referenceNumber: actionForm.referenceNumber || undefined,
          note: actionForm.note || undefined,
        });
      } else if (action === "cancel") {
        if (actionForm.reason.trim().length < 3) {
          throw new Error("Cancellation reason must be at least 3 characters.");
        }

        await purchasesAdminApi.cancel(selected._id, actionForm.reason);
      }

      setModal("");
      setActionForm({
        note: "",
        reason: "",
        amount: "",
        method: "CASH",
        referenceNumber: "",
        expectedDeliveryDate: "",
      });
      await loadData();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const addItem = () => {
    setForm((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          productId: "",
          productMode: "catalog",
          quantity: 1,
          unitCost: 0,
          discountAmount: 0,
          taxRate: 0,
        },
      ],
    }));
  };

  const getUnaddedVariants = (productId: string) => {
    const addedVariantIds = new Set(
      form.items
        .filter((item) => item.productId === productId && item.variantId)
        .map((item) => item.variantId),
    );

    return (variantsByProduct[productId] ?? []).filter(
      (variant) => variant.trackInventory && !addedVariantIds.has(variant._id),
    );
  };

  const addAllVariants = (index: number) => {
    const currentItem = form.items[index];
    if (!currentItem?.productId) return;

    const productId = currentItem.productId;
    const variants = (variantsByProduct[productId] ?? []).filter(
      (variant) => variant.trackInventory,
    );
    const product = products.find((candidate) => candidate._id === productId);

    setForm((current) => {
      const addedVariantIds = new Set(
        current.items
          .filter((item) => item.productId === productId && item.variantId)
          .map((item) => item.variantId),
      );
      const missingVariants = variants.filter(
        (variant) => !addedVariantIds.has(variant._id),
      );

      if (missingVariants.length === 0) return current;

      let variantsToAppend = missingVariants;
      const targetItem = current.items[index];
      let items = current.items;

      if (
        targetItem?.productId === productId &&
        !targetItem.variantId &&
        targetItem.productMode !== "new"
      ) {
        const [firstVariant, ...remainingVariants] = missingVariants;
        items = current.items.map((item, itemIndex) =>
          itemIndex === index
            ? {
                ...item,
                variantId: firstVariant._id,
                unitCost:
                  firstVariant.costPrice ?? product?.costPrice ?? item.unitCost,
              }
            : item,
        );
        variantsToAppend = remainingVariants;
      }

      return {
        ...current,
        items: [
          ...items,
          ...variantsToAppend.map((variant) => ({
            productId,
            productMode: "catalog" as const,
            variantId: variant._id,
            quantity: 1,
            unitCost: variant.costPrice ?? product?.costPrice ?? 0,
            discountAmount: 0,
            taxRate: 0,
          })),
        ],
      };
    });
    setActionError("");
  };

  const submitPurchaseForm = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void savePurchase();
  };

  const updateItem = (
    index: number,
    key: keyof PurchaseItemInput,
    value: string | number,
  ) => {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, i) =>
        i === index ? { ...item, [key]: value } : item,
      ),
    }));
  };

  const selectItemProduct = (index: number, value: string) => {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => {
        if (itemIndex !== index) return item;

        if (value === "__new__") {
          return {
            ...item,
            productId: "",
            productMode: "new",
          };
        }

        const product = products.find((candidate) => candidate._id === value);
        return {
          ...item,
          productId: value,
          variantId: undefined,
          productMode: "catalog",
          productName: undefined,
          sku: undefined,
          ...(product?.costPrice !== undefined
            ? { unitCost: product.costPrice }
            : {}),
        };
      }),
    }));
  };

  const linkPurchaseItem = async (item: Purchase["items"][number]) => {
    if (!selected || !item._id) {
      setActionError(
        "Could not identify this purchase item. Refresh and retry.",
      );
      return;
    }

    const productId = productLinks[item._id];
    if (!productId) {
      setActionError("Select the catalog product to link first.");
      return;
    }
    const [linkedProductId, linkedVariantId] = productId.split("::");
    if (!linkedProductId) {
      setActionError("Select the catalog product to link first.");
      return;
    }

    setLinkingItemId(item._id);
    setActionError("");

    try {
      const updated = await purchasesAdminApi.linkItemProduct(
        selected._id,
        item._id,
        linkedProductId,
        linkedVariantId || undefined,
      );
      setSelected(updated);
      const itemIndex = selected.items.findIndex(
        (purchaseItem) => purchaseItem._id === item._id,
      );
      if (itemIndex >= 0) {
        setReceiveQuantities((current) => ({
          ...current,
          [String(item._id)]: String(
            Math.max(0, item.quantity - item.receivedQuantity),
          ),
        }));
      }
      setProductLinks((current) => {
        const next = { ...current };
        delete next[item._id!];
        return next;
      });
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setLinkingItemId("");
    }
  };

  const subtotal = form.items.reduce(
    (sum, item) => sum + item.quantity * item.unitCost,
    0,
  );

  const lineDiscount = form.items.reduce(
    (sum, item) => sum + (item.discountAmount || 0),
    0,
  );

  const taxTotal = form.items.reduce((sum, item) => {
    const base = Math.max(
      0,
      item.quantity * item.unitCost - (item.discountAmount || 0),
    );
    return sum + base * ((item.taxRate || 0) / 100);
  }, 0);

  const estimatedTotal = Math.max(
    0,
    subtotal -
      lineDiscount -
      (form.discountAmount || 0) +
      taxTotal +
      (form.shippingCost || 0),
  );

  const openAction = (purchase: Purchase, action: typeof modal) => {
    setSelected(purchase);
    setActionError("");
    setProductLinks({});
    setReceiveQuantities(
      Object.fromEntries(
        purchase.items.map((item, index) => [
          item._id ?? String(index),
          item.productId
            ? String(Math.max(0, item.quantity - item.receivedQuantity))
            : "0",
        ]),
      ),
    );
    setActionForm({
      note: "",
      reason: "",
      amount: String(purchase.amountDue || ""),
      method: "CASH",
      referenceNumber: "",
      expectedDeliveryDate: purchase.expectedDeliveryDate?.slice(0, 10) || "",
    });
    setModal(action);
    if (action === "receive") void loadProductsForLinking();
  };

  const summaryByStatus = (status: PurchaseStatus) =>
    (summary?.byStatus ?? []).find((item) => item._id === status)?.count || 0;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Purchases
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage supplier purchases, receiving and payments.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => void loadData()}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium dark:border-gray-700"
          >
            <RefreshCw size={16} /> Refresh
          </button>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Plus size={17} /> New purchase
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Total purchases"
          value={summary.total}
          icon={ShoppingCart}
        />
        <SummaryCard
          title="Draft"
          value={summaryByStatus("DRAFT")}
          icon={ClipboardList}
        />
        <SummaryCard
          title="Ordered"
          value={summaryByStatus("ORDERED")}
          icon={Truck}
        />
        <SummaryCard
          title="Received"
          value={summaryByStatus("RECEIVED")}
          icon={PackageCheck}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
            <Wallet size={17} /> Payment overview
          </div>
          <div className="grid grid-cols-3 gap-3">
            {(["UNPAID", "PARTIALLY_PAID", "PAID"] as const).map((status) => {
              const row = (summary?.paymentSummary ?? []).find(
                (item) => item._id === status,
              );
              return (
                <div key={status}>
                  <StatusBadge status={status} />
                  <p className="mt-2 text-xl font-bold text-gray-900 dark:text-white">
                    {row?.count || 0}
                  </p>
                  <p className="text-xs text-gray-500">
                    {money(row?.amountDue || 0)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <p className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
            Purchase totals
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {money(
              (summary?.byStatus ?? []).reduce(
                (sum, item) => sum + (item.grandTotal || 0),
                0,
              ),
            )}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Combined purchase value across all statuses
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="relative">
            <Search size={17} className="absolute left-3 top-3 text-gray-400" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter")
                  updateFilter("search", searchInput.trim());
              }}
              placeholder="Search purchase number..."
              className={`${inputClass} pl-9`}
            />
          </div>

          <select
            value={filters.status}
            onChange={(event) =>
              updateFilter("status", event.target.value as PurchaseStatus | "")
            }
            className={inputClass}
          >
            <option value="">All purchase statuses</option>
            {[
              "DRAFT",
              "PENDING",
              "APPROVED",
              "ORDERED",
              "PARTIALLY_RECEIVED",
              "RECEIVED",
              "CANCELLED",
            ].map((status) => (
              <option key={status} value={status}>
                {status.replaceAll("_", " ")}
              </option>
            ))}
          </select>

          <select
            value={filters.paymentStatus}
            onChange={(event) =>
              updateFilter(
                "paymentStatus",
                event.target.value as PurchaseFilters["paymentStatus"],
              )
            }
            className={inputClass}
          >
            <option value="">All payment statuses</option>
            {["UNPAID", "PARTIALLY_PAID", "PAID", "REFUNDED"].map((status) => (
              <option key={status} value={status}>
                {status.replaceAll("_", " ")}
              </option>
            ))}
          </select>

          <select
            value={filters.supplierId}
            onChange={(event) => updateFilter("supplierId", event.target.value)}
            className={inputClass}
          >
            <option value="">All suppliers</option>
            {suppliers.map((supplier) => (
              <option key={supplier._id} value={supplier._id}>
                {supplier.name}
              </option>
            ))}
          </select>

          <select
            value={filters.warehouseId}
            onChange={(event) =>
              updateFilter("warehouseId", event.target.value)
            }
            className={inputClass}
          >
            <option value="">All warehouses</option>
            {warehouses.map((warehouse) => (
              <option key={warehouse._id} value={warehouse._id}>
                {warehouse.name}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={filters.startDate || ""}
            onChange={(event) => updateFilter("startDate", event.target.value)}
            className={inputClass}
          />

          <input
            type="date"
            value={filters.endDate || ""}
            onChange={(event) => updateFilter("endDate", event.target.value)}
            className={inputClass}
          />

          <button
            onClick={() => {
              setSearchInput("");
              setFilters({
                page: 1,
                limit: 20,
                search: "",
                supplierId: "",
                warehouseId: "",
                status: "",
                paymentStatus: "",
                sortBy: "createdAt",
                sortOrder: "desc",
              });
            }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700"
          >
            Clear filters
          </button>
        </div>

        <div className="mt-3 flex justify-end">
          <button
            onClick={() => updateFilter("search", searchInput.trim())}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Search
          </button>
        </div>
      </div>

      {optionsError && (
        <div
          role="alert"
          className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300"
        >
          {optionsError}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              <tr>
                <th className="px-5 py-4">Purchase</th>
                <th className="px-5 py-4">Supplier</th>
                <th className="px-5 py-4">Warehouse</th>
                <th className="px-5 py-4">Date</th>
                <th className="px-5 py-4">Total</th>
                <th className="px-5 py-4">Paid / Due</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Payment</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center">
                    <Loader2 className="mx-auto animate-spin text-blue-600" />
                    <p className="mt-2 text-gray-500">Loading purchases...</p>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-5 py-12 text-center text-gray-500"
                  >
                    No purchases found.
                  </td>
                </tr>
              ) : (
                items.map((purchase) => (
                  <tr
                    key={purchase._id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <td className="px-5 py-4">
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {purchase.purchaseNumber}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {purchase.items.length} item(s)
                      </p>
                    </td>
                    <td className="px-5 py-4 text-gray-700 dark:text-gray-300">
                      {referenceName(purchase.supplierId)}
                    </td>
                    <td className="px-5 py-4 text-gray-700 dark:text-gray-300">
                      {referenceName(purchase.warehouseId)}
                    </td>
                    <td className="px-5 py-4 text-gray-500">
                      {new Date(purchase.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4 font-semibold text-gray-900 dark:text-white">
                      {money(purchase.grandTotal, purchase.currency)}
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-green-700">
                        {money(purchase.amountPaid, purchase.currency)}
                      </p>
                      <p className="text-xs text-red-600">
                        {money(purchase.amountDue, purchase.currency)} due
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={purchase.status} />
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={purchase.paymentStatus} />
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-1">
                        <button
                          title="View"
                          onClick={() => void openDetails(purchase)}
                          className="rounded-lg p-2 text-blue-600 hover:bg-blue-50"
                        >
                          <Eye size={17} />
                        </button>
                        {["DRAFT", "PENDING"].includes(purchase.status) && (
                          <button
                            title="Edit"
                            onClick={() => openEdit(purchase)}
                            className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                          >
                            <Pencil size={17} />
                          </button>
                        )}
                        {["DRAFT", "PENDING"].includes(purchase.status) && (
                          <button
                            title="Approve"
                            onClick={() => openAction(purchase, "details")}
                            className="rounded-lg p-2 text-green-600 hover:bg-green-50"
                          >
                            <CheckCircle size={17} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col justify-between gap-3 border-t border-gray-200 px-5 py-4 sm:flex-row sm:items-center dark:border-gray-800">
          <p className="text-sm text-gray-500">
            Showing {items.length} of {pagination.total} purchases
          </p>
          <div className="flex items-center gap-2">
            <button
              disabled={!pagination.hasPreviousPage || loading}
              onClick={() =>
                setFilters((current) => ({
                  ...current,
                  page: current.page - 1,
                }))
              }
              className="rounded-lg border border-gray-300 p-2 disabled:opacity-40 dark:border-gray-700"
            >
              <ChevronLeft size={17} />
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-300">
              Page {pagination.page} of {Math.max(1, pagination.totalPages)}
            </span>
            <button
              disabled={!pagination.hasNextPage || loading}
              onClick={() =>
                setFilters((current) => ({
                  ...current,
                  page: current.page + 1,
                }))
              }
              className="rounded-lg border border-gray-300 p-2 disabled:opacity-40 dark:border-gray-700"
            >
              <ChevronRight size={17} />
            </button>
          </div>
        </div>
      </div>

      {(modal === "create" || modal === "edit") && (
        <Modal
          title={modal === "edit" ? "Edit purchase" : "Create purchase"}
          onClose={() => setModal("")}
        >
          <form onSubmit={submitPurchaseForm} className="space-y-5">
            {actionError && (
              <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {actionError}
              </p>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={labelClass}>Supplier *</label>
                <select
                  required
                  className={inputClass}
                  value={form.supplierId}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      supplierId: event.target.value,
                    }))
                  }
                >
                  <option value="">Select supplier</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier._id} value={supplier._id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Warehouse *</label>
                <select
                  required
                  className={inputClass}
                  value={form.warehouseId}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      warehouseId: event.target.value,
                    }))
                  }
                >
                  <option value="">Select warehouse</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse._id} value={warehouse._id}>
                      {warehouse.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Expected delivery</label>
                <input
                  type="date"
                  className={inputClass}
                  value={form.expectedDeliveryDate || ""}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      expectedDeliveryDate: event.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label className={labelClass}>Reference number</label>
                <input
                  className={inputClass}
                  value={form.referenceNumber || ""}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      referenceNumber: event.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  Purchase items
                </h3>
                <button
                  type="button"
                  onClick={addItem}
                  className="rounded-lg border border-blue-200 px-3 py-2 text-sm font-medium text-blue-600"
                >
                  <Plus size={15} className="mr-1 inline" /> Add item
                </button>
              </div>

              <div className="space-y-3">
                {form.items.map((item, index) => (
                  <div
                    key={index}
                    className="rounded-xl border border-gray-200 p-3 dark:border-gray-700"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-sm font-semibold">
                        Item {index + 1}
                      </span>
                      {form.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setForm((current) => ({
                              ...current,
                              items: current.items.filter(
                                (_, i) => i !== index,
                              ),
                            }))
                          }
                          className="text-xs text-red-600"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="md:col-span-2">
                        <label className={labelClass}>Product *</label>
                        <select
                          required
                          className={inputClass}
                          value={
                            item.productMode === "new"
                              ? "__new__"
                              : item.productId
                          }
                          onChange={(event) =>
                            selectItemProduct(index, event.target.value)
                          }
                        >
                          <option value="">Select product</option>
                          <option value="__new__">
                            Not in catalog yet — add later
                          </option>
                          {products
                            .filter(
                              (product) =>
                                product.type === "VARIABLE" ||
                                product.trackInventory,
                            )
                            .map((product) => (
                              <option key={product._id} value={product._id}>
                                {product.name}
                                {product.sku ? ` (${product.sku})` : ""}
                              </option>
                            ))}
                        </select>
                      </div>
                      {item.productMode !== "new" &&
                        products.find(
                          (product) => product._id === item.productId,
                        )?.type === "VARIABLE" && (
                          <div className="md:col-span-2">
                            <label className={labelClass}>Variant *</label>
                            <select
                              required
                              className={inputClass}
                              value={item.variantId ?? ""}
                              onChange={(event) =>
                                updateItem(
                                  index,
                                  "variantId",
                                  event.target.value,
                                )
                              }
                            >
                              <option value="">Select variant</option>
                              {(item.productId
                                ? (variantsByProduct[item.productId] ?? [])
                                : []
                              )
                                .filter(
                                  (variant: ProductVariant) =>
                                    variant.trackInventory,
                                )
                                .map((variant: ProductVariant) => (
                                  <option key={variant._id} value={variant._id}>
                                    {variant.title}
                                    {variant.sku ? ` (${variant.sku})` : ""}
                                  </option>
                                ))}
                            </select>
                            {item.productId &&
                              getUnaddedVariants(item.productId).length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => addAllVariants(index)}
                                  className="mt-2 text-sm font-medium text-blue-600 underline underline-offset-2 dark:text-blue-400"
                                >
                                  Add all remaining tracked variants (
                                  {getUnaddedVariants(item.productId).length})
                                </button>
                              )}
                          </div>
                        )}
                      {item.productMode === "new" && (
                        <>
                          <div>
                            <label className={labelClass}>
                              Supplier product name *
                            </label>
                            <input
                              required
                              className={inputClass}
                              minLength={2}
                              maxLength={250}
                              value={item.productName ?? ""}
                              onChange={(event) =>
                                updateItem(
                                  index,
                                  "productName",
                                  event.target.value,
                                )
                              }
                              placeholder="Name from supplier invoice"
                            />
                          </div>
                          <div>
                            <label className={labelClass}>
                              Supplier SKU (optional)
                            </label>
                            <input
                              className={inputClass}
                              maxLength={100}
                              value={item.sku ?? ""}
                              onChange={(event) =>
                                updateItem(index, "sku", event.target.value)
                              }
                              placeholder="Supplier's item code"
                            />
                          </div>
                          <div className="md:col-span-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
                            <p>
                              For accurate stock tracking, add this product to
                              the catalog before submitting the purchase.
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-3">
                              <a
                                href={`/admin/products?create=1&source=procurement&name=${encodeURIComponent(item.productName ?? "")}&warehouseId=${encodeURIComponent(form.warehouseId)}`}
                                target="_blank"
                                rel="noreferrer"
                                className="font-semibold underline underline-offset-2"
                              >
                                Add product to catalog
                              </a>
                              <button
                                type="button"
                                onClick={() => void loadOptions()}
                                className="font-semibold underline underline-offset-2"
                              >
                                Refresh product list
                              </button>
                            </div>
                            <p className="mt-2 text-xs text-blue-800 dark:text-blue-300">
                              Create any variants and SKUs there, then return
                              here, refresh, and select the catalog product
                              before saving this purchase.
                            </p>
                          </div>
                        </>
                      )}
                      <div>
                        <label className={labelClass}>Quantity *</label>
                        <input
                          required
                          type="number"
                          min="1"
                          max="1000000"
                          className={inputClass}
                          value={item.quantity}
                          onChange={(event) =>
                            updateItem(
                              index,
                              "quantity",
                              Number(event.target.value),
                            )
                          }
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Unit cost</label>
                        <input
                          required
                          type="number"
                          min="0"
                          max="1000000000"
                          step="0.01"
                          className={inputClass}
                          value={item.unitCost}
                          onChange={(event) =>
                            updateItem(
                              index,
                              "unitCost",
                              Number(event.target.value),
                            )
                          }
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Item discount</label>
                        <input
                          type="number"
                          min="0"
                          max="1000000000"
                          step="0.01"
                          className={inputClass}
                          value={item.discountAmount || 0}
                          onChange={(event) =>
                            updateItem(
                              index,
                              "discountAmount",
                              Number(event.target.value),
                            )
                          }
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Tax rate (%)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          className={inputClass}
                          value={item.taxRate || 0}
                          onChange={(event) =>
                            updateItem(
                              index,
                              "taxRate",
                              Number(event.target.value),
                            )
                          }
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={labelClass}>Purchase discount</label>
                <input
                  type="number"
                  min="0"
                  max="1000000000"
                  step="0.01"
                  className={inputClass}
                  value={form.discountAmount || 0}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      discountAmount: Number(event.target.value),
                    }))
                  }
                />
              </div>
              <div>
                <label className={labelClass}>Shipping cost</label>
                <input
                  type="number"
                  min="0"
                  max="1000000000"
                  step="0.01"
                  className={inputClass}
                  value={form.shippingCost || 0}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      shippingCost: Number(event.target.value),
                    }))
                  }
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Notes</label>
              <textarea
                rows={3}
                maxLength={5000}
                className={inputClass}
                value={form.notes || ""}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
              />
            </div>

            <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-300">
                <span>Subtotal</span>
                <span>{money(subtotal, form.currency)}</span>
              </div>
              <div className="mt-2 flex justify-between text-sm text-gray-600 dark:text-gray-300">
                <span>Tax</span>
                <span>{money(taxTotal, form.currency)}</span>
              </div>
              <div className="mt-2 flex justify-between text-sm text-gray-600 dark:text-gray-300">
                <span>Estimated total</span>
                <span>{money(estimatedTotal, form.currency)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModal("")}
                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm dark:border-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save purchase"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {modal === "details" && selected && (
        <Modal
          title={`Purchase ${selected.purchaseNumber}`}
          onClose={() => setModal("")}
        >
          <div className="space-y-5">
            {actionError && (
              <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {actionError}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <StatusBadge status={selected.status} />
              <StatusBadge status={selected.paymentStatus} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs text-gray-500">Supplier</p>
                <p className="font-medium">
                  {referenceName(selected.supplierId)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Warehouse</p>
                <p className="font-medium">
                  {referenceName(selected.warehouseId)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Grand total</p>
                <p className="font-semibold">
                  {money(selected.grandTotal, selected.currency)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Paid / Due</p>
                <p className="font-semibold">
                  {money(selected.amountPaid, selected.currency)} /{" "}
                  {money(selected.amountDue, selected.currency)}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="py-2">Product</th>
                    <th>Qty</th>
                    <th>Received</th>
                    <th>Cost</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.items.map((item, index) => (
                    <tr
                      key={item._id || index}
                      className="border-b dark:border-gray-800"
                    >
                      <td className="py-3">
                        {item.productName}
                        <p className="text-xs text-gray-500">{item.sku}</p>
                      </td>
                      <td>{item.quantity}</td>
                      <td>{item.receivedQuantity}</td>
                      <td>{money(item.unitCost, selected.currency)}</td>
                      <td>{money(item.lineTotal, selected.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {selected.payments.length > 0 && (
              <div>
                <h3 className="mb-2 font-semibold">Payment history</h3>
                {selected.payments.map((payment, index) => (
                  <div
                    key={payment._id || index}
                    className="flex justify-between border-b py-2 text-sm dark:border-gray-800"
                  >
                    <span>
                      {payment.method} ·{" "}
                      {payment.referenceNumber || "No reference"}
                    </span>
                    <strong>{money(payment.amount, selected.currency)}</strong>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2 border-t pt-4 dark:border-gray-800">
              {["DRAFT", "PENDING"].includes(selected.status) && (
                <button
                  disabled={saving}
                  onClick={() => void runAction("approve")}
                  className="rounded-lg bg-green-600 px-3 py-2 text-sm text-white"
                >
                  Approve
                </button>
              )}
              {selected.status === "APPROVED" && (
                <button
                  onClick={() => openAction(selected, "order")}
                  className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white"
                >
                  Mark ordered
                </button>
              )}
              {["ORDERED", "PARTIALLY_RECEIVED"].includes(selected.status) && (
                <button
                  onClick={() => openAction(selected, "receive")}
                  className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white"
                >
                  Receive items
                </button>
              )}
              {selected.amountDue > 0 &&
                !["CANCELLED"].includes(selected.status) && (
                  <button
                    onClick={() => openAction(selected, "payment")}
                    className="rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white"
                  >
                    Record payment
                  </button>
                )}
              {["DRAFT", "PENDING", "APPROVED", "ORDERED"].includes(
                selected.status,
              ) &&
                selected.amountPaid === 0 && (
                  <button
                    onClick={() => openAction(selected, "cancel")}
                    className="rounded-lg bg-red-600 px-3 py-2 text-sm text-white"
                  >
                    Cancel purchase
                  </button>
                )}
            </div>
          </div>
        </Modal>
      )}

      {(modal === "order" ||
        modal === "receive" ||
        modal === "payment" ||
        modal === "cancel") &&
        selected && (
          <Modal
            title={
              modal === "order"
                ? "Mark purchase as ordered"
                : modal === "receive"
                  ? "Receive purchase items"
                  : modal === "payment"
                    ? "Record purchase payment"
                    : "Cancel purchase"
            }
            onClose={() => setModal("details")}
          >
            <div className="space-y-4">
              {actionError && (
                <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  {actionError}
                </p>
              )}

              {modal === "order" && (
                <div>
                  <label className={labelClass}>Expected delivery date</label>
                  <input
                    type="date"
                    className={inputClass}
                    value={actionForm.expectedDeliveryDate}
                    onChange={(event) =>
                      setActionForm((current) => ({
                        ...current,
                        expectedDeliveryDate: event.target.value,
                      }))
                    }
                  />
                </div>
              )}

              {modal === "receive" && (
                <div className="space-y-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
                  <p>
                    Link any newly added catalog products before receiving them.
                    Stock is updated only for the items you receive.
                  </p>
                  {selected.items.map((item, index) => {
                    const remaining = Math.max(
                      0,
                      item.quantity - item.receivedQuantity,
                    );
                    const itemId = item._id;
                    const quantityKey = itemId ?? String(index);
                    const isLinked = Boolean(item.productId);

                    return (
                      <div
                        key={itemId || index}
                        className="space-y-2 rounded-lg border border-blue-100 bg-white p-3 dark:border-blue-900 dark:bg-gray-900"
                      >
                        <div className="flex flex-wrap justify-between gap-2">
                          <span className="font-medium">
                            {item.productName}
                          </span>
                          <strong>{remaining} remaining</strong>
                        </div>
                        {remaining > 0 && (
                          <label className="block text-xs">
                            <span className="mb-1 block font-medium">
                              Receive quantity now
                            </span>
                            <input
                              required={isLinked}
                              type="number"
                              min={0}
                              max={remaining}
                              step={1}
                              disabled={!isLinked}
                              value={receiveQuantities[quantityKey] ?? "0"}
                              onChange={(event) =>
                                setReceiveQuantities((current) => ({
                                  ...current,
                                  [quantityKey]: event.target.value,
                                }))
                              }
                              className={`${inputClass} max-w-48`}
                            />
                            {!isLinked && (
                              <span className="mt-1 block text-amber-700">
                                Link this item to a catalog product before
                                receiving.
                              </span>
                            )}
                          </label>
                        )}
                        {!isLinked && remaining > 0 && itemId && (
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <select
                              className={inputClass}
                              value={productLinks[itemId] ?? ""}
                              onChange={(event) =>
                                setProductLinks((current) => ({
                                  ...current,
                                  [itemId]: event.target.value,
                                }))
                              }
                            >
                              <option value="">
                                Link to catalog product...
                              </option>
                              {linkProducts.map((product) =>
                                product.type === "VARIABLE" ? (
                                  (variantsByProduct[product._id] ?? []).map(
                                    (variant) => (
                                      <option
                                        key={`${product._id}::${variant._id}`}
                                        value={`${product._id}::${variant._id}`}
                                      >
                                        {product.name} — {variant.title}
                                        {variant.sku ? ` (${variant.sku})` : ""}
                                      </option>
                                    ),
                                  )
                                ) : (
                                  <option
                                    key={product._id}
                                    value={`${product._id}::`}
                                  >
                                    {product.name}
                                    {product.sku ? ` (${product.sku})` : ""}
                                  </option>
                                ),
                              )}
                            </select>
                            <button
                              type="button"
                              disabled={
                                !productLinks[itemId] ||
                                linkingItemId === itemId
                              }
                              onClick={() => void linkPurchaseItem(item)}
                              className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                            >
                              {linkingItemId === itemId ? "Linking..." : "Link"}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {selected.items.some(
                    (item) =>
                      !item.productId && item.receivedQuantity < item.quantity,
                  ) && (
                    <p className="text-xs">
                      If a product is not listed, add it from{" "}
                      <a
                        className="font-semibold underline"
                        href="/admin/products"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Products
                      </a>{" "}
                      in another tab, then refresh the product list.
                      <button
                        type="button"
                        onClick={() => void loadProductsForLinking()}
                        className="ml-2 font-semibold underline"
                      >
                        Refresh products
                      </button>
                    </p>
                  )}
                </div>
              )}

              {modal === "payment" && (
                <>
                  <div>
                    <label className={labelClass}>Amount *</label>
                    <input
                      type="number"
                      min="0.01"
                      max={selected.amountDue}
                      step="0.01"
                      className={inputClass}
                      value={actionForm.amount}
                      onChange={(event) =>
                        setActionForm((current) => ({
                          ...current,
                          amount: event.target.value,
                        }))
                      }
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Outstanding:{" "}
                      {money(selected.amountDue, selected.currency)}
                    </p>
                  </div>
                  <div>
                    <label className={labelClass}>Payment method</label>
                    <select
                      className={inputClass}
                      value={actionForm.method}
                      onChange={(event) =>
                        setActionForm((current) => ({
                          ...current,
                          method: event.target.value,
                        }))
                      }
                    >
                      {["CASH", "BANK_TRANSFER", "CARD", "CHEQUE", "OTHER"].map(
                        (method) => (
                          <option key={method} value={method}>
                            {method.replaceAll("_", " ")}
                          </option>
                        ),
                      )}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Reference number</label>
                    <input
                      className={inputClass}
                      value={actionForm.referenceNumber}
                      onChange={(event) =>
                        setActionForm((current) => ({
                          ...current,
                          referenceNumber: event.target.value,
                        }))
                      }
                    />
                  </div>
                </>
              )}

              {modal === "cancel" && (
                <div>
                  <label className={labelClass}>Cancellation reason *</label>
                  <textarea
                    rows={4}
                    className={inputClass}
                    value={actionForm.reason}
                    onChange={(event) =>
                      setActionForm((current) => ({
                        ...current,
                        reason: event.target.value,
                      }))
                    }
                    placeholder="Explain why this purchase is being cancelled..."
                  />
                </div>
              )}

              {modal !== "cancel" && (
                <div>
                  <label className={labelClass}>Note</label>
                  <textarea
                    rows={3}
                    className={inputClass}
                    value={actionForm.note}
                    onChange={(event) =>
                      setActionForm((current) => ({
                        ...current,
                        note: event.target.value,
                      }))
                    }
                  />
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setModal("details")}
                  className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm dark:border-gray-700"
                >
                  Back
                </button>
                <button
                  disabled={saving}
                  onClick={() => void runAction(modal)}
                  className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {saving ? "Processing..." : "Confirm"}
                </button>
              </div>
            </div>
          </Modal>
        )}
    </div>
  );
}

function SummaryCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: number;
  icon: typeof ShoppingCart;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
            {value.toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg bg-blue-100 p-3 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
          <Icon size={21} />
        </div>
      </div>
    </div>
  );
}
