"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Search,
  RefreshCw,
  Eye,
  CheckCircle,
  XCircle,
  PackageCheck,
  Ban,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Wallet,
  Plus,
  X,
} from "lucide-react";

import { purchasesAdminApi } from "@/services/api/purchases-admin.api";
import { purchaseReturnsAdminApi } from "@/services/api/purchase-returns-admin.api";

import type {
  CreatePurchaseReturnInput,
  CreatePurchaseReturnRefundInput,
  PurchaseReturnItemCondition,
  PurchaseReturnReason,
  PurchaseReturn,
  PurchaseReturnFilters,
  PurchaseReturnSummary,
  PurchaseReturnStatus,
} from "@/features/purchase-returns/purchase-return.types";
import type { Purchase } from "@/features/purchases/purchase.types";

const PAGE_SIZE = 20;

const STATUS_OPTIONS: PurchaseReturnStatus[] = [
  "REQUESTED",
  "APPROVED",
  "REJECTED",
  "COMPLETED",
  "CANCELLED",
];

const RETURN_REASONS: PurchaseReturnReason[] = [
  "DAMAGED",
  "DEFECTIVE",
  "WRONG_ITEM",
  "EXCESS_QUANTITY",
  "EXPIRED",
  "QUALITY_ISSUE",
  "SUPPLIER_ERROR",
  "OTHER",
];

const RETURN_CONDITIONS: PurchaseReturnItemCondition[] = [
  "UNOPENED",
  "DAMAGED",
  "DEFECTIVE",
  "OTHER",
];

type ReturnDraftItem = {
  key: string;
  productId: string;
  variantId?: string;
  variantName?: string;
  productName: string;
  sku?: string;
  receivedQuantity: number;
  previouslyReturned: number;
  selected: boolean;
  quantity: string;
  condition: PurchaseReturnItemCondition;
  restock: boolean;
  note: string;
};

type ReturnDialog =
  | { type: "create" }
  | { type: "reject"; reason: string }
  | { type: "cancel"; reason: string }
  | {
      type: "refund";
      amount: string;
      method: CreatePurchaseReturnRefundInput["method"];
      referenceNumber: string;
      note: string;
    };

