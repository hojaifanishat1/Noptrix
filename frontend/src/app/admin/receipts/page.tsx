"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertCircle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Eye,
  FileText,
  Loader2,
  Printer,
  RefreshCw,
  Search,
  X,
} from "lucide-react";

import { receiptsApi } from "@/services/api/receipts.api";

import type {
  Receipt,
  ReceiptStatus,
} from "@/features/receipts/receipt.types";

type FilterStatus = "ALL" | ReceiptStatus;

const PAGE_SIZE = 20;

const STATUS_STYLES: Record<ReceiptStatus, string> = {
  ISSUED:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  VOID:
    "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-blue-900";

function money(value: number, currency = "BDT") {
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value ?? 0);
  } catch {
    return `${currency} ${(value ?? 0).toFixed(2)}`;
  }
}

function formatDate(value?: string | null) {
  if (!value) return "—";

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) return "—";

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function getErrorMessage(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error
  ) {
    const response = (
      error as {
        response?: {
          data?: { message?: string };
        };
      }
    ).response;

    if (response?.data?.message) {
      return response.data.message;
    }
  }

  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}

function StatusBadge({
  status,
}: {
  status: ReceiptStatus;
}) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: string;
  description: string;
  icon: typeof FileText;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {title}
          </p>

          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
            {value}
          </p>

          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {description}
          </p>
        </div>

        <div className="rounded-lg bg-blue-50 p-3 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">
          <Icon size={21} />
        </div>
      </div>
    </div>
  );
}

