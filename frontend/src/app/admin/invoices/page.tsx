"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock,
  Download,
  Eye,
  FilePlus2,
  FileText,
  Loader2,
  Printer,
  RefreshCw,
  Search,
  X,
  XCircle,
} from "lucide-react";

import { invoicesApi } from "@/services/api/invoices.api";

import type {
  CreateInvoiceInput,
  Invoice,
  InvoiceStatus,
} from "@/features/invoices/invoice.types";

const STATUSES: Array<InvoiceStatus | "ALL"> = [
  "ALL",
  "DRAFT",
  "ISSUED",
  "PAID",
  "OVERDUE",
  "VOID",
];

const STATUS_STYLE: Record<InvoiceStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  ISSUED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  PAID: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  OVERDUE: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  VOID: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
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

function date(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
  }).format(parsed);
}

function errorMessage(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error
  ) {
    const response = (
      error as {
        response?: { data?: { message?: string } };
      }
    ).response;

    if (response?.data?.message) return response.data.message;
  }

  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}

function StatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[status]}`}
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
          <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
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

function InvoiceDocument({ invoice }: { invoice: Invoice }) {
  return (
    <div id="invoice-print-area" className="bg-white p-8 text-gray-900">
      <div className="flex flex-wrap justify-between gap-6 border-b pb-6">
        <div>
          <h1 className="text-3xl font-bold">INVOICE</h1>
          <p className="mt-2 text-sm text-gray-500">NOPTRIX</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold">{invoice.invoiceNumber}</p>
          <p className="mt-1 text-sm">Date: {date(invoice.createdAt)}</p>
          <p className="text-sm">Due: {date(invoice.dueAt)}</p>
          <p className="mt-2 text-sm font-semibold">{invoice.status}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-8 py-7">
        <div>
          <h3 className="mb-2 text-xs font-bold uppercase text-gray-500">
            Bill to
          </h3>
          <p className="font-semibold">{invoice.customerName}</p>
          <p className="text-sm">{invoice.customerEmail || "—"}</p>
          <p className="mt-1 text-sm">
            {invoice.customerId}
          </p>
        </div>
        <div className="text-right">
          <h3 className="mb-2 text-xs font-bold uppercase text-gray-500">
            Order information
          </h3>
          <p className="text-sm">Order ID: {invoice.orderId || "—"}</p>
          <p className="text-sm">Invoice ID: {invoice._id}</p>
        </div>
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-y bg-gray-50 text-left">
            <th className="p-3">Description</th>
            <th className="p-3 text-right">Qty</th>
            <th className="p-3 text-right">Unit price</th>
            <th className="p-3 text-right">Discount</th>
            <th className="p-3 text-right">Tax</th>
            <th className="p-3 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {invoice.lines.map((line, index) => (
            <tr key={`${line.description}-${index}`} className="border-b">
              <td className="p-3">
                <p className="font-medium">{line.description}</p>
                {line.sku && (
                  <p className="text-xs text-gray-500">SKU: {line.sku}</p>
                )}
              </td>
              <td className="p-3 text-right">{line.quantity}</td>
              <td className="p-3 text-right">
                {money(line.unitPrice, invoice.currency)}
              </td>
              <td className="p-3 text-right">
                {money(line.discountAmount, invoice.currency)}
              </td>
              <td className="p-3 text-right">
                {money(line.taxAmount, invoice.currency)}
              </td>
              <td className="p-3 text-right font-semibold">
                {money(line.lineTotal, invoice.currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="ml-auto mt-7 max-w-xs space-y-2 text-sm">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{money(invoice.totals.subtotal, invoice.currency)}</span>
        </div>
        <div className="flex justify-between">
          <span>Discount</span>
          <span>{money(invoice.totals.discountAmount, invoice.currency)}</span>
        </div>
        <div className="flex justify-between">
          <span>Tax</span>
          <span>{money(invoice.totals.taxAmount, invoice.currency)}</span>
        </div>
        <div className="flex justify-between">
          <span>Shipping</span>
          <span>{money(invoice.totals.shippingAmount, invoice.currency)}</span>
        </div>
        <div className="flex justify-between border-t pt-3 text-lg font-bold">
          <span>Total</span>
          <span>{money(invoice.totals.total, invoice.currency)}</span>
        </div>
      </div>

      {invoice.notes && (
        <div className="mt-8 border-t pt-5">
          <h3 className="font-semibold">Notes</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm">{invoice.notes}</p>
        </div>
      )}

      <div className="mt-12 border-t pt-5 text-center text-xs text-gray-500">
        Thank you for your business.
      </div>
    </div>
  );
}

function printInvoice(invoice: Invoice) {
  const printable = document.getElementById("invoice-print-area");
  if (!printable) return;

  const popup = window.open("", "_blank", "width=1000,height=800");
  if (!popup) {
    window.alert("Please allow pop-ups to print the invoice.");
    return;
  }

  popup.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>${invoice.invoiceNumber}</title>
        <meta charset="utf-8" />
        <style>
          body { margin: 0; font-family: Arial, sans-serif; }
          #invoice-print-area { padding: 32px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { padding: 10px; border-bottom: 1px solid #ddd; }
          th { background: #f5f5f5; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .font-bold { font-weight: bold; }
          .font-semibold { font-weight: 600; }
          .text-sm { font-size: 13px; }
          .text-xs { font-size: 11px; }
          .text-lg { font-size: 20px; }
          .text-3xl { font-size: 30px; }
          .uppercase { text-transform: uppercase; }
          .border-b { border-bottom: 1px solid #ddd; }
          .border-t { border-top: 1px solid #ddd; }
          .border-y { border-top: 1px solid #ddd; border-bottom: 1px solid #ddd; }
          .p-3 { padding: 10px; }
          .p-8 { padding: 32px; }
          .pt-3 { padding-top: 12px; }
          .pt-5 { padding-top: 20px; }
          .pb-6 { padding-bottom: 24px; }
          .mt-1 { margin-top: 4px; }
          .mt-2 { margin-top: 8px; }
          .mt-7 { margin-top: 28px; }
          .mt-8 { margin-top: 32px; }
          .mt-12 { margin-top: 48px; }
          .ml-auto { margin-left: auto; }
          .max-w-xs { max-width: 320px; }
          .w-full { width: 100%; }
          .flex { display: flex; }
          .justify-between { justify-content: space-between; }
          .grid { display: grid; }
          .grid-cols-2 { grid-template-columns: 1fr 1fr; }
          .gap-8 { gap: 32px; }
          .space-y-2 > * + * { margin-top: 8px; }
          .text-gray-500 { color: #6b7280; }
          .bg-gray-50 { background: #f9fafb; }
          @media print { body { print-color-adjust: exact; } }
        </style>
      </head>
      <body>${printable.outerHTML}</body>
    </html>
  `);

  popup.document.close();
  popup.focus();
  popup.onload = () => {
    popup.print();
  };
}