function formatMoney(value?: number) {
  return `৳${(value ?? 0).toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value?: string) {
  if (!value) return "—";

  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getErrorMessage(error: unknown): string {
  const value = error as {
    response?: {
      data?: {
        message?: string;
      };
    };
    message?: string;
  };

  return (
    value.response?.data?.message || value.message || "Something went wrong."
  );
}

function getStatusClass(status: string) {
  const classes: Record<string, string> = {
    REQUESTED:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    APPROVED:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    REJECTED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    COMPLETED:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    CANCELLED: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  };

  return classes[status] ?? classes.CANCELLED;
}

function getRefundClass(status: string) {
  if (status === "REFUNDED") {
    return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300";
  }

  if (status === "PARTIALLY_REFUNDED") {
    return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
  }

  if (status === "PENDING") {
    return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
  }

  return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
}

function getRelationName(
  value: string | { name?: string; purchaseNumber?: string } | undefined,
) {
  if (!value) return "—";
  if (typeof value === "string") return value;
  return value.name || value.purchaseNumber || "—";
}

function SummaryCard({
  title,
  value,
  icon: Icon,
  description,
}: {
  title: string;
  value: string | number;
  icon: typeof ClipboardList;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
          {title}
        </p>
        <div className="rounded-lg bg-blue-50 p-2 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
          <Icon size={20} />
        </div>
      </div>

      <p className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">
        {value}
      </p>

      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        {description}
      </p>
    </div>
  );
}

export default function PurchaseReturnsPage() {
  const [items, setItems] = useState<PurchaseReturn[]>([]);
  const [summary, setSummary] = useState<PurchaseReturnSummary | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [dialogLoading, setDialogLoading] = useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [refundStatus, setRefundStatus] = useState("");

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [selected, setSelected] = useState<PurchaseReturn | null>(null);
  const [dialog, setDialog] = useState<ReturnDialog | null>(null);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [purchaseSearch, setPurchaseSearch] = useState("");
  const [returnPurchase, setReturnPurchase] = useState<Purchase | null>(null);
  const [returnItems, setReturnItems] = useState<ReturnDraftItem[]>([]);
  const [returnForm, setReturnForm] = useState<{
    purchaseId: string;
    reason: PurchaseReturnReason;
    reasonDetails: string;
    supplierReference: string;
    referenceNumber: string;
    notes: string;
  }>({
    purchaseId: "",
    reason: "DAMAGED",
    reasonDetails: "",
    supplierReference: "",
    referenceNumber: "",
    notes: "",
  });

  const loadData = useCallback(
    async (showRefresh = false) => {
      try {
        if (showRefresh) setRefreshing(true);
        else setLoading(true);

        setError("");

        const filters: PurchaseReturnFilters = {
          page,
          limit: PAGE_SIZE,
          sortBy: "createdAt",
          sortOrder: "desc",
          ...(search.trim() ? { search: search.trim() } : {}),
          ...(status ? { status: status as PurchaseReturnStatus } : {}),
          ...(refundStatus
            ? { refundStatus: refundStatus as PurchaseReturn["refundStatus"] }
            : {}),
        };

        const [listResult, summaryResult] = await Promise.all([
          purchaseReturnsAdminApi.list(filters),
          purchaseReturnsAdminApi.summary(),
        ]);

        setItems(listResult.items);
        setTotal(listResult.pagination.total);
        setTotalPages(Math.max(1, listResult.pagination.totalPages));
        setSummary(summaryResult);
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [page, search, status, refundStatus],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadData();
    }, 250);

    return () => clearTimeout(timer);
  }, [loadData]);

  const refresh = () => {
    void loadData(true);
  };

  const runAction = async (
    action: () => Promise<PurchaseReturn>,
    successMessage: string,
  ) => {
    if (!selected) return;

    try {
      setActionLoading(true);
      setError("");

      const updated = await action();

      setSelected(updated);
      setDialog(null);
      setNotice(successMessage);
      await loadData(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  const approveReturn = () => {
    if (!selected || !window.confirm("Approve this purchase return?")) return;

    void runAction(
      () => purchaseReturnsAdminApi.approve(selected._id),
      "Purchase return approved.",
    );
  };

  const rejectReturn = () => {
    if (!selected) return;
    setError("");
    setDialog({ type: "reject", reason: "" });
  };

  const completeReturn = () => {
    if (!selected || !window.confirm("Complete this purchase return?")) return;

    void runAction(
      () => purchaseReturnsAdminApi.complete(selected._id),
      "Purchase return completed.",
    );
  };

  const cancelReturn = () => {
    if (!selected) return;
    setError("");
    setDialog({ type: "cancel", reason: "" });
  };

  const openDetails = async (item: PurchaseReturn) => {
    try {
      setError("");
      setSelected(await purchaseReturnsAdminApi.getById(item._id));
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };
  const loadEligiblePurchases = async (searchTerm = "") => {
    setDialogLoading(true);
    setError("");
    try {
      const result = await purchasesAdminApi.list({
        page: 1,
        limit: 100,
        sortBy: "createdAt",
        sortOrder: "desc",
        ...(searchTerm.trim() ? { search: searchTerm.trim() } : {}),
      });
      setPurchases(
        result.items.filter(
          (purchase) =>
            !["DRAFT", "PENDING", "CANCELLED"].includes(purchase.status) &&
            purchase.items.some((item) => item.receivedQuantity > 0),
        ),
      );
    } catch (err) {
      setError(`Could not load eligible purchases: ${getErrorMessage(err)}`);
    } finally {
      setDialogLoading(false);
    }
  };

  const openCreateReturn = async () => {
    setError("");
    setNotice("");
    setDialog({
      type: "create",
    });
    setPurchaseSearch("");
    setReturnPurchase(null);
    setReturnItems([]);
    setReturnForm({
      purchaseId: "",
      reason: "DAMAGED",
      reasonDetails: "",
      supplierReference: "",
      referenceNumber: "",
      notes: "",
    });
    await loadEligiblePurchases();
  };

  const selectPurchaseForReturn = async (purchaseId: string) => {
    setReturnForm((current) => ({ ...current, purchaseId }));
    setReturnPurchase(null);
    setReturnItems([]);
    if (!purchaseId) return;

    setDialogLoading(true);
    setError("");
    try {
      const purchase = await purchasesAdminApi.get(purchaseId);
      const existingReturns = await purchaseReturnsAdminApi.list({
        purchaseId,
        page: 1,
        limit: 100,
        sortBy: "createdAt",
        sortOrder: "desc",
      });
      const returnedByItem = new Map<string, number>();

      for (const existingReturn of existingReturns.items) {
        if (["REJECTED", "CANCELLED"].includes(existingReturn.status)) continue;
        for (const item of existingReturn.items) {
          const key = `${item.productId}:${item.variantId ?? ""}`;
          returnedByItem.set(
            key,
            (returnedByItem.get(key) ?? 0) + item.quantity,
          );
        }
      }

      setReturnPurchase(purchase);
      setReturnItems(
        purchase.items.flatMap((item) => {
          const productId =
            typeof item.productId === "string"
              ? item.productId
              : item.productId?._id;
          const variantId =
            typeof item.variantId === "string"
              ? item.variantId
              : item.variantId?._id;
          if (!productId || item.receivedQuantity < 1) return [];

          const key = `${productId}:${variantId ?? ""}`;
          const previouslyReturned = returnedByItem.get(key) ?? 0;
          const remaining = Math.max(
            0,
            item.receivedQuantity - previouslyReturned,
          );
          if (remaining < 1) return [];

          return [
            {
              key,
              productId,
              ...(variantId ? { variantId } : {}),
              productName: item.productName,
              ...(typeof item.variantId === "object" && item.variantId
                ? { variantName: item.variantId.title }
                : {}),
              sku: item.sku,
              receivedQuantity: item.receivedQuantity,
              previouslyReturned,
              selected: false,
              quantity: "1",
              condition: "UNOPENED" as const,
              restock: false,
              note: "",
            },
          ];
        }),
      );
    } catch (err) {
      setError(`Could not load purchase items: ${getErrorMessage(err)}`);
    } finally {
      setDialogLoading(false);
    }
  };

  const createReturn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!returnPurchase) {
      setError("Select a purchase before creating a return.");
      return;
    }

    const selectedItems = returnItems.filter((item) => item.selected);
    if (!selectedItems.length) {
      setError("Select at least one received item to return.");
      return;
    }
    if (
      returnForm.reason === "OTHER" &&
      returnForm.reasonDetails.trim().length < 3
    ) {
      setError("Add at least 3 characters describing the return reason.");
      return;
    }

    const invalidQuantity = selectedItems.find((item) => {
      const quantity = Number(item.quantity);
      const available = item.receivedQuantity - item.previouslyReturned;
      return (
        !Number.isSafeInteger(quantity) || quantity < 1 || quantity > available
      );
    });
    if (invalidQuantity) {
      const available =
        invalidQuantity.receivedQuantity - invalidQuantity.previouslyReturned;
      setError(
        `Return quantity for ${invalidQuantity.productName} must be between 1 and ${available}.`,
      );
      return;
    }

    const items = selectedItems.map((item) => ({
      productId: item.productId,
      ...(item.variantId ? { variantId: item.variantId } : {}),
      quantity: Number(item.quantity),
      reason: returnForm.reason,
      condition: item.condition,
      restock: item.restock,
      ...(item.note.trim() ? { note: item.note.trim() } : {}),
    }));

    const payload: CreatePurchaseReturnInput = {
      purchaseId: returnPurchase._id,
      items,
      reason: returnForm.reason,
      ...(returnForm.reasonDetails.trim()
        ? { reasonDetails: returnForm.reasonDetails.trim() }
        : {}),
      ...(returnForm.supplierReference.trim()
        ? { supplierReference: returnForm.supplierReference.trim() }
        : {}),
      ...(returnForm.referenceNumber.trim()
        ? { referenceNumber: returnForm.referenceNumber.trim() }
        : {}),
      ...(returnForm.notes.trim() ? { notes: returnForm.notes.trim() } : {}),
    };

    setActionLoading(true);
    setError("");
    try {
      await purchaseReturnsAdminApi.create(payload);
      setDialog(null);
      setPage(1);
      setNotice("Purchase return created successfully.");
      await loadData(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  const submitDialogAction = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    if (!selected || !dialog || dialog.type === "create") return;

    if (dialog.type === "reject" || dialog.type === "cancel") {
      const reason = dialog.reason.trim();
      if (reason.length < 3) {
        setError("Reason must contain at least 3 characters.");
        return;
      }
      if (dialog.type === "reject") {
        void runAction(
          () => purchaseReturnsAdminApi.reject(selected._id, { reason }),
          "Purchase return rejected.",
        );
      } else {
        void runAction(
          () => purchaseReturnsAdminApi.cancel(selected._id, { reason }),
          "Purchase return cancelled.",
        );
      }
      return;
    }

    const refundDialog = dialog;
    const amount = Number(refundDialog.amount);
    const remaining = selected.totalAmount - selected.refundedAmount;
    if (!Number.isFinite(amount) || amount <= 0 || amount > remaining) {
      setError(
        `Refund must be greater than 0 and no more than ${formatMoney(remaining)}.`,
      );
      return;
    }
    const input: CreatePurchaseReturnRefundInput = {
      amount,
      method: refundDialog.method,
      ...(refundDialog.referenceNumber.trim()
        ? { referenceNumber: refundDialog.referenceNumber.trim() }
        : {}),
      ...(refundDialog.note.trim() ? { note: refundDialog.note.trim() } : {}),
    };
    void runAction(
      () => purchaseReturnsAdminApi.addRefund(selected._id, input),
      "Refund recorded successfully.",
    );
  };

  const openRefundDialog = () => {
    if (!selected) return;
    const remaining = selected.totalAmount - selected.refundedAmount;
    if (remaining <= 0) return;
    setError("");
    setDialog({
      type: "refund",
      amount: remaining.toFixed(2),
      method: "BANK_TRANSFER",
      referenceNumber: "",
      note: "",
    });
  };

  const amountDue = (record: PurchaseReturn) =>
    Math.max(0, record.totalAmount - record.refundedAmount);

  const statusCount = (value: PurchaseReturnStatus) => {
    if (value === "REQUESTED") return summary?.requestedCount ?? 0;
    if (value === "APPROVED") return summary?.approvedCount ?? 0;
    if (value === "REJECTED") return summary?.rejectedCount ?? 0;
    if (value === "COMPLETED") return summary?.completedCount ?? 0;
    return summary?.cancelledCount ?? 0;
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Purchase Returns
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage supplier purchase returns and refunds.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void openCreateReturn()}
            disabled={actionLoading || dialogLoading}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Plus size={16} />
            Create Return
          </button>
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-900/20 dark:text-green-300">
          {notice}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Total Returns"
          value={summary?.totalReturns ?? 0}
          icon={ClipboardList}
          description="All purchase return records"
        />

        <SummaryCard
          title="Requested"
          value={statusCount("REQUESTED")}
          icon={RotateCcw}
          description="Awaiting review"
        />

        <SummaryCard
          title="Return Value"
          value={formatMoney(summary?.totalReturnValue)}
          icon={Wallet}
          description="Total value across return statuses"
        />

        <SummaryCard
          title="Refunded"
          value={formatMoney(summary?.totalRefunded)}
          icon={CheckCircle}
          description="Total amount refunded"
        />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="relative flex-1">
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
              placeholder="Search return number..."
              className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-3 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
            />
          </div>

          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value.replaceAll("_", " ")}
              </option>
            ))}
          </select>

          <select
            value={refundStatus}
            onChange={(event) => {
              setRefundStatus(event.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
          >
            <option value="">All refund statuses</option>
            <option value="NOT_APPLICABLE">Not applicable</option>
            <option value="PENDING">Pending</option>
            <option value="PARTIALLY_REFUNDED">Partially refunded</option>
            <option value="REFUNDED">Refunded</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-800">
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white">
              Return Records
            </h2>
            <p className="mt-1 text-xs text-gray-500">{total} records found</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-950 dark:text-gray-400">
              <tr>
                <th className="px-5 py-3">Return Number</th>
                <th className="px-5 py-3">Purchase</th>
                <th className="px-5 py-3">Supplier</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Total</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Refund</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-12 text-center text-gray-500"
                  >
                    Loading purchase returns...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-12 text-center text-gray-500"
                  >
                    No purchase returns found.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr
                    key={item._id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <td className="px-5 py-4 font-semibold text-gray-900 dark:text-white">
                      {item.returnNumber}
                    </td>
                    <td className="px-5 py-4 text-gray-600 dark:text-gray-300">
                      {typeof item.purchaseId === "object"
                        ? item.purchaseId.purchaseNumber
                        : item.purchaseId}
                    </td>
                    <td className="px-5 py-4 text-gray-600 dark:text-gray-300">
                      {getRelationName(item.supplierId)}
                    </td>
                    <td className="px-5 py-4 text-gray-600 dark:text-gray-300">
                      {formatDate(item.createdAt)}
                    </td>
                    <td className="px-5 py-4 font-medium text-gray-900 dark:text-white">
                      {formatMoney(item.totalAmount)}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${getStatusClass(item.status)}`}
                      >
                        {item.status.replaceAll("_", " ")}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${getRefundClass(item.refundStatus)}`}
                      >
                        {item.refundStatus.replaceAll("_", " ")}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => void openDetails(item)}
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
                      >
                        <Eye size={14} />
                        Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-gray-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800">
          <p className="text-sm text-gray-500">
            Page {page} of {totalPages} · {total} total records
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-40 dark:border-gray-700"
            >
              <ChevronLeft size={16} />
              Previous
            </button>

            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((current) => current + 1)}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-40 dark:border-gray-700"
            >
              Next
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-white shadow-xl dark:bg-gray-900">
            <div className="sticky top-0 flex items-center justify-between border-b border-gray-200 bg-white px-5 py-4 dark:border-gray-800 dark:bg-gray-900">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  {selected.returnNumber}
                </h2>
                <p className="text-xs text-gray-500">Purchase return details</p>
              </div>

              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                Close
              </button>
            </div>

            <div className="space-y-5 p-5">
              {error && (
                <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
                  {error}
                </p>
              )}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-xs text-gray-500">Supplier</p>
                  <p className="mt-1 font-medium text-gray-900 dark:text-white">
                    {getRelationName(selected.supplierId)}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-500">Warehouse</p>
                  <p className="mt-1 font-medium text-gray-900 dark:text-white">
                    {getRelationName(selected.warehouseId)}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-500">Return Status</p>
                  <span
                    className={`mt-1 inline-block rounded-full px-2.5 py-1 text-xs ${getStatusClass(selected.status)}`}
                  >
                    {selected.status}
                  </span>
                </div>

                <div>
                  <p className="text-xs text-gray-500">Refund Status</p>
                  <span
                    className={`mt-1 inline-block rounded-full px-2.5 py-1 text-xs ${getRefundClass(selected.refundStatus)}`}
                  >
                    {selected.refundStatus.replaceAll("_", " ")}
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
                <table className="w-full min-w-[650px] text-left text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 dark:bg-gray-950">
                    <tr>
                      <th className="px-4 py-3">Product</th>
                      <th className="px-4 py-3">Quantity</th>
                      <th className="px-4 py-3">Unit Cost</th>
                      <th className="px-4 py-3">Line Total</th>
                      <th className="px-4 py-3">Condition</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {selected.items.map((item, index) => (
                      <tr key={item._id ?? `${item.productId}-${index}`}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900 dark:text-white">
                            {item.productName}
                          </p>
                          <p className="text-xs text-gray-500">{item.sku}</p>
                        </td>
                        <td className="px-4 py-3">{item.quantity}</td>
                        <td className="px-4 py-3">
                          {formatMoney(item.unitCost)}
                        </td>
                        <td className="px-4 py-3 font-medium">
                          {formatMoney(item.lineTotal)}
                        </td>
                        <td className="px-4 py-3">{item.condition}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="ml-auto max-w-sm space-y-2 rounded-lg bg-gray-50 p-4 dark:bg-gray-950">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span>{formatMoney(selected.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Discount</span>
                  <span>{formatMoney(selected.discountAmount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Tax</span>
                  <span>{formatMoney(selected.taxAmount)}</span>
                </div>
                <div className="flex justify-between border-t border-gray-200 pt-2 font-bold dark:border-gray-800">
                  <span>Total</span>
                  <span>{formatMoney(selected.totalAmount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Refunded</span>
                  <span>{formatMoney(selected.refundedAmount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Refund Due</span>
                  <span>{formatMoney(amountDue(selected))}</span>
                </div>
              </div>

              {selected.reason && (
                <div>
                  <p className="text-xs text-gray-500">Reason</p>
                  <p className="mt-1 text-sm text-gray-800 dark:text-gray-200">
                    {selected.reason}
                  </p>
                </div>
              )}

              <div className="flex flex-wrap gap-2 border-t border-gray-200 pt-4 dark:border-gray-800">
                {selected.status === "REQUESTED" && (
                  <>
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={approveReturn}
                      className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                    >
                      <CheckCircle size={16} />
                      Approve
                    </button>

                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={rejectReturn}
                      className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                    >
                      <XCircle size={16} />
                      Reject
                    </button>
                  </>
                )}

                {selected.status === "COMPLETED" && amountDue(selected) > 0 && (
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={openRefundDialog}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    <Wallet size={16} />
                    Process Refund
                  </button>
                )}

                {selected.status === "APPROVED" && (
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={completeReturn}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    <PackageCheck size={16} />
                    Complete Return
                  </button>
                )}

                {["REQUESTED", "APPROVED"].includes(selected.status) && (
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={cancelReturn}
                    className="inline-flex items-center gap-2 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 disabled:opacity-50 dark:border-red-900"
                  >
                    <Ban size={16} />
                    Cancel
                  </button>
                )}

                {actionLoading && (
                  <span className="self-center text-sm text-gray-500">
                    Processing...
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {dialog?.type === "create" && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-3 sm:p-6">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-white shadow-xl dark:bg-gray-900">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-5 py-4 dark:border-gray-800 dark:bg-gray-900">
              <div>
                <h2 className="text-lg font-bold">Create purchase return</h2>
                <p className="text-sm text-gray-500">
                  Select a received purchase and choose item quantities.
                </p>
              </div>
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setDialog(null)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-gray-800"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={createReturn} className="space-y-5 p-5">
              {(error || dialogLoading) && (
                <div
                  className={`rounded-lg p-3 text-sm ${
                    error
                      ? "border border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300"
                      : "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                  }`}
                >
                  {error || "Loading purchases and return availability…"}
                </div>
              )}

              <div>
                <div className="mb-2 flex gap-2">
                  <input
                    value={purchaseSearch}
                    maxLength={200}
                    disabled={dialogLoading || actionLoading}
                    onChange={(event) => setPurchaseSearch(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void loadEligiblePurchases(purchaseSearch);
                      }
                    }}
                    placeholder="Search purchase number..."
                    className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
                  />
                  <button
                    type="button"
                    disabled={dialogLoading || actionLoading}
                    onClick={() => void loadEligiblePurchases(purchaseSearch)}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-50 dark:border-gray-700"
                  >
                    Search
                  </button>
                </div>
                <label className="mb-1 block text-sm font-medium">
                  Purchase *
                </label>
                <select
                  required
                  disabled={dialogLoading || actionLoading}
                  value={returnForm.purchaseId}
                  onChange={(event) =>
                    void selectPurchaseForReturn(event.target.value)
                  }
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-950"
                >
                  <option value="">Select a received purchase</option>
                  {purchases.map((purchase) => (
                    <option key={purchase._id} value={purchase._id}>
                      {purchase.purchaseNumber} · {purchase.status} ·{" "}
                      {formatDate(purchase.createdAt)}
                    </option>
                  ))}
                </select>
                {!dialogLoading && purchases.length === 0 && (
                  <p className="mt-1 text-xs text-amber-600">
                    No eligible purchases with received items were found.
                  </p>
                )}
              </div>

              {returnPurchase && (
                <>
                  <div className="rounded-lg bg-gray-50 p-3 text-sm dark:bg-gray-800">
                    <p>
                      <span className="text-gray-500">Supplier:</span>{" "}
                      {getRelationName(returnPurchase.supplierId)}
                    </p>
                    <p className="mt-1">
                      <span className="text-gray-500">Warehouse:</span>{" "}
                      {getRelationName(returnPurchase.warehouseId)}
                    </p>
                  </div>

                  <div>
                    <h3 className="mb-2 font-semibold">Received items</h3>
                    {returnItems.length === 0 ? (
                      <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
                        No linked received quantities remain available to
                        return.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {returnItems.map((item) => {
                          const available =
                            item.receivedQuantity - item.previouslyReturned;
                          return (
                            <div
                              key={item.key}
                              className="rounded-lg border border-gray-200 p-3 dark:border-gray-700"
                            >
                              <label className="flex items-start gap-3">
                                <input
                                  type="checkbox"
                                  checked={item.selected}
                                  disabled={actionLoading}
                                  onChange={(event) =>
                                    setReturnItems((current) =>
                                      current.map((candidate) =>
                                        candidate.key === item.key
                                          ? {
                                              ...candidate,
                                              selected: event.target.checked,
                                            }
                                          : candidate,
                                      ),
                                    )
                                  }
                                  className="mt-1"
                                />
                                <span>
                                  <span className="block font-medium">
                                    {item.productName}
                                    {item.variantId &&
                                      ` — ${item.variantName || item.sku || "Variant"}`}
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    {item.sku ? `SKU ${item.sku} · ` : ""}
                                    Received {item.receivedQuantity} · Already
                                    returned {item.previouslyReturned} ·
                                    Available {available}
                                  </span>
                                </span>
                              </label>

                              {item.selected && (
                                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                  <label className="text-sm">
                                    <span className="mb-1 block font-medium">
                                      Return quantity *
                                    </span>
                                    <input
                                      required
                                      type="number"
                                      min={1}
                                      max={available}
                                      step={1}
                                      value={item.quantity}
                                      disabled={actionLoading}
                                      onChange={(event) =>
                                        setReturnItems((current) =>
                                          current.map((candidate) =>
                                            candidate.key === item.key
                                              ? {
                                                  ...candidate,
                                                  quantity: event.target.value,
                                                }
                                              : candidate,
                                          ),
                                        )
                                      }
                                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-950"
                                    />
                                  </label>
                                  <label className="text-sm">
                                    <span className="mb-1 block font-medium">
                                      Item condition *
                                    </span>
                                    <select
                                      required
                                      value={item.condition}
                                      disabled={actionLoading}
                                      onChange={(event) =>
                                        setReturnItems((current) =>
                                          current.map((candidate) =>
                                            candidate.key === item.key
                                              ? {
                                                  ...candidate,
                                                  condition: event.target
                                                    .value as PurchaseReturnItemCondition,
                                                }
                                              : candidate,
                                          ),
                                        )
                                      }
                                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-950"
                                    >
                                      {RETURN_CONDITIONS.map((condition) => (
                                        <option
                                          key={condition}
                                          value={condition}
                                        >
                                          {condition.replaceAll("_", " ")}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <label className="flex items-center gap-2 text-sm sm:col-span-2">
                                    <input
                                      type="checkbox"
                                      checked={item.restock}
                                      disabled={actionLoading}
                                      onChange={(event) =>
                                        setReturnItems((current) =>
                                          current.map((candidate) =>
                                            candidate.key === item.key
                                              ? {
                                                  ...candidate,
                                                  restock: event.target.checked,
                                                }
                                              : candidate,
                                          ),
                                        )
                                      }
                                    />
                                    Restock returned units after completing the
                                    return
                                  </label>
                                  <label className="text-sm sm:col-span-2">
                                    <span className="mb-1 block font-medium">
                                      Item note
                                    </span>
                                    <input
                                      maxLength={1000}
                                      value={item.note}
                                      disabled={actionLoading}
                                      onChange={(event) =>
                                        setReturnItems((current) =>
                                          current.map((candidate) =>
                                            candidate.key === item.key
                                              ? {
                                                  ...candidate,
                                                  note: event.target.value,
                                                }
                                              : candidate,
                                          ),
                                        )
                                      }
                                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-950"
                                    />
                                  </label>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-sm">
                      <span className="mb-1 block font-medium">
                        Return reason *
                      </span>
                      <select
                        required
                        value={returnForm.reason}
                        disabled={actionLoading}
                        onChange={(event) =>
                          setReturnForm((current) => ({
                            ...current,
                            reason: event.target.value as PurchaseReturnReason,
                          }))
                        }
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-950"
                      >
                        {RETURN_REASONS.map((reason) => (
                          <option key={reason} value={reason}>
                            {reason.replaceAll("_", " ")}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-sm">
                      <span className="mb-1 block font-medium">
                        Supplier reference
                      </span>
                      <input
                        maxLength={150}
                        value={returnForm.supplierReference}
                        disabled={actionLoading}
                        onChange={(event) =>
                          setReturnForm((current) => ({
                            ...current,
                            supplierReference: event.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-950"
                      />
                    </label>
                    {returnForm.reason === "OTHER" && (
                      <label className="text-sm sm:col-span-2">
                        <span className="mb-1 block font-medium">
                          Reason details *
                        </span>
                        <textarea
                          required
                          minLength={3}
                          maxLength={2000}
                          rows={2}
                          value={returnForm.reasonDetails}
                          disabled={actionLoading}
                          onChange={(event) =>
                            setReturnForm((current) => ({
                              ...current,
                              reasonDetails: event.target.value,
                            }))
                          }
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-950"
                        />
                      </label>
                    )}
                    <label className="text-sm">
                      <span className="mb-1 block font-medium">
                        Reference number
                      </span>
                      <input
                        maxLength={150}
                        value={returnForm.referenceNumber}
                        disabled={actionLoading}
                        onChange={(event) =>
                          setReturnForm((current) => ({
                            ...current,
                            referenceNumber: event.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-950"
                      />
                    </label>
                    <label className="text-sm sm:col-span-2">
                      <span className="mb-1 block font-medium">Notes</span>
                      <textarea
                        rows={3}
                        maxLength={5000}
                        value={returnForm.notes}
                        disabled={actionLoading}
                        onChange={(event) =>
                          setReturnForm((current) => ({
                            ...current,
                            notes: event.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-950"
                      />
                    </label>
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2 border-t border-gray-200 pt-4 dark:border-gray-800">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => setDialog(null)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    actionLoading ||
                    dialogLoading ||
                    !returnPurchase ||
                    returnItems.length === 0
                  }
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {actionLoading ? "Creating…" : "Create return"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {dialog && dialog.type !== "create" && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-800">
              <h2 className="font-semibold">
                {dialog.type === "refund"
                  ? "Record supplier refund"
                  : dialog.type === "reject"
                    ? "Reject purchase return"
                    : "Cancel purchase return"}
              </h2>
              <button
                type="button"
                onClick={() => setDialog(null)}
                disabled={actionLoading}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-gray-800"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={submitDialogAction} className="space-y-4 p-5">
              {error && (
                <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
                  {error}
                </p>
              )}
              {dialog.type === "refund" ? (
                <>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium">
                      Amount (max{" "}
                      {formatMoney(selected ? amountDue(selected) : 0)}) *
                    </span>
                    <input
                      required
                      type="number"
                      min="0.01"
                      max={selected ? amountDue(selected) : undefined}
                      step="0.01"
                      value={dialog.amount}
                      disabled={actionLoading}
                      onChange={(event) =>
                        setDialog((current) =>
                          current?.type === "refund"
                            ? { ...current, amount: event.target.value }
                            : current,
                        )
                      }
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-950"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium">
                      Refund method *
                    </span>
                    <select
                      required
                      value={dialog.method}
                      disabled={actionLoading}
                      onChange={(event) =>
                        setDialog((current) =>
                          current?.type === "refund"
                            ? {
                                ...current,
                                method: event.target
                                  .value as CreatePurchaseReturnRefundInput["method"],
                              }
                            : current,
                        )
                      }
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-950"
                    >
                      {[
                        "CASH",
                        "BANK_TRANSFER",
                        "CARD",
                        "CHEQUE",
                        "CREDIT_NOTE",
                        "OTHER",
                      ].map((method) => (
                        <option key={method} value={method}>
                          {method.replaceAll("_", " ")}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium">
                      Reference number
                    </span>
                    <input
                      maxLength={150}
                      value={dialog.referenceNumber}
                      disabled={actionLoading}
                      onChange={(event) =>
                        setDialog((current) =>
                          current?.type === "refund"
                            ? {
                                ...current,
                                referenceNumber: event.target.value,
                              }
                            : current,
                        )
                      }
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-950"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium">Note</span>
                    <textarea
                      maxLength={1000}
                      rows={2}
                      value={dialog.note}
                      disabled={actionLoading}
                      onChange={(event) =>
                        setDialog((current) =>
                          current?.type === "refund"
                            ? { ...current, note: event.target.value }
                            : current,
                        )
                      }
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-950"
                    />
                  </label>
                </>
              ) : (
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">Reason *</span>
                  <textarea
                    required
                    minLength={3}
                    maxLength={2000}
                    rows={4}
                    value={dialog.reason}
                    disabled={actionLoading}
                    onChange={(event) =>
                      setDialog((current) =>
                        current &&
                        (current.type === "reject" || current.type === "cancel")
                          ? { ...current, reason: event.target.value }
                          : current,
                      )
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-950"
                  />
                </label>
              )}
              <div className="flex justify-end gap-2 border-t border-gray-200 pt-4 dark:border-gray-800">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => setDialog(null)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {actionLoading ? "Processing…" : "Confirm"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
