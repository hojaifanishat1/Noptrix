"use client";

import { useCallback, useEffect, useState } from "react";

import {
  Search,
  RefreshCw,
  Eye,
  CheckCircle,
  XCircle,
  PackageCheck,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Wallet,
  Clock,
  X,
  Image as ImageIcon,
  ClipboardCheck,
  AlertCircle,
} from "lucide-react";

import { returnsAdminApi } from "@/services/api/returns-admin.api";

import type {
  ReturnAnalytics,
  ReturnRequest,
  ReturnStatus,
  ReturnItem,
} from "@/features/returns/return.types";

const PAGE_SIZE = 20;

const STATUS_OPTIONS: ReturnStatus[] = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "RECEIVED",
  "INSPECTING",
  "COMPLETED",
  "CANCELLED",
];

type Dialog =
  | { type: "review"; status: "APPROVED" | "REJECTED" }
  | { type: "inspection" }
  | { type: "complete" }
  | null;

type InspectionDraft = {
  orderItemId: string;
  receivedQuantity: string;
  acceptedQuantity: string;
  inspectionNote: string;
};

function formatMoney(value?: number, currency = "BDT") {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}

function formatDate(value?: string) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getErrorMessage(error: unknown) {
  const value = error as {
    response?: { data?: { message?: string } };
    message?: string;
  };

  return (
    value.response?.data?.message || value.message || "Something went wrong."
  );
}

function getRelation(
  value:
    | string
    | {
        _id?: string;
        name?: string;
        email?: string;
        phone?: string;
        orderNumber?: string;
      }
    | undefined,
) {
  if (!value) return "—";
  if (typeof value === "string") return value;
  return value.name || value.orderNumber || value.email || value._id || "—";
}

