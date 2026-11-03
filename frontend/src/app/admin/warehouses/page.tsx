"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  Edit,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Star,
  Warehouse as WarehouseIcon,
  X,
} from "lucide-react";

import { warehouseAdminApi } from "@/services/api/warehouse-admin.api";
import type {
  Warehouse,
  WarehouseInput,
  WarehouseStatus,
} from "@/features/warehouses/warehouse.types";

const initialForm: WarehouseInput = {
  name: "",
  code: "",
  description: "",
  address: "",
  city: "",
  state: "",
  postalCode: "",
  country: "",
  contactName: "",
  contactPhone: "",
  contactEmail: "",
  status: "ACTIVE",
  isDefault: false,
};

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-gray-700 dark:bg-gray-900 dark:text-white";

const labelClass =
  "mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300";

function getErrorMessage(error: unknown): string {
  const value = error as {
    response?: { data?: { message?: string } };
    message?: string;
  };

  return (
    value?.response?.data?.message ||
    value?.message ||
    "Something went wrong. Please try again."
  );
}

function formatDate(value?: string): string {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export default function AdminWarehousesPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [sortBy, setSortBy] = useState<
    "name" | "code" | "createdAt" | "updatedAt"
  >("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const [page, setPage] = useState(1);
  const limit = 20;
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(
    null,
  );
  const [form, setForm] = useState<WarehouseInput>(initialForm);

  const loadWarehouses = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await warehouseAdminApi.list({
        page,
        limit,
        search: search.trim() || undefined,
        status: (status || undefined) as WarehouseStatus | undefined,
        city: city.trim() || undefined,
        country: country.trim() || undefined,
        sortBy,
        sortOrder,
      });

      setWarehouses(result.items);
      setTotal(result.pagination.total);
      setTotalPages(result.pagination.totalPages);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, search, status, city, country, sortBy, sortOrder]);

  useEffect(() => {
    void loadWarehouses();
  }, [loadWarehouses]);

  const openCreateModal = () => {
    setEditingWarehouse(null);
    setForm({ ...initialForm });
    setError("");
    setModalOpen(true);
  };

  const openEditModal = (warehouse: Warehouse) => {
    setEditingWarehouse(warehouse);

    setForm({
      name: warehouse.name,
      code: warehouse.code,
      description: warehouse.description ?? "",
      address: warehouse.address ?? "",
      city: warehouse.city ?? "",
      state: warehouse.state ?? "",
      postalCode: warehouse.postalCode ?? "",
      country: warehouse.country ?? "",
      contactName: warehouse.contactName ?? "",
      contactPhone: warehouse.contactPhone ?? "",
      contactEmail: warehouse.contactEmail ?? "",
      status: warehouse.status,
      isDefault: warehouse.isDefault,
    });

    setError("");
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditingWarehouse(null);
  };

  const updateField = <K extends keyof WarehouseInput>(
    key: K,
    value: WarehouseInput[K],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (form.name.trim().length < 2) {
      setError("Warehouse name must contain at least 2 characters.");
      return;
    }

    if (
      !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(form.code.trim()) ||
      form.code.trim().length < 2 ||
      form.code.trim().length > 32
    ) {
      setError(
        "Code must be 2–32 characters and use letters, numbers, _ or -.",
      );
      return;
    }

    if (form.contactPhone && form.contactPhone.trim().length < 5) {
      setError("Contact phone must contain at least 5 characters.");
      return;
    }

    if (
      form.contactEmail &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail.trim())
    ) {
      setError("Please enter a valid contact email.");
      return;
    }

    if (form.isDefault && form.status !== "ACTIVE") {
      setError("An inactive warehouse cannot be the default warehouse.");
      return;
    }

    const cleanInput: WarehouseInput = {
      ...form,
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      description: form.description?.trim() || undefined,
      address: form.address?.trim() || undefined,
      city: form.city?.trim() || undefined,
      state: form.state?.trim() || undefined,
      postalCode: form.postalCode?.trim() || undefined,
      country: form.country?.trim() || undefined,
      contactName: form.contactName?.trim() || undefined,
      contactPhone: form.contactPhone?.trim() || undefined,
      contactEmail: form.contactEmail?.trim().toLowerCase() || undefined,
    };

    setSaving(true);

    try {
      if (editingWarehouse) {
        await warehouseAdminApi.update(editingWarehouse._id, cleanInput);
        setSuccess("Warehouse updated successfully.");
      } else {
        await warehouseAdminApi.create(cleanInput);
        setSuccess("Warehouse created successfully.");
      }

      setModalOpen(false);
      setEditingWarehouse(null);
      await loadWarehouses();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleStatusAction = async (
    warehouse: Warehouse,
    action: "activate" | "deactivate",
  ) => {
    const message =
      action === "deactivate"
        ? `Deactivate "${warehouse.name}"? It will not be permanently deleted.`
        : `Activate "${warehouse.name}"?`;

    if (!window.confirm(message)) return;

    setActionId(warehouse._id);
    setError("");
    setSuccess("");

    try {
      if (action === "activate") {
        await warehouseAdminApi.activate(warehouse._id);
        setSuccess("Warehouse activated successfully.");
      } else {
        await warehouseAdminApi.deactivate(warehouse._id);
        setSuccess("Warehouse deactivated successfully.");
      }

      await loadWarehouses();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionId(null);
    }
  };

  const activeCount = warehouses.filter(
    (item) => item.status === "ACTIVE",
  ).length;

  const defaultWarehouse = warehouses.find((item) => item.isDefault);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <WarehouseIcon className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Warehouse Management
            </h1>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage warehouse locations, contacts and default stock locations.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void loadWarehouses()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Add Warehouse
          </button>
        </div>
      </div>

      {error && !modalOpen && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300">
          <Check className="h-4 w-4" />
          {success}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Filtered warehouses
          </p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
            {total}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Active on this page
          </p>
          <p className="mt-1 text-2xl font-bold text-green-600">
            {activeCount}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Default warehouse
          </p>
          <p className="mt-1 truncate text-lg font-semibold text-gray-900 dark:text-white">
            {defaultWarehouse?.name ?? "Not on this page"}
          </p>
        </div>
      </div>

      <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search name, code, city, email..."
              className={`${inputClass} pl-9`}
            />
          </div>

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

          <input
            value={city}
            onChange={(event) => {
              setCity(event.target.value);
              setPage(1);
            }}
            placeholder="Filter by city"
            className={inputClass}
          />

          <input
            value={country}
            onChange={(event) => {
              setCountry(event.target.value);
              setPage(1);
            }}
            placeholder="Filter by country"
            className={inputClass}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-gray-500 dark:text-gray-400">
            Sort by
          </label>

          <select
            value={sortBy}
            onChange={(event) => {
              setSortBy(event.target.value as typeof sortBy);
              setPage(1);
            }}
            className={`${inputClass} w-auto min-w-36`}
          >
            <option value="name">Name</option>
            <option value="code">Code</option>
            <option value="createdAt">Created date</option>
            <option value="updatedAt">Updated date</option>
          </select>

          <select
            value={sortOrder}
            onChange={(event) => {
              setSortOrder(event.target.value as typeof sortOrder);
              setPage(1);
            }}
            className={`${inputClass} w-auto`}
          >
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>

          <button
            type="button"
            onClick={() => {
              setSearch("");
              setStatus("");
              setCity("");
              setCountry("");
              setSortBy("name");
              setSortOrder("asc");
              setPage(1);
            }}
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            Clear filters
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
          <h2 className="font-semibold text-gray-900 dark:text-white">
            Warehouses
          </h2>
          <span className="text-sm text-gray-500">{total} total</span>
        </div>

        {loading ? (
          <div className="flex min-h-56 items-center justify-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading warehouses...
          </div>
        ) : warehouses.length === 0 ? (
          <div className="flex min-h-56 flex-col items-center justify-center px-4 text-center">
            <WarehouseIcon className="h-10 w-10 text-gray-300" />
            <p className="mt-3 font-medium text-gray-700 dark:text-gray-200">
              No warehouses found
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Create a warehouse or change your filters.
            </p>
            <button
              type="button"
              onClick={openCreateModal}
              className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Add first warehouse
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800/70 dark:text-gray-400">
                  <tr>
                    <th className="px-4 py-3">Warehouse</th>
                    <th className="px-4 py-3">Location</th>
                    <th className="px-4 py-3">Contact</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {warehouses.map((warehouse) => (
                    <tr
                      key={warehouse._id}
                      className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40"
                    >
                      <td className="px-4 py-4">
                        <div className="flex items-start gap-2">
                          <div className="rounded-lg bg-blue-50 p-2 text-blue-600 dark:bg-blue-950/40">
                            <WarehouseIcon className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2 font-semibold text-gray-900 dark:text-white">
                              {warehouse.name}
                              {warehouse.isDefault && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                  <Star className="h-3 w-3 fill-current" />
                                  Default
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-xs text-gray-500">
                              {warehouse.code}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4 text-gray-600 dark:text-gray-300">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                          {[warehouse.city, warehouse.state, warehouse.country]
                            .filter(Boolean)
                            .join(", ") || "—"}
                        </div>
                        {warehouse.address && (
                          <p className="mt-1 max-w-52 truncate text-xs text-gray-400">
                            {warehouse.address}
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-4 text-gray-600 dark:text-gray-300">
                        <p>{warehouse.contactName || "—"}</p>
                        <p className="mt-1 text-xs text-gray-500">
                          {warehouse.contactPhone ||
                            warehouse.contactEmail ||
                            "—"}
                        </p>
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            warehouse.status === "ACTIVE"
                              ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                              : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                          }`}
                        >
                          {warehouse.status}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-gray-500">
                        {formatDate(warehouse.createdAt)}
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            title="Edit warehouse"
                            onClick={() => openEditModal(warehouse)}
                            className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                          >
                            <Edit className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            disabled={actionId === warehouse._id}
                            onClick={() =>
                              void handleStatusAction(
                                warehouse,
                                warehouse.status === "ACTIVE"
                                  ? "deactivate"
                                  : "activate",
                              )
                            }
                            className={`rounded-lg border p-2 disabled:opacity-50 ${
                              warehouse.status === "ACTIVE"
                                ? "border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30"
                                : "border-green-200 text-green-600 hover:bg-green-50 dark:border-green-900 dark:hover:bg-green-950/30"
                            }`}
                            title={
                              warehouse.status === "ACTIVE"
                                ? "Deactivate warehouse"
                                : "Activate warehouse"
                            }
                          >
                            {actionId === warehouse._id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : warehouse.status === "ACTIVE" ? (
                              <X className="h-4 w-4" />
                            ) : (
                              <Check className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t border-gray-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800">
              <p className="text-sm text-gray-500">
                Page {page} of {Math.max(totalPages, 1)} · {total} warehouses
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  className="rounded-lg border border-gray-300 p-2 text-gray-600 disabled:opacity-40 dark:border-gray-700 dark:text-gray-300"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((value) => value + 1)}
                  className="rounded-lg border border-gray-300 p-2 text-gray-600 disabled:opacity-40 dark:border-gray-700 dark:text-gray-300"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-3 sm:p-6">
          <div className="my-auto w-full max-w-3xl rounded-2xl bg-white shadow-2xl dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-800">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  {editingWarehouse ? "Edit Warehouse" : "Create Warehouse"}
                </h2>
                <p className="mt-1 text-xs text-gray-500">
                  Enter warehouse details and contact information.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="max-h-[70vh] space-y-5 overflow-y-auto p-5">
                {error && (
                  <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    {error}
                  </div>
                )}

                <div>
                  <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
                    Basic information
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className={labelClass}>Warehouse name *</label>
                      <input
                        required
                        minLength={2}
                        maxLength={120}
                        value={form.name}
                        onChange={(event) =>
                          updateField("name", event.target.value)
                        }
                        className={inputClass}
                        placeholder="Main warehouse"
                      />
                    </div>

                    <div>
                      <label className={labelClass}>Warehouse code *</label>
                      <input
                        required
                        minLength={2}
                        maxLength={32}
                        value={form.code}
                        onChange={(event) =>
                          updateField("code", event.target.value.toUpperCase())
                        }
                        className={inputClass}
                        placeholder="WH-MAIN"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className={labelClass}>Description</label>
                      <textarea
                        rows={3}
                        maxLength={1000}
                        value={form.description}
                        onChange={(event) =>
                          updateField("description", event.target.value)
                        }
                        className={inputClass}
                        placeholder="Warehouse description..."
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-4 dark:border-gray-800">
                  <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
                    Location
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className={labelClass}>Address</label>
                      <input
                        maxLength={300}
                        value={form.address}
                        onChange={(event) =>
                          updateField("address", event.target.value)
                        }
                        className={inputClass}
                        placeholder="Street address"
                      />
                    </div>

                    <div>
                      <label className={labelClass}>City</label>
                      <input
                        maxLength={100}
                        value={form.city}
                        onChange={(event) =>
                          updateField("city", event.target.value)
                        }
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className={labelClass}>State / Province</label>
                      <input
                        maxLength={100}
                        value={form.state}
                        onChange={(event) =>
                          updateField("state", event.target.value)
                        }
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className={labelClass}>Postal code</label>
                      <input
                        maxLength={20}
                        value={form.postalCode}
                        onChange={(event) =>
                          updateField("postalCode", event.target.value)
                        }
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className={labelClass}>Country</label>
                      <input
                        maxLength={100}
                        value={form.country}
                        onChange={(event) =>
                          updateField("country", event.target.value)
                        }
                        className={inputClass}
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-4 dark:border-gray-800">
                  <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
                    Contact information
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className={labelClass}>Contact name</label>
                      <input
                        maxLength={120}
                        value={form.contactName}
                        onChange={(event) =>
                          updateField("contactName", event.target.value)
                        }
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className={labelClass}>Contact phone</label>
                      <input
                        type="tel"
                        minLength={5}
                        maxLength={32}
                        value={form.contactPhone}
                        onChange={(event) =>
                          updateField("contactPhone", event.target.value)
                        }
                        className={inputClass}
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className={labelClass}>Contact email</label>
                      <input
                        type="email"
                        maxLength={254}
                        value={form.contactEmail}
                        onChange={(event) =>
                          updateField("contactEmail", event.target.value)
                        }
                        className={inputClass}
                        placeholder="warehouse@example.com"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-4 dark:border-gray-800">
                  <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
                    Settings
                  </h3>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className={labelClass}>Status</label>
                      <select
                        value={form.status}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            status: event.target.value as WarehouseStatus,
                            isDefault:
                              event.target.value === "INACTIVE"
                                ? false
                                : current.isDefault,
                          }))
                        }
                        className={inputClass}
                      >
                        <option value="ACTIVE">Active</option>
                        <option value="INACTIVE">Inactive</option>
                      </select>
                    </div>

                    <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                      <input
                        type="checkbox"
                        checked={form.isDefault}
                        disabled={form.status !== "ACTIVE"}
                        onChange={(event) =>
                          updateField("isDefault", event.target.checked)
                        }
                        className="h-4 w-4 rounded border-gray-300 text-blue-600"
                      />
                      <span>
                        <span className="block text-sm font-medium text-gray-900 dark:text-white">
                          Default warehouse
                        </span>
                        <span className="block text-xs text-gray-500">
                          Use this as the default warehouse.
                        </span>
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-gray-200 px-5 py-4 sm:flex-row sm:justify-end dark:border-gray-800">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {saving
                    ? "Saving..."
                    : editingWarehouse
                      ? "Save changes"
                      : "Create warehouse"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