function ReceiptDocument({
  receipt,
}: {
  receipt: Receipt;
}) {
  const snapshot = receipt.snapshot;

  return (
    <div
      id="receipt-print-area"
      className="bg-white p-6 text-gray-900 sm:p-10"
    >
      <div className="flex flex-wrap justify-between gap-6 border-b pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            RECEIPT
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            NOPTRIX
          </p>
        </div>

        <div className="text-right">
          <p className="text-lg font-bold">
            {receipt.receiptNumber}
          </p>

          <p className="mt-1 text-sm">
            Issued: {formatDate(receipt.issuedAt)}
          </p>

          <p className="mt-2 text-sm font-semibold">
            {receipt.status}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 py-7 sm:grid-cols-2">
        <div>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">
            Customer
          </h3>

          <p className="font-semibold">
            {snapshot.customerName}
          </p>

          <p className="text-sm">
            {snapshot.customerEmail || "—"}
          </p>
        </div>

        <div className="sm:text-right">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">
            Order information
          </h3>

          <p className="text-sm">
            Order: {snapshot.orderNumber}
          </p>

          <p className="text-sm">
            Receipt ID: {receipt._id}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-y bg-gray-50 text-left">
              <th className="p-3">Item</th>
              <th className="p-3 text-right">Qty</th>
              <th className="p-3 text-right">Unit price</th>
              <th className="p-3 text-right">Total</th>
            </tr>
          </thead>

          <tbody>
            {snapshot.items.map((item, index) => (
              <tr
                key={`${item.name}-${index}`}
                className="border-b"
              >
                <td className="p-3">
                  <p className="font-medium">{item.name}</p>

                  {item.sku && (
                    <p className="text-xs text-gray-500">
                      SKU: {item.sku}
                    </p>
                  )}
                </td>

                <td className="p-3 text-right">
                  {item.quantity}
                </td>

                <td className="p-3 text-right">
                  {money(item.unitPrice, snapshot.currency)}
                </td>

                <td className="p-3 text-right font-semibold">
                  {money(item.total, snapshot.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="ml-auto mt-7 max-w-xs space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <span>Subtotal</span>
          <span>
            {money(snapshot.subtotal, snapshot.currency)}
          </span>
        </div>

        <div className="flex justify-between gap-4">
          <span>Discount</span>
          <span>
            {money(snapshot.discount, snapshot.currency)}
          </span>
        </div>

        <div className="flex justify-between gap-4">
          <span>Tax</span>
          <span>
            {money(snapshot.tax, snapshot.currency)}
          </span>
        </div>

        <div className="flex justify-between gap-4">
          <span>Shipping</span>
          <span>
            {money(snapshot.shipping, snapshot.currency)}
          </span>
        </div>

        <div className="flex justify-between gap-4 border-t pt-3 text-lg font-bold">
          <span>Total paid</span>
          <span>
            {money(snapshot.total, snapshot.currency)}
          </span>
        </div>
      </div>

      <div className="mt-12 border-t pt-5 text-center text-xs text-gray-500">
        Thank you for your purchase.
        <br />
        This is a computer-generated receipt.
      </div>
    </div>
  );
}

export default function AdminReceiptsPage() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [selectedReceipt, setSelectedReceipt] =
    useState<Receipt | null>(null);

  const [status, setStatus] =
    useState<FilterStatus>("ALL");

  const [search, setSearch] = useState("");

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState("");

  const loadReceipts = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await receiptsApi.getReceipts({
        page,
        limit: PAGE_SIZE,
        ...(status !== "ALL" ? { status } : {}),
      });

      setReceipts(result.items);
      setTotal(result.pagination.total);
      setTotalPages(result.pagination.totalPages);
    } catch (err) {
      setReceipts([]);
      setTotal(0);
      setTotalPages(1);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => {
    void loadReceipts();
  }, [loadReceipts]);

  const visibleReceipts = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return receipts;

    return receipts.filter((receipt) => {
      return (
        receipt.receiptNumber.toLowerCase().includes(term) ||
        receipt.snapshot.orderNumber.toLowerCase().includes(term) ||
        receipt.snapshot.customerName.toLowerCase().includes(term) ||
        (receipt.snapshot.customerEmail ?? "")
          .toLowerCase()
          .includes(term)
      );
    });
  }, [receipts, search]);

  const issuedCount = receipts.filter(
    (receipt) => receipt.status === "ISSUED",
  ).length;

  const voidCount = receipts.filter(
    (receipt) => receipt.status === "VOID",
  ).length;

  const openDetails = async (receipt: Receipt) => {
    setSelectedReceipt(receipt);
    setDetailsLoading(true);

    try {
      const details = await receiptsApi.getReceipt(receipt._id);
      setSelectedReceipt(details);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setDetailsLoading(false);
    }
  };

  const printReceipt = () => {
    const printable = document.getElementById(
      "receipt-print-area",
    );

    if (!printable) return;

    const popup = window.open(
      "",
      "_blank",
      "width=1000,height=800",
    );

    if (!popup) {
      window.alert("Please allow pop-ups to print the receipt.");
      return;
    }

    popup.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>${selectedReceipt?.receiptNumber ?? "Receipt"}</title>
          <meta charset="utf-8" />
          <style>
            * { box-sizing: border-box; }
            body {
              margin: 0;
              padding: 24px;
              font-family: Arial, sans-serif;
              color: #111827;
            }
            table { width: 100%; border-collapse: collapse; }
            th, td {
              padding: 12px;
              border-bottom: 1px solid #e5e7eb;
              text-align: left;
            }
            th { background: #f9fafb; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .font-bold { font-weight: 700; }
            .font-semibold { font-weight: 600; }
            .text-sm { font-size: 13px; }
            .text-xs { font-size: 11px; }
            .text-lg { font-size: 20px; }
            .text-3xl { font-size: 30px; }
            .text-gray-500 { color: #6b7280; }
            .border-b { border-bottom: 1px solid #e5e7eb; }
            .border-t { border-top: 1px solid #e5e7eb; }
            .border-y {
              border-top: 1px solid #e5e7eb;
              border-bottom: 1px solid #e5e7eb;
            }
            .flex { display: flex; }
            .flex-wrap { flex-wrap: wrap; }
            .justify-between { justify-content: space-between; }
            .justify-between > * { min-width: 0; }
            .gap-4 { gap: 16px; }
            .gap-6 { gap: 24px; }
            .gap-8 { gap: 32px; }
            .grid { display: grid; }
            .grid-cols-1 { grid-template-columns: 1fr; }
            .p-3 { padding: 12px; }
            .p-6 { padding: 24px; }
            .py-5 { padding-top: 20px; padding-bottom: 20px; }
            .py-7 { padding-top: 28px; padding-bottom: 28px; }
            .mt-1 { margin-top: 4px; }
            .mt-2 { margin-top: 8px; }
            .mt-7 { margin-top: 28px; }
            .mt-12 { margin-top: 48px; }
            .ml-auto { margin-left: auto; }
            .max-w-xs { max-width: 320px; }
            .w-full { width: 100%; }
            .space-y-2 > * + * { margin-top: 8px; }
            .pt-3 { padding-top: 12px; }
            .pt-5 { padding-top: 20px; }
            .pb-6 { padding-bottom: 24px; }
            .uppercase { text-transform: uppercase; }
            .tracking-wide { letter-spacing: .05em; }
            @media print {
              body { padding: 0; }
              @page { margin: 15mm; }
            }
          </style>
        </head>
        <body>
          ${printable.innerHTML}
          <script>
            window.onload = () => {
              window.print();
              window.onafterprint = () => window.close();
            };
          </script>
        </body>
      </html>
    `);

    popup.document.close();
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="text-blue-600" size={25} />

            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Receipts
            </h1>
          </div>

          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            View and manage issued customer receipts.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadReceipts()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          <RefreshCw
            size={16}
            className={loading ? "animate-spin" : ""}
          />
          Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          <AlertCircle size={19} className="mt-0.5 shrink-0" />

          <div className="min-w-0 flex-1">
            <p className="font-semibold">
              Unable to load receipts
            </p>

            <p className="mt-1 break-words">{error}</p>

            <p className="mt-2 text-xs">
              The current backend Receipt routes use Customer authentication.
              An Admin session may not be authorized to access this endpoint.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setError("")}
            aria-label="Dismiss error"
          >
            <X size={17} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          title="Receipts on this page"
          value={String(receipts.length)}
          description={`${total} total matching receipts`}
          icon={FileText}
        />

        <StatCard
          title="Issued"
          value={String(issuedCount)}
          description="Issued receipts on this page"
          icon={CircleDollarSign}
        />

        <StatCard
          title="Voided"
          value={String(voidCount)}
          description="Voided receipts on this page"
          icon={CalendarDays}
        />
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
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search receipt, order, customer..."
              className={`${inputClass} pl-10`}
            />
          </div>

          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as FilterStatus);
              setPage(1);
            }}
            className={`${inputClass} lg:w-48`}
          >
            <option value="ALL">All statuses</option>
            <option value="ISSUED">Issued</option>
            <option value="VOID">Void</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-800">
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white">
              Receipt records
            </h2>

            <p className="mt-1 text-xs text-gray-500">
              Showing {visibleReceipts.length} of {total} records on this page
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-gray-500">
            <Loader2 size={22} className="animate-spin" />
            Loading receipts...
          </div>
        ) : visibleReceipts.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-5 text-center">
            <div className="rounded-full bg-gray-100 p-4 dark:bg-gray-800">
              <FileText size={28} className="text-gray-400" />
            </div>

            <h3 className="mt-4 font-semibold text-gray-900 dark:text-white">
              No receipts found
            </h3>

            <p className="mt-1 text-sm text-gray-500">
              {search
                ? "Try another search term."
                : "There are no receipts available for this filter."}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-950 dark:text-gray-400">
                  <tr>
                    <th className="px-5 py-3">Receipt</th>
                    <th className="px-5 py-3">Customer</th>
                    <th className="px-5 py-3">Order</th>
                    <th className="px-5 py-3">Amount</th>
                    <th className="px-5 py-3">Issued date</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {visibleReceipts.map((receipt) => (
                    <tr
                      key={receipt._id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    >
                      <td className="px-5 py-4">
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {receipt.receiptNumber}
                        </p>

                        <p className="mt-1 text-xs text-gray-500">
                          {receipt._id}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <p className="font-medium text-gray-900 dark:text-white">
                          {receipt.snapshot.customerName}
                        </p>

                        <p className="mt-1 text-xs text-gray-500">
                          {receipt.snapshot.customerEmail || "—"}
                        </p>
                      </td>

                      <td className="px-5 py-4 text-gray-700 dark:text-gray-300">
                        {receipt.snapshot.orderNumber}
                      </td>

                      <td className="px-5 py-4 font-semibold text-gray-900 dark:text-white">
                        {money(
                          receipt.snapshot.total,
                          receipt.snapshot.currency,
                        )}
                      </td>

                      <td className="px-5 py-4 text-gray-600 dark:text-gray-300">
                        {formatDate(receipt.issuedAt)}
                      </td>

                      <td className="px-5 py-4">
                        <StatusBadge status={receipt.status} />
                      </td>

                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => void openDetails(receipt)}
                          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
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

            <div className="flex flex-col gap-3 border-t border-gray-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800">
              <p className="text-sm text-gray-500">
                Page {page} of {totalPages}
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((current) => current - 1)}
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
          </>
        )}
      </div>

      {selectedReceipt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedReceipt(null);
            }
          }}
        >
          <div className="flex max-h-[95vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-800">
              <div>
                <h2 className="font-bold text-gray-900 dark:text-white">
                  Receipt details
                </h2>

                <p className="mt-1 text-xs text-gray-500">
                  {selectedReceipt.receiptNumber}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={printReceipt}
                  disabled={detailsLoading}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  <Printer size={16} />
                  Print / PDF
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedReceipt(null)}
                  aria-label="Close receipt"
                  className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <X size={19} />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto">
              {detailsLoading ? (
                <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-gray-500">
                  <Loader2 size={22} className="animate-spin" />
                  Loading receipt details...
                </div>
              ) : (
                <ReceiptDocument receipt={selectedReceipt} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