export default function AdminInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<InvoiceStatus | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [selected, setSelected] = useState<Invoice | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [notice, setNotice] = useState("");

  const [form, setForm] = useState({
    customerId: "",
    customerName: "",
    customerEmail: "",
    currency: "BDT",
    description: "",
    quantity: "1",
    unitPrice: "",
    lineDiscount: "0",
    lineTax: "0",
    shippingAmount: "0",
    invoiceDiscount: "0",
    invoiceTax: "0",
    dueAt: "",
    notes: "",
    orderId: "",
  });

  const fetchInvoices = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    setError("");

    try {
      const result = await invoicesApi.getInvoices({
        page,
        limit: 20,
        search: search.trim() || undefined,
        status: status === "ALL" ? undefined : status,
      });

      setInvoices(result.data);
      setTotal(result.pagination.total);
      setTotalPages(result.pagination.totalPages);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, search, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchInvoices();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [fetchInvoices]);

  const stats = useMemo(() => {
    return {
      draft: invoices.filter((item) => item.status === "DRAFT").length,
      issued: invoices.filter((item) => item.status === "ISSUED").length,
      paid: invoices.filter((item) => item.status === "PAID").length,
      overdue: invoices.filter((item) => item.status === "OVERDUE").length,
      totalValue: invoices.reduce(
        (sum, item) => sum + (item.totals?.total ?? 0),
        0,
      ),
    };
  }, [invoices]);

  async function openDetails(invoiceId: string) {
    setDetailsLoading(true);
    setSelected(null);

    try {
      const response = await invoicesApi.getInvoice(invoiceId);
      setSelected(response.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setDetailsLoading(false);
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setNotice("");
    setError("");

    const input: CreateInvoiceInput = {
      customerId: form.customerId.trim(),
      customerName: form.customerName.trim(),
      customerEmail: form.customerEmail.trim() || undefined,
      currency: form.currency.toUpperCase(),
      orderId: form.orderId.trim() || undefined,
      lines: [
        {
          description: form.description.trim(),
          quantity: Number(form.quantity),
          unitPrice: Number(form.unitPrice),
          discountAmount: Number(form.lineDiscount),
          taxAmount: Number(form.lineTax),
        },
      ],
      discountAmount: Number(form.invoiceDiscount),
      taxAmount: Number(form.invoiceTax),
      shippingAmount: Number(form.shippingAmount),
      dueAt: form.dueAt
        ? new Date(form.dueAt).toISOString()
        : null,
      notes: form.notes.trim() || undefined,
    };

    try {
      const response = await invoicesApi.createInvoice(input);
      setCreateOpen(false);
      setForm({
        customerId: "",
        customerName: "",
        customerEmail: "",
        currency: "BDT",
        description: "",
        quantity: "1",
        unitPrice: "",
        lineDiscount: "0",
        lineTax: "0",
        shippingAmount: "0",
        invoiceDiscount: "0",
        invoiceTax: "0",
        dueAt: "",
        notes: "",
        orderId: "",
      });
      setNotice(response.message || "Invoice created successfully.");
      setPage(1);
      await fetchInvoices(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(
    invoice: Invoice,
    nextStatus: "ISSUED" | "VOID",
  ) {
    const message =
      nextStatus === "ISSUED"
        ? "Issue this invoice?"
        : "Void this invoice? This action cannot be reversed.";

    if (!window.confirm(message)) return;

    setActionLoading(true);
    setError("");

    try {
      const response = await invoicesApi.updateStatus(
        invoice._id,
        nextStatus,
      );

      setSelected(response.data);
      setNotice(response.message || "Invoice status updated.");
      await fetchInvoices(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setActionLoading(false);
    }
  }

  const draftTotal = Number(form.quantity) * Number(form.unitPrice || 0);
  const draftGrandTotal =
    draftTotal -
    Number(form.lineDiscount || 0) +
    Number(form.lineTax || 0) -
    Number(form.invoiceDiscount || 0) +
    Number(form.invoiceTax || 0) +
    Number(form.shippingAmount || 0);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Invoices
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Create, manage and track customer invoices.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void fetchInvoices(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium dark:border-gray-700"
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>

          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <FilePlus2 size={17} />
            Create invoice
          </button>
        </div>
      </div>

      {notice && (
        <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-900/20 dark:text-green-300">
          <span className="flex items-center gap-2">
            <CheckCircle2 size={17} />
            {notice}
          </span>
          <button onClick={() => setNotice("")} aria-label="Dismiss">
            <X size={16} />
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
          <span className="flex items-center gap-2">
            <AlertCircle size={17} />
            {error}
          </span>
          <button onClick={() => setError("")} aria-label="Dismiss">
            <X size={16} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          title="Total invoices"
          value={total.toString()}
          description="Matching current filters"
          icon={FileText}
        />
        <StatCard
          title="Draft"
          value={stats.draft.toString()}
          description="Current page"
          icon={Clock}
        />
        <StatCard
          title="Issued"
          value={stats.issued.toString()}
          description="Current page"
          icon={CalendarDays}
        />
        <StatCard
          title="Paid"
          value={stats.paid.toString()}
          description="Current page"
          icon={CheckCircle2}
        />
        <StatCard
          title="Page value"
          value={money(stats.totalValue)}
          description="Current page only"
          icon={CircleDollarSign}
        />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-col gap-3 md:flex-row">
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
              placeholder="Search invoice number or customer..."
              className={`${inputClass} pl-10`}
            />
          </div>

          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as InvoiceStatus | "ALL");
              setPage(1);
            }}
            className={`${inputClass} md:w-52`}
          >
            {STATUSES.map((item) => (
              <option key={item} value={item}>
                {item === "ALL" ? "All statuses" : item}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-800">
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white">
              Invoice records
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              {total} matching invoices
            </p>
          </div>
          {refreshing && (
            <Loader2 className="animate-spin text-blue-600" size={18} />
          )}
        </div>

        {loading ? (
          <div className="flex min-h-64 items-center justify-center gap-3 text-gray-500">
            <Loader2 className="animate-spin" size={22} />
            Loading invoices...
          </div>
        ) : invoices.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center text-center">
            <FileText size={38} className="text-gray-300" />
            <p className="mt-3 font-semibold text-gray-700 dark:text-gray-200">
              No invoices found
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Try another search or create a new invoice.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-950 dark:text-gray-400">
                  <tr>
                    <th className="px-5 py-3">Invoice</th>
                    <th className="px-5 py-3">Customer</th>
                    <th className="px-5 py-3">Created</th>
                    <th className="px-5 py-3">Due date</th>
                    <th className="px-5 py-3">Amount</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {invoices.map((invoice) => (
                    <tr
                      key={invoice._id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/40"
                    >
                      <td className="px-5 py-4">
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {invoice.invoiceNumber}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {invoice._id}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-medium text-gray-800 dark:text-gray-200">
                          {invoice.customerName}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {invoice.customerEmail || "No email"}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-gray-600 dark:text-gray-300">
                        {date(invoice.createdAt)}
                      </td>
                      <td className="px-5 py-4 text-gray-600 dark:text-gray-300">
                        {date(invoice.dueAt)}
                      </td>
                      <td className="px-5 py-4 font-semibold text-gray-900 dark:text-white">
                        {money(invoice.totals.total, invoice.currency)}
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge status={invoice.status} />
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => void openDetails(invoice._id)}
                            className="rounded-lg p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                            title="View invoice"
                          >
                            <Eye size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col items-center justify-between gap-3 border-t border-gray-200 px-5 py-4 dark:border-gray-800 sm:flex-row">
              <p className="text-sm text-gray-500">
                Page {page} of {Math.max(totalPages, 1)}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => current - 1)}
                  className="rounded-lg border border-gray-300 p-2 disabled:opacity-40 dark:border-gray-700"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((current) => current + 1)}
                  className="rounded-lg border border-gray-300 p-2 disabled:opacity-40 dark:border-gray-700"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-3 py-8">
          <div className="my-auto w-full max-w-3xl rounded-2xl bg-white shadow-xl dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-200 p-5 dark:border-gray-800">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  Create invoice
                </h2>
                <p className="mt-1 text-xs text-gray-500">
                  A new invoice will be created in DRAFT status.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-5 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Customer ID *
                  <input
                    required
                    minLength={24}
                    maxLength={24}
                    value={form.customerId}
                    onChange={(e) =>
                      setForm({ ...form, customerId: e.target.value })
                    }
                    className={`${inputClass} mt-1`}
                    placeholder="MongoDB ObjectId"
                  />
                </label>

                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Customer name *
                  <input
                    required
                    maxLength={200}
                    value={form.customerName}
                    onChange={(e) =>
                      setForm({ ...form, customerName: e.target.value })
                    }
                    className={`${inputClass} mt-1`}
                  />
                </label>

                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Customer email
                  <input
                    type="email"
                    value={form.customerEmail}
                    onChange={(e) =>
                      setForm({ ...form, customerEmail: e.target.value })
                    }
                    className={`${inputClass} mt-1`}
                  />
                </label>

                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Currency *
                  <select
                    value={form.currency}
                    onChange={(e) =>
                      setForm({ ...form, currency: e.target.value })
                    }
                    className={`${inputClass} mt-1`}
                  >
                    <option value="BDT">BDT</option>
                    <option value="SAR">SAR</option>
                    <option value="USD">USD</option>
                    <option value="AED">AED</option>
                    <option value="EUR">EUR</option>
                  </select>
                </label>

                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 sm:col-span-2">
                  Order ID (optional)
                  <input
                    value={form.orderId}
                    onChange={(e) =>
                      setForm({ ...form, orderId: e.target.value })
                    }
                    className={`${inputClass} mt-1`}
                    placeholder="MongoDB ObjectId"
                  />
                </label>
              </div>

              <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                <h3 className="mb-4 font-semibold text-gray-900 dark:text-white">
                  Invoice line item
                </h3>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 sm:col-span-2">
                    Description *
                    <input
                      required
                      maxLength={500}
                      value={form.description}
                      onChange={(e) =>
                        setForm({ ...form, description: e.target.value })
                      }
                      className={`${inputClass} mt-1`}
                    />
                  </label>

                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Quantity *
                    <input
                      type="number"
                      required
                      min="0.001"
                      step="0.001"
                      value={form.quantity}
                      onChange={(e) =>
                        setForm({ ...form, quantity: e.target.value })
                      }
                      className={`${inputClass} mt-1`}
                    />
                  </label>

                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Unit price *
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      value={form.unitPrice}
                      onChange={(e) =>
                        setForm({ ...form, unitPrice: e.target.value })
                      }
                      className={`${inputClass} mt-1`}
                    />
                  </label>

                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Line discount
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.lineDiscount}
                      onChange={(e) =>
                        setForm({ ...form, lineDiscount: e.target.value })
                      }
                      className={`${inputClass} mt-1`}
                    />
                  </label>

                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Line tax
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.lineTax}
                      onChange={(e) =>
                        setForm({ ...form, lineTax: e.target.value })
                      }
                      className={`${inputClass} mt-1`}
                    />
                  </label>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Invoice discount
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.invoiceDiscount}
                    onChange={(e) =>
                      setForm({ ...form, invoiceDiscount: e.target.value })
                    }
                    className={`${inputClass} mt-1`}
                  />
                </label>

                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Invoice tax
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.invoiceTax}
                    onChange={(e) =>
                      setForm({ ...form, invoiceTax: e.target.value })
                    }
                    className={`${inputClass} mt-1`}
                  />
                </label>

                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Shipping
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.shippingAmount}
                    onChange={(e) =>
                      setForm({ ...form, shippingAmount: e.target.value })
                    }
                    className={`${inputClass} mt-1`}
                  />
                </label>

                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Due date
                  <input
                    type="date"
                    min={new Date().toISOString().slice(0, 10)}
                    value={form.dueAt}
                    onChange={(e) =>
                      setForm({ ...form, dueAt: e.target.value })
                    }
                    className={`${inputClass} mt-1`}
                  />
                </label>

                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 sm:col-span-2">
                  Notes
                  <textarea
                    rows={3}
                    maxLength={2000}
                    value={form.notes}
                    onChange={(e) =>
                      setForm({ ...form, notes: e.target.value })
                    }
                    className={`${inputClass} mt-1`}
                  />
                </label>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
                <span className="font-semibold text-gray-700 dark:text-gray-200">
                  Estimated total
                </span>
                <span className="text-xl font-bold text-gray-900 dark:text-white">
                  {money(draftGrandTotal, form.currency)}
                </span>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium dark:border-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    saving ||
                    !form.customerId.trim() ||
                    !form.customerName.trim() ||
                    !form.description.trim() ||
                    !form.unitPrice ||
                    draftGrandTotal < 0
                  }
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  Create draft
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detailsLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="flex items-center gap-3 rounded-xl bg-white p-5 dark:bg-gray-900">
            <Loader2 className="animate-spin" />
            Loading invoice...
          </div>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-3 py-8">
          <div className="my-auto w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-gray-900">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 p-4 dark:border-gray-800">
              <div>
                <h2 className="font-bold text-gray-900 dark:text-white">
                  {selected.invoiceNumber}
                </h2>
                <div className="mt-2">
                  <StatusBadge status={selected.status} />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => printInvoice(selected)}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700"
                >
                  <Printer size={16} />
                  Print / PDF
                </button>

                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <X size={19} />
                </button>
              </div>
            </div>

            <div className="max-h-[75vh] overflow-y-auto">
              <InvoiceDocument invoice={selected} />
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t border-gray-200 p-4 dark:border-gray-800">
              {selected.status === "DRAFT" && (
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => void changeStatus(selected, "ISSUED")}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  <CheckCircle2 size={16} />
                  Issue invoice
                </button>
              )}

              {(selected.status === "DRAFT" ||
                selected.status === "ISSUED") && (
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => void changeStatus(selected, "VOID")}
                  className="inline-flex items-center gap-2 rounded-lg border border-red-300 px-4 py-2.5 text-sm font-semibold text-red-600 disabled:opacity-50 dark:border-red-900"
                >
                  <XCircle size={16} />
                  Void invoice
                </button>
              )}

              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm dark:border-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
