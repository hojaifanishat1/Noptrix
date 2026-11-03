"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Building2,
  Search,
  Plus,
  RefreshCw,
  Eye,
  Pencil,
  X,
  ChevronLeft,
  ChevronRight,
  Users,
  CheckCircle2,
  Ban,
  AlertTriangle,
  Phone,
  Mail,
  MapPin,
} from "lucide-react";

import { suppliersAdminApi } from "@/services/api/suppliers-admin.api";
import type {
  Supplier,
  SupplierInput,
  SupplierStatus,
  SupplierSummary,
  SupplierUpdateInput,
} from "@/features/suppliers/supplier.types";

const PAGE_SIZE = 10;

const initialForm: SupplierInput = {
  name: "",
  phone: "",
  email: "",
  alternatePhone: "",
  website: "",
  taxId: "",
  registrationNumber: "",
  address: {
    street: "",
    city: "",
    state: "",
    postalCode: "",
    country: "Bangladesh",
  },
  contactPerson: {
    name: "",
    email: "",
    phone: "",
    designation: "",
  },
  paymentTermsDays: 0,
  creditLimit: 0,
  currency: "BDT",
  notes: "",
  tags: [],
};

const statusStyles: Record<SupplierStatus, string> = {
  ACTIVE:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  INACTIVE: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  SUSPENDED: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

function money(value?: number) {
  return `৳${Number(value || 0).toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getErrorMessage(error: unknown) {
  if (error && typeof error === "object" && "response" in error) {
    const response = (
      error as {
        response?: { data?: { message?: string } };
      }
    ).response;

    if (response?.data?.message) return response.data.message;
  }

  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

function StatusBadge({ status }: { status: SupplierStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles[status]}`}
    >
      {status}
    </span>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  type = "text",
  placeholder,
  disabled = false,
  min,
  max,
  step,
  minLength,
  maxLength,
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
  minLength?: number;
  maxLength?: number;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      <input
        type={type}
        required={required}
        disabled={disabled}
        min={min}
        max={max}
        step={step}
        minLength={minLength}
        maxLength={maxLength}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:focus:ring-blue-950"
      />
    </label>
  );
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [summary, setSummary] = useState<SupplierSummary>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [summaryError, setSummaryError] = useState("");
  const [notice, setNotice] = useState("");

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<SupplierStatus | "">("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [tags, setTags] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [modal, setModal] = useState<"create" | "edit" | "details" | null>(
    null,
  );
  const [selected, setSelected] = useState<Supplier | null>(null);
  const [form, setForm] = useState<SupplierInput>(initialForm);
  const [deactivateTarget, setDeactivateTarget] = useState<Supplier | null>(
    null,
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [listResult, summaryResult] = await Promise.allSettled([
        suppliersAdminApi.list({
          search: search.trim() || undefined,
          ...(status ? { status } : {}),
          city: city.trim() || undefined,
          country: country.trim() || undefined,
          tags: tags.trim() || undefined,
          page,
          limit: PAGE_SIZE,
          sortBy: "createdAt",
          sortOrder: "desc",
        }),
        suppliersAdminApi.summary(),
      ]);

      if (listResult.status === "fulfilled") {
        const nextTotalPages = Math.max(
          1,
          listResult.value.pagination.totalPages,
        );
        setSuppliers(listResult.value.items);
        setTotal(listResult.value.pagination.total);
        setTotalPages(nextTotalPages);
        setError("");
        if (page > nextTotalPages) setPage(nextTotalPages);
      } else {
        setSuppliers([]);
        setTotal(0);
        setTotalPages(1);
        if (page > 1) setPage(1);
        setError(
          `Could not load suppliers: ${getErrorMessage(listResult.reason)}`,
        );
      }

      if (summaryResult.status === "fulfilled") {
        setSummary(summaryResult.value);
        setSummaryError("");
      } else {
        setSummaryError(
          `Could not load supplier summary: ${getErrorMessage(summaryResult.reason)}`,
        );
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [search, status, city, country, tags, page]);

  useEffect(() => {
    void Promise.resolve().then(loadData);
  }, [loadData]);

  function updateForm<K extends keyof SupplierInput>(
    key: K,
    value: SupplierInput[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function openCreate() {
    setSelected(null);
    setForm({
      ...initialForm,
      address: { ...initialForm.address },
      contactPerson: { ...initialForm.contactPerson },
    });
    setModal("create");
    setError("");
    setNotice("");
  }

  function openEdit(supplier: Supplier) {
    setSelected(supplier);
    setForm({
      name: supplier.name,
      code: supplier.code,
      email: supplier.email ?? "",
      phone: supplier.phone,
      alternatePhone: supplier.alternatePhone ?? "",
      website: supplier.website ?? "",
      taxId: supplier.taxId ?? "",
      registrationNumber: supplier.registrationNumber ?? "",
      address: { ...supplier.address },
      contactPerson: { ...supplier.contactPerson },
      paymentTermsDays: supplier.paymentTermsDays ?? 0,
      creditLimit: supplier.creditLimit ?? 0,
      currency: "BDT",
      notes: supplier.notes ?? "",
      tags: supplier.tags ?? [],
    });
    setModal("edit");
    setError("");
  }

  async function saveSupplier(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const normalizedTags = Array.isArray(form.tags)
      ? form.tags
      : String(form.tags || "")
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean);
    if (
      Number.isInteger(form.paymentTermsDays) === false ||
      Number(form.paymentTermsDays) < 0 ||
      Number(form.paymentTermsDays) > 365 ||
      !Number.isFinite(Number(form.creditLimit)) ||
      Number(form.creditLimit) < 0 ||
      Number(form.creditLimit) > 1_000_000_000 ||
      normalizedTags.length > 30 ||
      normalizedTags.some((tag) => tag.length > 40)
    ) {
      setError(
        "Payment terms, credit limit, or tags are outside the allowed limits.",
      );
      return;
    }

    setSaving(true);

    const payload: Omit<SupplierInput, "code"> = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email?.trim() || undefined,
      alternatePhone: form.alternatePhone?.trim() || undefined,
      website: form.website?.trim() || undefined,
      taxId: form.taxId?.trim() || undefined,
      registrationNumber: form.registrationNumber?.trim() || undefined,
      address: {
        ...form.address,
        street: form.address.street?.trim() || undefined,
        city: form.address.city.trim(),
        state: form.address.state?.trim() || undefined,
        postalCode: form.address.postalCode?.trim() || undefined,
        country: form.address.country.trim(),
      },
      contactPerson: {
        name: form.contactPerson?.name?.trim() || undefined,
        email: form.contactPerson?.email?.trim() || undefined,
        phone: form.contactPerson?.phone?.trim() || undefined,
        designation: form.contactPerson?.designation?.trim() || undefined,
      },
      paymentTermsDays: Number(form.paymentTermsDays || 0),
      creditLimit: Number(form.creditLimit || 0),
      currency: "BDT",
      notes: form.notes?.trim() || undefined,
      tags: normalizedTags,
    };

    try {
      if (modal === "edit" && selected) {
        await suppliersAdminApi.update(
          selected._id,
          payload satisfies SupplierUpdateInput,
        );
        setNotice("Supplier updated successfully.");
      } else {
        await suppliersAdminApi.create({
          ...payload,
          ...(form.code?.trim() ? { code: form.code.trim() } : {}),
        });
        setNotice("Supplier created successfully.");
        setPage(1);
      }

      setModal(null);
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(supplier: Supplier, nextStatus: SupplierStatus) {
    const reason =
      nextStatus === "SUSPENDED"
        ? window.prompt("Enter suspension reason:")
        : undefined;
    const normalizedReason = reason?.trim();

    if (nextStatus === "SUSPENDED") {
      if (!normalizedReason) return;
      if (normalizedReason.length < 3) {
        setError("Suspension reason must contain at least 3 characters.");
        return;
      }
    }

    const confirmed = window.confirm(
      `Change ${supplier.name} status to ${nextStatus}?`,
    );

    if (!confirmed) return;

    try {
      setActionLoading(true);
      await suppliersAdminApi.updateStatus(
        supplier._id,
        nextStatus,
        normalizedReason,
      );
      setNotice(`Supplier status changed to ${nextStatus}.`);
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  }

  async function confirmDeactivate() {
    if (!deactivateTarget) return;

    try {
      setActionLoading(true);
      await suppliersAdminApi.deactivate(deactivateTarget._id);
      setDeactivateTarget(null);
      setNotice(
        "Supplier deactivated successfully. You can reactivate it later.",
      );
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  }

  async function openDetails(supplier: Supplier) {
    try {
      const result = await suppliersAdminApi.getById(supplier._id);
      setSelected(result);
      setModal("details");
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  function clearFilters() {
    setSearch("");
    setStatus("");
    setCity("");
    setCountry("");
    setTags("");
    setPage(1);
  }

  const hasFilters = Boolean(search || status || city || country || tags);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Suppliers
            </h1>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage supplier information, contacts and business relationships.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => void loadData()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Add Supplier
          </button>
        </div>
      </div>

      {notice && (
        <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
          {notice}
          <button onClick={() => setNotice("")} aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          <span>{error}</span>
          <button onClick={() => setError("")} aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Total Suppliers",
            value: summary.total ?? 0,
            icon: Users,
            color: "text-blue-600 bg-blue-50 dark:bg-blue-950",
          },
          {
            label: "Active",
            value: summary.active ?? 0,
            icon: CheckCircle2,
            color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950",
          },
          {
            label: "Inactive",
            value: summary.inactive ?? 0,
            icon: Ban,
            color: "text-gray-600 bg-gray-100 dark:bg-gray-800",
          },
          {
            label: "Suspended",
            value: summary.suspended ?? 0,
            icon: AlertTriangle,
            color: "text-red-600 bg-red-50 dark:bg-red-950",
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {item.label}
                </p>
                <span className={`rounded-lg p-2 ${item.color}`}>
                  <Icon className="h-5 w-5" />
                </span>
              </div>
              <p className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">
                {Number(item.value).toLocaleString()}
              </p>
            </div>
          );
        })}
      </div>

      {summaryError && (
        <p
          role="alert"
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
        >
          {summaryError}
        </p>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search name, code, email, phone..."
              className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
            />
          </div>

          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as SupplierStatus | "");
              setPage(1);
            }}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="SUSPENDED">Suspended</option>
          </select>

          <input
            value={city}
            onChange={(event) => {
              setCity(event.target.value);
              setPage(1);
            }}
            placeholder="Filter by city"
            className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
          />

          <input
            value={country}
            onChange={(event) => {
              setCountry(event.target.value);
              setPage(1);
            }}
            placeholder="Filter by country"
            className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
          />
        </div>

        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            value={tags}
            onChange={(event) => {
              setTags(event.target.value);
              setPage(1);
            }}
            placeholder="Filter by tag"
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white sm:max-w-xs"
          />
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Clear filters
            </button>
          )}
          <span className="text-sm text-gray-500 sm:ml-auto">
            {total} supplier{total === 1 ? "" : "s"} found
          </span>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              <tr>
                <th className="px-5 py-4">Supplier</th>
                <th className="px-5 py-4">Contact</th>
                <th className="px-5 py-4">Location</th>
                <th className="px-5 py-4">Credit Limit</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-14 text-center text-gray-500"
                  >
                    Loading suppliers...
                  </td>
                </tr>
              ) : suppliers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-14 text-center">
                    <Building2 className="mx-auto mb-3 h-9 w-9 text-gray-300" />
                    <p className="font-medium text-gray-700 dark:text-gray-200">
                      No suppliers found
                    </p>
                    <p className="mt-1 text-gray-500">
                      Add a supplier or change your filters.
                    </p>
                  </td>
                </tr>
              ) : (
                suppliers.map((supplier) => (
                  <tr
                    key={supplier._id}
                    className="hover:bg-gray-50/70 dark:hover:bg-gray-800/50"
                  >
                    <td className="px-5 py-4">
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {supplier.name}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {supplier.code}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                        <Phone className="h-3.5 w-3.5 text-gray-400" />
                        {supplier.phone}
                      </p>
                      {supplier.email && (
                        <p className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                          <Mail className="h-3.5 w-3.5" />
                          {supplier.email}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-4 text-gray-600 dark:text-gray-300">
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-gray-400" />
                        {supplier.address?.city}, {supplier.address?.country}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-medium text-gray-700 dark:text-gray-200">
                      {money(supplier.creditLimit)}
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={supplier.status} />
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          title="View details"
                          onClick={() => void openDetails(supplier)}
                          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-blue-600 dark:hover:bg-gray-800"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          title="Edit supplier"
                          onClick={() => openEdit(supplier)}
                          disabled={supplier.status === "SUSPENDED"}
                          aria-label={`Edit ${supplier.name}`}
                          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-gray-800"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <select
                          title="Change status"
                          value={supplier.status}
                          disabled={actionLoading}
                          onChange={(event) =>
                            void changeStatus(
                              supplier,
                              event.target.value as SupplierStatus,
                            )
                          }
                          className="max-w-28 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                        >
                          <option value="ACTIVE">Active</option>
                          <option value="INACTIVE">Inactive</option>
                          <option value="SUSPENDED">Suspended</option>
                        </select>
                        <button
                          title={
                            supplier.status === "INACTIVE"
                              ? "Supplier is already inactive"
                              : "Deactivate supplier"
                          }
                          aria-label={`Deactivate ${supplier.name}`}
                          disabled={
                            actionLoading || supplier.status === "INACTIVE"
                          }
                          onClick={() => setDeactivateTarget(supplier)}
                          className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-red-950"
                        >
                          <Ban className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800">
          <p className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1 || loading}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:opacity-40 dark:border-gray-700"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>
            <button
              disabled={page >= totalPages || loading}
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:opacity-40 dark:border-gray-700"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {(modal === "create" || modal === "edit") && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
          <div className="my-6 w-full max-w-4xl rounded-2xl bg-white shadow-xl dark:bg-gray-900">
            <div className="sticky top-0 flex items-center justify-between rounded-t-2xl border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-900">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  {modal === "create" ? "Add New Supplier" : "Edit Supplier"}
                </h2>
                <p className="text-sm text-gray-500">
                  Enter supplier and business contact information.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModal(null)}
                disabled={saving}
                className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={saveSupplier} className="space-y-6 p-6">
              <section className="space-y-3">
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  Basic Information
                </h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field
                    label="Supplier Name"
                    required
                    maxLength={150}
                    value={form.name}
                    onChange={(value) => updateForm("name", value)}
                  />
                  <Field
                    label="Supplier Code"
                    minLength={2}
                    maxLength={40}
                    value={form.code ?? ""}
                    onChange={(value) => updateForm("code", value)}
                    placeholder="Auto-generated if empty"
                    disabled={modal === "edit"}
                  />
                  <Field
                    label="Email"
                    type="email"
                    maxLength={254}
                    value={form.email ?? ""}
                    onChange={(value) => updateForm("email", value)}
                  />
                  <Field
                    label="Phone"
                    required
                    type="tel"
                    minLength={5}
                    maxLength={25}
                    value={form.phone}
                    onChange={(value) => updateForm("phone", value)}
                  />
                  <Field
                    label="Alternate Phone"
                    type="tel"
                    maxLength={25}
                    value={form.alternatePhone ?? ""}
                    onChange={(value) => updateForm("alternatePhone", value)}
                  />
                  <Field
                    label="Website"
                    type="url"
                    maxLength={2048}
                    value={form.website ?? ""}
                    onChange={(value) => updateForm("website", value)}
                  />
                  <Field
                    label="Tax ID"
                    maxLength={80}
                    value={form.taxId ?? ""}
                    onChange={(value) => updateForm("taxId", value)}
                  />
                  <Field
                    label="Registration Number"
                    maxLength={100}
                    value={form.registrationNumber ?? ""}
                    onChange={(value) =>
                      updateForm("registrationNumber", value)
                    }
                  />
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  Address
                </h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field
                    label="Street"
                    maxLength={200}
                    value={form.address.street ?? ""}
                    onChange={(value) =>
                      updateForm("address", { ...form.address, street: value })
                    }
                  />
                  <Field
                    label="City"
                    required
                    maxLength={100}
                    value={form.address.city}
                    onChange={(value) =>
                      updateForm("address", { ...form.address, city: value })
                    }
                  />
                  <Field
                    label="State"
                    maxLength={100}
                    value={form.address.state ?? ""}
                    onChange={(value) =>
                      updateForm("address", { ...form.address, state: value })
                    }
                  />
                  <Field
                    label="Postal Code"
                    maxLength={20}
                    value={form.address.postalCode ?? ""}
                    onChange={(value) =>
                      updateForm("address", {
                        ...form.address,
                        postalCode: value,
                      })
                    }
                  />
                  <Field
                    label="Country"
                    required
                    minLength={2}
                    maxLength={100}
                    value={form.address.country}
                    onChange={(value) =>
                      updateForm("address", {
                        ...form.address,
                        country: value,
                      })
                    }
                  />
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  Contact Person
                </h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field
                    label="Contact Name"
                    minLength={2}
                    maxLength={120}
                    value={form.contactPerson?.name ?? ""}
                    onChange={(value) =>
                      updateForm("contactPerson", {
                        ...form.contactPerson,
                        name: value,
                      })
                    }
                  />
                  <Field
                    label="Designation"
                    maxLength={100}
                    value={form.contactPerson?.designation ?? ""}
                    onChange={(value) =>
                      updateForm("contactPerson", {
                        ...form.contactPerson,
                        designation: value,
                      })
                    }
                  />
                  <Field
                    label="Contact Email"
                    type="email"
                    maxLength={254}
                    value={form.contactPerson?.email ?? ""}
                    onChange={(value) =>
                      updateForm("contactPerson", {
                        ...form.contactPerson,
                        email: value,
                      })
                    }
                  />
                  <Field
                    label="Contact Phone"
                    type="tel"
                    minLength={5}
                    maxLength={25}
                    value={form.contactPerson?.phone ?? ""}
                    onChange={(value) =>
                      updateForm("contactPerson", {
                        ...form.contactPerson,
                        phone: value,
                      })
                    }
                  />
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  Payment & Additional Information
                </h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field
                    label="Payment Terms (Days)"
                    type="number"
                    min={0}
                    max={365}
                    step={1}
                    value={form.paymentTermsDays ?? 0}
                    onChange={(value) =>
                      updateForm("paymentTermsDays", Number(value))
                    }
                  />
                  <Field
                    label="Credit Limit (BDT)"
                    type="number"
                    min={0}
                    max={1_000_000_000}
                    step={0.01}
                    value={form.creditLimit ?? 0}
                    onChange={(value) =>
                      updateForm("creditLimit", Number(value))
                    }
                  />
                  <Field
                    label="Tags (comma separated)"
                    value={(form.tags ?? []).join(", ")}
                    onChange={(value) =>
                      updateForm(
                        "tags",
                        value
                          .split(",")
                          .map((tag) => tag.trim())
                          .filter(Boolean),
                      )
                    }
                  />
                  <div>
                    <span className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Currency
                    </span>
                    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                      BDT (৳) — Fixed
                    </div>
                  </div>
                </div>
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Notes
                  </span>
                  <textarea
                    rows={3}
                    maxLength={2000}
                    value={form.notes ?? ""}
                    onChange={(event) =>
                      updateForm("notes", event.target.value)
                    }
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                  />
                </label>
              </section>

              {error && (
                <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  disabled={saving}
                  className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium dark:border-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving
                    ? "Saving..."
                    : modal === "create"
                      ? "Create Supplier"
                      : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal === "details" && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
          <div className="my-6 w-full max-w-2xl rounded-2xl bg-white shadow-xl dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-800">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  Supplier Details
                </h2>
                <p className="text-sm text-gray-500">{selected.code}</p>
              </div>
              <button
                onClick={() => setModal(null)}
                className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5 p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {selected.name}
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">{selected.slug}</p>
                </div>
                <StatusBadge status={selected.status} />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {[
                  ["Phone", selected.phone],
                  ["Alternate Phone", selected.alternatePhone || "—"],
                  ["Email", selected.email || "—"],
                  ["Website", selected.website || "—"],
                  ["Tax ID", selected.taxId || "—"],
                  ["Registration Number", selected.registrationNumber || "—"],
                  [
                    "Address",
                    [
                      selected.address?.street,
                      selected.address?.city,
                      selected.address?.state,
                      selected.address?.postalCode,
                      selected.address?.country,
                    ]
                      .filter(Boolean)
                      .join(", "),
                  ],
                  ["Contact Person", selected.contactPerson?.name || "—"],
                  [
                    "Contact Designation",
                    selected.contactPerson?.designation || "—",
                  ],
                  ["Contact Phone", selected.contactPerson?.phone || "—"],
                  ["Payment Terms", `${selected.paymentTermsDays ?? 0} days`],
                  ["Credit Limit", money(selected.creditLimit)],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800"
                  >
                    <p className="text-xs text-gray-500">{label}</p>
                    <p className="mt-1 break-words text-sm font-medium text-gray-900 dark:text-white">
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              {selected.tags?.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Tags
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selected.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selected.notes && (
                <div>
                  <p className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Notes
                  </p>
                  <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                    {selected.notes}
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-gray-200 px-6 py-4 dark:border-gray-800">
              <button
                onClick={() => setModal(null)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm dark:border-gray-700"
              >
                Close
              </button>
              <button
                onClick={() => openEdit(selected)}
                disabled={selected.status === "SUSPENDED"}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Pencil className="h-4 w-4" />
                Edit Supplier
              </button>
            </div>
          </div>
        </div>
      )}

      {deactivateTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950">
              <Ban className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Deactivate Supplier?
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              Are you sure you want to deactivate{" "}
              <strong className="text-gray-800 dark:text-gray-200">
                {deactivateTarget.name}
              </strong>
              ? Existing purchase records will be kept, and you can reactivate
              this supplier later.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setDeactivateTarget(null)}
                disabled={actionLoading}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm dark:border-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={() => void confirmDeactivate()}
                disabled={actionLoading}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {actionLoading ? "Deactivating..." : "Deactivate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