function statusClass(status: string) {
  const classes: Record<string, string> = {
    PENDING:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    APPROVED:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    REJECTED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    RECEIVED:
      "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
    INSPECTING:
      "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    COMPLETED:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    CANCELLED: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  };

  return classes[status] ?? classes.CANCELLED;
}

function StatusBadge({ status }: { status: ReturnStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(status)}`}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}

function SummaryCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  description: string;
  icon: typeof ClipboardList;
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

function ItemDetails({ item }: { item: ReturnItem }) {
  return (
    <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-gray-900 dark:text-white">
            {item.productName}
          </p>
          <p className="mt-1 text-xs text-gray-500">SKU: {item.sku || "—"}</p>
          <p className="mt-1 text-xs text-gray-500">
            Reason: {item.reason.replaceAll("_", " ")}
          </p>
        </div>
        <div className="text-right text-sm">
          <p className="font-semibold text-gray-900 dark:text-white">
            {item.quantity} × {formatMoney(item.unitPrice)}
          </p>
          <p className="mt-1 text-gray-500">
            Total: {formatMoney(item.lineTotal)}
          </p>
        </div>
      </div>

      {item.customerNote && (
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
          Customer note: {item.customerNote}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
        <span>Received: {item.receivedQuantity}</span>
        <span>Accepted: {item.acceptedQuantity}</span>
      </div>

      {item.evidenceUrls?.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-gray-500">
            <ImageIcon size={14} />
            Customer evidence
          </p>
          <div className="flex flex-wrap gap-2">
            {item.evidenceUrls.map((url, index) => (
              <a
                key={`${url}-${index}`}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <img
                  src={url}
                  alt={`${item.productName} evidence ${index + 1}`}
                  className="h-20 w-20 object-cover"
                />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReturnsPage() {
  const [items, setItems] = useState<ReturnRequest[]>([]);
  const [analytics, setAnalytics] = useState<ReturnAnalytics | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [selected, setSelected] = useState<ReturnRequest | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);

  const [reviewAmount, setReviewAmount] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [inspectionNote, setInspectionNote] = useState("");
  const [inspectionDraft, setInspectionDraft] = useState<InspectionDraft[]>([]);

  const loadData = useCallback(
    async (showRefresh = false) => {
      if (showRefresh) setRefreshing(true);
      else setLoading(true);

      setError("");

      try {
        const [listResult, analyticsResult] = await Promise.all([
          returnsAdminApi.list({
            page,
            limit: PAGE_SIZE,
            search: search.trim() || undefined,
            status: (status || undefined) as ReturnStatus | undefined,
            sort,
          }),
          returnsAdminApi.analytics(),
        ]);

        setItems(listResult.items);
        setTotal(listResult.pagination.total);
        setTotalPages(Math.max(1, listResult.pagination.totalPages));
        setAnalytics(analyticsResult);
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [page, search, status, sort],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadData();
    }, 250);

    return () => clearTimeout(timer);
  }, [loadData]);

  const openDetails = async (item: ReturnRequest) => {
    setError("");
    setActionLoading(true);

    try {
      const detail = await returnsAdminApi.get(item._id);
      setSelected(detail);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  const refreshSelected = async () => {
    if (!selected) return;

    const detail = await returnsAdminApi.get(selected._id);
    setSelected(detail);
  };

  const openReview = (reviewStatus: "APPROVED" | "REJECTED") => {
    if (!selected) return;

    setReviewAmount(String(selected.requestedRefundAmount ?? 0));
    setReviewNote("");
    setDialog({ type: "review", status: reviewStatus });
  };

  const submitReview = async () => {
    if (!selected || !dialog || dialog.type !== "review") return;

    const amount = Number(reviewAmount);

    if (
      dialog.status === "APPROVED" &&
      (!Number.isFinite(amount) ||
        amount < 0 ||
        amount > selected.requestedRefundAmount)
    ) {
      setError("Enter a valid refund amount within the requested amount.");
      return;
    }

    setActionLoading(true);
    setError("");

    try {
      await returnsAdminApi.review(selected._id, {
        status: dialog.status,
        ...(dialog.status === "APPROVED"
          ? { approvedRefundAmount: amount }
          : {}),
        reviewNote: reviewNote.trim() || undefined,
      });

      setNotice(
        dialog.status === "APPROVED"
          ? "Return request approved."
          : "Return request rejected.",
      );

      setDialog(null);
      await refreshSelected();
      await loadData(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  const openInspection = () => {
    if (!selected) return;

    setInspectionDraft(
      selected.items.map((item) => ({
        orderItemId: item.orderItemId,
        receivedQuantity: String(item.receivedQuantity ?? 0),
        acceptedQuantity: String(item.acceptedQuantity ?? 0),
        inspectionNote: item.inspectionNote ?? "",
      })),
    );

    setInspectionNote("");
    setDialog({ type: "inspection" });
  };

  const updateInspection = (
    orderItemId: string,
    field: "receivedQuantity" | "acceptedQuantity" | "inspectionNote",
    value: string,
  ) => {
    setInspectionDraft((current) =>
      current.map((item) =>
        item.orderItemId === orderItemId ? { ...item, [field]: value } : item,
      ),
    );
  };

  const submitInspection = async () => {
    if (!selected) return;

    const inspectionItems = inspectionDraft.map((item) => ({
      orderItemId: item.orderItemId,
      receivedQuantity: Number(item.receivedQuantity),
      acceptedQuantity: Number(item.acceptedQuantity),
      inspectionNote: item.inspectionNote.trim() || undefined,
    }));

    for (const item of inspectionItems) {
      const original = selected.items.find(
        (entry) => entry.orderItemId === item.orderItemId,
      );

      if (
        !original ||
        !Number.isInteger(item.receivedQuantity) ||
        !Number.isInteger(item.acceptedQuantity) ||
        item.receivedQuantity < 0 ||
        item.acceptedQuantity < 0 ||
        item.receivedQuantity > original.quantity ||
        item.acceptedQuantity > item.receivedQuantity
      ) {
        setError("Invalid inspection quantities. Please check each item.");
        return;
      }
    }

    setActionLoading(true);
    setError("");

    try {
      await returnsAdminApi.inspect(selected._id, {
        items: inspectionItems,
        inspectionNote: inspectionNote.trim() || undefined,
      });

      setNotice("Return inspection saved.");
      setDialog(null);
      await refreshSelected();
      await loadData(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  const submitComplete = async () => {
    if (!selected) return;

    setActionLoading(true);
    setError("");

    try {
      await returnsAdminApi.complete(selected._id);
      setNotice("Return marked as completed.");
      setDialog(null);
      await refreshSelected();
      await loadData(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  const closeDetails = () => {
    setSelected(null);
    setDialog(null);
    setError("");
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Returns Management
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage customer return requests, inspections and resolutions.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadData(true)}
          disabled={refreshing || loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
        >
          <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {notice && (
        <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-900/20 dark:text-green-300">
          {notice}
          <button type="button" onClick={() => setNotice("")}>
            <X size={16} />
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
          <span className="flex items-center gap-2">
            <AlertCircle size={16} />
            {error}
          </span>
          <button type="button" onClick={() => setError("")}>
            <X size={16} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Total Returns"
          value={analytics?.total ?? total}
          description="All return requests"
          icon={ClipboardList}
        />
        <SummaryCard
          title="Pending Requests"
          value={analytics?.statusCounts.PENDING ?? 0}
          description="Awaiting admin review"
          icon={Clock}
        />
        <SummaryCard
          title="Approved"
          value={analytics?.statusCounts.APPROVED ?? 0}
          description="Approved for return"
          icon={CheckCircle}
        />
        <SummaryCard
          title="Completed"
          value={analytics?.statusCounts.COMPLETED ?? 0}
          description="Return process completed"
          icon={PackageCheck}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {STATUS_OPTIONS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => {
              setStatus(status === item ? "" : item);
              setPage(1);
            }}
            className={`rounded-xl border p-4 text-left transition ${
              status === item
                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                : "border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                {item}
              </span>
              <StatusBadge status={item} />
            </div>
            <p className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">
              {analytics?.statusCounts[item] ?? 0}
            </p>
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
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
              placeholder="Search return number, order ID or customer note..."
              className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
            />
          </div>

          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <select
            value={sort}
            onChange={(event) => {
              setSort(event.target.value as "newest" | "oldest");
              setPage(1);
            }}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-800">
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white">
              Return Requests
            </h2>
            <p className="mt-1 text-xs text-gray-500">{total} total requests</p>
          </div>
          <ClipboardList className="text-gray-400" size={20} />
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-gray-500">
            Loading return requests...
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center">
            <PackageCheck className="mx-auto text-gray-400" size={36} />
            <p className="mt-3 font-medium text-gray-700 dark:text-gray-200">
              No return requests found
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Try changing your search or filters.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-950 dark:text-gray-400">
                  <tr>
                    <th className="px-5 py-3">Return</th>
                    <th className="px-5 py-3">Customer</th>
                    <th className="px-5 py-3">Items</th>
                    <th className="px-5 py-3">Resolution</th>
                    <th className="px-5 py-3">Requested amount</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {items.map((item) => (
                    <tr
                      key={item._id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/40"
                    >
                      <td className="px-5 py-4">
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {item.returnNumber}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          Order: {getRelation(item.orderId)}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-medium text-gray-800 dark:text-gray-200">
                          {getRelation(item.userId)}
                        </p>
                        {typeof item.userId !== "string" && (
                          <p className="mt-1 text-xs text-gray-500">
                            {item.userId?.email || ""}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {item.items?.length ?? 0} item(s)
                      </td>
                      <td className="px-5 py-4">
                        {item.resolution.replaceAll("_", " ")}
                      </td>
                      <td className="px-5 py-4 font-medium text-gray-900 dark:text-white">
                        {formatMoney(item.requestedRefundAmount, item.currency)}
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="px-5 py-4 text-gray-500">
                        {formatDate(item.createdAt)}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => void openDetails(item)}
                          disabled={actionLoading}
                          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                        >
                          <Eye size={15} />
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col justify-between gap-3 border-t border-gray-200 px-5 py-4 sm:flex-row sm:items-center dark:border-gray-800">
              <p className="text-xs text-gray-500">
                Page {page} of {totalPages} · {total} results
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  className="rounded-lg border border-gray-200 p-2 disabled:opacity-40 dark:border-gray-700"
                >
                  <ChevronLeft size={17} />
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() =>
                    setPage((value) => Math.min(totalPages, value + 1))
                  }
                  className="rounded-lg border border-gray-200 p-2 disabled:opacity-40 dark:border-gray-700"
                >
                  <ChevronRight size={17} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* DETAILS DRAWER */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50">
          <div className="flex h-full w-full max-w-3xl flex-col overflow-hidden bg-white shadow-xl dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-200 p-5 dark:border-gray-800">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  Return Details
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {selected.returnNumber}
                </p>
              </div>
              <button
                type="button"
                onClick={closeDetails}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <StatusBadge status={selected.status} />
                <span className="text-sm text-gray-500">
                  Created: {formatDate(selected.createdAt)}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
                  <p className="text-xs text-gray-500">Customer</p>
                  <p className="mt-1 font-semibold text-gray-900 dark:text-white">
                    {getRelation(selected.userId)}
                  </p>
                  {typeof selected.userId !== "string" && (
                    <>
                      <p className="mt-1 text-sm text-gray-500">
                        {selected.userId?.email || ""}
                      </p>
                      <p className="text-sm text-gray-500">
                        {selected.userId?.phone || ""}
                      </p>
                    </>
                  )}
                </div>

                <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
                  <p className="text-xs text-gray-500">Order</p>
                  <p className="mt-1 font-semibold text-gray-900 dark:text-white">
                    {getRelation(selected.orderId)}
                  </p>
                  {typeof selected.orderId !== "string" && (
                    <p className="mt-1 text-sm text-gray-500">
                      {selected.orderId?.status || ""}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                  <p className="text-xs text-gray-500">Requested</p>
                  <p className="mt-1 font-bold text-gray-900 dark:text-white">
                    {formatMoney(
                      selected.requestedRefundAmount,
                      selected.currency,
                    )}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                  <p className="text-xs text-gray-500">Approved</p>
                  <p className="mt-1 font-bold text-gray-900 dark:text-white">
                    {formatMoney(
                      selected.approvedRefundAmount,
                      selected.currency,
                    )}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                  <p className="text-xs text-gray-500">Resolution</p>
                  <p className="mt-1 font-bold text-gray-900 dark:text-white">
                    {selected.resolution.replaceAll("_", " ")}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="mb-3 font-semibold text-gray-900 dark:text-white">
                  Returned Items
                </h3>
                <div className="space-y-3">
                  {selected.items.map((item) => (
                    <div key={item.orderItemId} className="space-y-2">
                      <ItemDetails item={item} />
                      {item.inspectionNote && (
                        <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 dark:border-purple-900 dark:bg-purple-900/10">
                          <p className="text-xs font-semibold text-purple-700 dark:text-purple-300">
                            Item inspection note
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-200">
                            {item.inspectionNote}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {selected.customerNote && (
                <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                  <p className="text-xs font-semibold text-gray-500">
                    Customer note
                  </p>
                  <p className="mt-2 text-sm text-gray-700 dark:text-gray-200">
                    {selected.customerNote}
                  </p>
                </div>
              )}

              {selected.reviewNote && (
                <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                  <p className="text-xs font-semibold text-gray-500">
                    Admin review note
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-200">
                    {selected.reviewNote}
                  </p>
                </div>
              )}

              {selected.inspectionNote && (
                <div className="rounded-lg border border-purple-200 p-4 dark:border-purple-900">
                  <p className="text-xs font-semibold text-purple-700 dark:text-purple-300">
                    Overall inspection note
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-200">
                    {selected.inspectionNote}
                  </p>
                </div>
              )}

              <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                <h3 className="mb-3 font-semibold text-gray-900 dark:text-white">
                  Timeline
                </h3>
                <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                  <p>Requested: {formatDate(selected.createdAt)}</p>
                  <p>Reviewed: {formatDate(selected.reviewedAt)}</p>
                  <p>Received: {formatDate(selected.receivedAt)}</p>
                  <p>Inspected: {formatDate(selected.inspectedAt)}</p>
                  <p>Completed: {formatDate(selected.completedAt)}</p>
                  <p>Rejected: {formatDate(selected.rejectedAt)}</p>
                  <p>Cancelled: {formatDate(selected.cancelledAt)}</p>
                </div>
              </div>

              {selected.refundId && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-900/20 dark:text-blue-300">
                  Refund record: {selected.refundId}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2 border-t border-gray-200 p-4 dark:border-gray-800">
              {selected.status === "PENDING" && (
                <>
                  <button
                    type="button"
                    onClick={() => openReview("APPROVED")}
                    className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700"
                  >
                    <CheckCircle size={16} />
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => openReview("REJECTED")}
                    className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
                  >
                    <XCircle size={16} />
                    Reject
                  </button>
                </>
              )}

              {["APPROVED", "RECEIVED", "INSPECTING"].includes(
                selected.status,
              ) && (
                <button
                  type="button"
                  onClick={openInspection}
                  className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-purple-700"
                >
                  <ClipboardCheck size={16} />
                  Inspect return
                </button>
              )}

              {selected.status === "INSPECTING" && (
                <button
                  type="button"
                  onClick={() => setDialog({ type: "complete" })}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  <PackageCheck size={16} />
                  Complete return
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ACTION DIALOG */}
      {dialog && selected && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/60 p-4">
          <div className="my-auto w-full max-w-xl rounded-xl bg-white p-5 shadow-2xl dark:bg-gray-900">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {dialog.type === "review"
                  ? `${dialog.status === "APPROVED" ? "Approve" : "Reject"} Return`
                  : dialog.type === "inspection"
                    ? "Return Inspection"
                    : "Complete Return"}
              </h3>
              <button
                type="button"
                onClick={() => setDialog(null)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X size={18} />
              </button>
            </div>

            {dialog.type === "review" && (
              <div className="mt-5 space-y-4">
                {dialog.status === "APPROVED" && (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Approved refund amount ({selected.currency})
                    </label>
                    <input
                      type="number"
                      min="0"
                      max={selected.requestedRefundAmount}
                      step="0.01"
                      value={reviewAmount}
                      onChange={(event) => setReviewAmount(event.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Maximum:{" "}
                      {formatMoney(
                        selected.requestedRefundAmount,
                        selected.currency,
                      )}
                    </p>
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Review note
                  </label>
                  <textarea
                    rows={4}
                    maxLength={1000}
                    value={reviewNote}
                    onChange={(event) => setReviewNote(event.target.value)}
                    placeholder="Write an internal review note..."
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                  />
                </div>
              </div>
            )}

            {dialog.type === "inspection" && (
              <div className="mt-5 space-y-4">
                <p className="text-sm text-gray-500">
                  Record received and accepted quantities for each returned
                  item.
                </p>

                {inspectionDraft.map((draft) => {
                  const item = selected.items.find(
                    (entry) => entry.orderItemId === draft.orderItemId,
                  );

                  if (!item) return null;

                  return (
                    <div
                      key={draft.orderItemId}
                      className="rounded-lg border border-gray-200 p-3 dark:border-gray-700"
                    >
                      <p className="mb-3 font-semibold text-gray-900 dark:text-white">
                        {item.productName}
                      </p>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="mb-1 block text-xs text-gray-500">
                            Received quantity (max {item.quantity})
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={item.quantity}
                            value={draft.receivedQuantity}
                            onChange={(event) =>
                              updateInspection(
                                draft.orderItemId,
                                "receivedQuantity",
                                event.target.value,
                              )
                            }
                            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-xs text-gray-500">
                            Accepted quantity
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={item.quantity}
                            value={draft.acceptedQuantity}
                            onChange={(event) =>
                              updateInspection(
                                draft.orderItemId,
                                "acceptedQuantity",
                                event.target.value,
                              )
                            }
                            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                          />
                        </div>
                      </div>

                      <div className="mt-3">
                        <label className="mb-1 block text-xs font-medium text-gray-500">
                          Item inspection note
                        </label>
                        <textarea
                          rows={2}
                          maxLength={1000}
                          value={draft.inspectionNote}
                          onChange={(event) =>
                            updateInspection(
                              draft.orderItemId,
                              "inspectionNote",
                              event.target.value,
                            )
                          }
                          placeholder="Condition, defects or item-specific findings..."
                          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                        />
                      </div>
                    </div>
                  );
                })}

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Overall inspection note
                  </label>
                  <textarea
                    rows={3}
                    maxLength={1000}
                    value={inspectionNote}
                    onChange={(event) => setInspectionNote(event.target.value)}
                    placeholder="Describe the inspection result..."
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                  />
                </div>
              </div>
            )}

            {dialog.type === "complete" && (
              <div className="mt-5 space-y-3">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Are you sure you want to complete this return?
                </p>
                <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                  All requested items must be marked as received. Completion
                  updates the returned quantities on the associated order. It
                  does not automatically execute a payment refund.
                </p>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDialog(null)}
                disabled={actionLoading}
                className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 dark:border-gray-700 dark:text-gray-200"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={actionLoading}
                onClick={() => {
                  if (dialog.type === "review") void submitReview();
                  else if (dialog.type === "inspection")
                    void submitInspection();
                  else void submitComplete();
                }}
                className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {actionLoading
                  ? "Processing..."
                  : dialog.type === "review"
                    ? "Submit review"
                    : dialog.type === "inspection"
                      ? "Save inspection"
                      : "Complete return"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
