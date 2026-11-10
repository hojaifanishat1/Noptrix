"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Plus, Pencil, Trash2, RefreshCw, Search } from "lucide-react";
import { deliveryAdminApi } from "@/services/api/delivery-admin.api";

type Kind = "areas" | "methods" | "overrides";
type FieldType = "text" | "number" | "textarea" | "select" | "checkbox";

interface FieldConfig {
  name: string;
  label: string;
  type?: FieldType;
  required?: boolean;
  options?: { label: string; value: string }[];
  placeholder?: string;
}

interface Config {
  title: string;
  description: string;
  fields: FieldConfig[];
  defaults: Record<string, unknown>;
  columns: string[];
  statusValues: ["ACTIVE", "INACTIVE"];
}

const configs: Record<Kind, Config> = {
  areas: {
    title: "Delivery Areas",
    description: "Manage serviceable areas inside your delivery zones.",
    defaults: {
      zoneId: "",
      name: "",
      slug: "",
      description: "",
      city: "",
      state: "",
      postalCodes: "",
      priority: 0,
      status: "ACTIVE",
    },
    fields: [
      { name: "zoneId", label: "Delivery Zone", type: "select", required: true },
      { name: "name", label: "Area Name", required: true },
      { name: "slug", label: "Slug", required: true },
      { name: "city", label: "City", required: true },
      { name: "state", label: "State" },
      { name: "postalCodes", label: "Postal Codes (comma separated)" },
      { name: "description", label: "Description", type: "textarea" },
      { name: "priority", label: "Priority", type: "number" },
    ],
    columns: ["name", "city", "zoneId", "postalCodes", "priority", "status"],
    statusValues: ["ACTIVE", "INACTIVE"],
  },

  methods: {
    title: "Delivery Methods",
    description: "Configure delivery options, time estimates and rider requirements.",
    defaults: {
      code: "",
      name: "",
      description: "",
      estimatedMinMinutes: 30,
      estimatedMaxMinutes: 60,
      maximumDistanceKm: "",
      requiresLiveRider: false,
      requiresAreaCoverage: true,
      priority: 0,
      status: "ACTIVE",
    },
    fields: [
      { name: "code", label: "Method Code", required: true },
      { name: "name", label: "Method Name", required: true },
      { name: "description", label: "Description", type: "textarea" },
      { name: "estimatedMinMinutes", label: "Minimum Minutes", type: "number", required: true },
      { name: "estimatedMaxMinutes", label: "Maximum Minutes", type: "number", required: true },
      { name: "maximumDistanceKm", label: "Maximum Distance (KM)", type: "number" },
      { name: "requiresLiveRider", label: "Requires Live Rider", type: "checkbox" },
      { name: "requiresAreaCoverage", label: "Requires Area Coverage", type: "checkbox" },
      { name: "priority", label: "Priority", type: "number" },
    ],
    columns: ["code", "name", "estimatedMinMinutes", "estimatedMaxMinutes", "requiresLiveRider", "status"],
    statusValues: ["ACTIVE", "INACTIVE"],
  },

  overrides: {
    title: "Area Fee Overrides",
    description: "Set custom delivery fees for specific areas and methods.",
    defaults: {
      areaId: "",
      methodId: "",
      fee: 0,
      freeDeliveryThreshold: "",
      minimumOrderAmount: 0,
      currency: "BDT",
      priority: 100,
      validFrom: "",
      validUntil: "",
      status: "ACTIVE",
    },
    fields: [
      { name: "areaId", label: "Delivery Area", type: "select", required: true },
      { name: "methodId", label: "Delivery Method (optional)", type: "select" },
      { name: "fee", label: "Fee", type: "number", required: true },
      { name: "freeDeliveryThreshold", label: "Free Delivery Threshold", type: "number" },
      { name: "minimumOrderAmount", label: "Minimum Order Amount", type: "number" },
      { name: "currency", label: "Currency (3 letters)", required: true },
      { name: "priority", label: "Priority", type: "number" },
      { name: "validFrom", label: "Valid From", type: "text", placeholder: "YYYY-MM-DD" },
      { name: "validUntil", label: "Valid Until", type: "text", placeholder: "YYYY-MM-DD" },
    ],
    columns: ["areaId", "methodId", "fee", "currency", "priority", "status"],
    statusValues: ["ACTIVE", "INACTIVE"],
  },
};

function getId(item: Record<string, unknown>) {
  return String(item._id ?? item.id ?? "");
}

function relationId(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const relation = value as Record<string, unknown>;
    return String(relation._id ?? relation.id ?? "");
  }
  return "";
}

function showValue(value: unknown): string {
  if (value === undefined || value === null || value === "") return "—";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") {
    const object = value as Record<string, unknown>;
    return String(object.name ?? object._id ?? "—");
  }
  return String(value);
}

function errorMessage(error: unknown) {
  const value = error as {
    response?: { data?: { message?: string } };
    message?: string;
  };
  return value.response?.data?.message ?? value.message ?? "Something went wrong.";
}

export default function DeliveryConfigWorkspace({ kind }: { kind: Kind }) {
  const config = configs[kind];

  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [zoneOptions, setZoneOptions] = useState<Record<string, unknown>[]>([]);
  const [areaOptions, setAreaOptions] = useState<Record<string, unknown>[]>([]);
  const [methodOptions, setMethodOptions] = useState<Record<string, unknown>[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [form, setForm] = useState<Record<string, unknown>>({ ...config.defaults });
  const [editingId, setEditingId] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = {
        page: 1,
        limit: 100,
        search: search.trim() || undefined,
        status: status || undefined,
        sort: "priority",
      };

      const result =
        kind === "areas"
          ? await deliveryAdminApi.areas.list(params)
          : kind === "methods"
            ? await deliveryAdminApi.methods.list(params)
            : await deliveryAdminApi.areaFeeOverrides.list(params);

      setItems(result.items as unknown as Record<string, unknown>[]);
    } catch (err) {
      setError(errorMessage(err));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [kind, search, status]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;

    async function loadOptions() {
      setOptionsLoading(true);

      try {
        if (kind === "areas") {
          const result = await deliveryAdminApi.zones.list({
            page: 1,
            limit: 100,
            sort: "priority",
          });

          if (!cancelled) {
            setZoneOptions(result.items as unknown as Record<string, unknown>[]);
          }
        } else if (kind === "overrides") {
          const [areasResult, methodsResult] = await Promise.all([
            deliveryAdminApi.areas.list({ page: 1, limit: 100, sort: "priority" }),
            deliveryAdminApi.methods.list({ page: 1, limit: 100, sort: "priority" }),
          ]);

          if (!cancelled) {
            setAreaOptions(areasResult.items as unknown as Record<string, unknown>[]);
            setMethodOptions(methodsResult.items as unknown as Record<string, unknown>[]);
          }
        }
      } catch (err) {
        if (!cancelled) setError(errorMessage(err));
      } finally {
        if (!cancelled) setOptionsLoading(false);
      }
    }

    void loadOptions();

    return () => {
      cancelled = true;
    };
  }, [kind]);

  function openCreate() {
    setEditingId("");
    setForm({ ...config.defaults });
    setShowForm(true);
    setError("");
    setSuccess("");
  }

  function openEdit(item: Record<string, unknown>) {
    const next = { ...config.defaults };

    for (const field of config.fields) {
      const value = item[field.name];
      if (value !== undefined && value !== null) {
        next[field.name] = value;
      }
    }

    if (kind === "areas") {
      next.zoneId = relationId(item.zoneId);
      next.postalCodes = Array.isArray(item.postalCodes)
        ? item.postalCodes.join(", ")
        : "";
    }

    if (kind === "overrides") {
      next.areaId = relationId(item.areaId);
      next.methodId = item.methodId ? relationId(item.methodId) : "";
      next.validFrom = item.validFrom
        ? String(item.validFrom).slice(0, 10)
        : "";
      next.validUntil = item.validUntil
        ? String(item.validUntil).slice(0, 10)
        : "";
    }

    setEditingId(getId(item));
    setForm(next);
    setShowForm(true);
    setError("");
    setSuccess("");
  }

  function setField(name: string, value: unknown) {
    setForm((previous) => ({ ...previous, [name]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const payload: Record<string, unknown> = { ...form };

    if (kind === "areas") {
      payload.name = String(payload.name ?? "").trim();
      payload.slug = String(payload.slug ?? "").trim();
      payload.city = String(payload.city ?? "").trim();
      payload.zoneId = String(payload.zoneId ?? "").trim();
      payload.postalCodes = String(payload.postalCodes ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      payload.priority = Number(payload.priority ?? 0);
      delete payload.status;
    }

    if (kind === "methods") {
      payload.code = String(payload.code ?? "").trim();
      payload.name = String(payload.name ?? "").trim();
      payload.estimatedMinMinutes = Number(payload.estimatedMinMinutes);
      payload.estimatedMaxMinutes = Number(payload.estimatedMaxMinutes);
      payload.priority = Number(payload.priority ?? 0);

      if (payload.maximumDistanceKm === "") {
        delete payload.maximumDistanceKm;
      } else if (payload.maximumDistanceKm !== undefined) {
        payload.maximumDistanceKm = Number(payload.maximumDistanceKm);
      }
    }

    if (kind === "overrides") {
      payload.areaId = String(payload.areaId ?? "").trim();
      payload.methodId = String(payload.methodId ?? "").trim() || undefined;
      payload.fee = Number(payload.fee);
      payload.minimumOrderAmount = Number(payload.minimumOrderAmount ?? 0);
      payload.priority = Number(payload.priority ?? 100);
      payload.currency = String(payload.currency ?? "BDT").toUpperCase();

      for (const key of ["freeDeliveryThreshold", "validFrom", "validUntil"]) {
        if (payload[key] === "") delete payload[key];
      }

      if (payload.freeDeliveryThreshold !== undefined) {
        payload.freeDeliveryThreshold = Number(payload.freeDeliveryThreshold);
      }
    }

    setSaving(true);

    try {
      if (kind === "areas") {
        if (editingId) {
          await deliveryAdminApi.areas.update(editingId, payload);
        } else {
          await deliveryAdminApi.areas.create(payload);
        }
      } else if (kind === "methods") {
        if (editingId) {
          await deliveryAdminApi.methods.update(editingId, payload);
        } else {
          await deliveryAdminApi.methods.create(payload);
        }
      } else {
        if (editingId) {
          await deliveryAdminApi.areaFeeOverrides.update(editingId, payload);
        } else {
          await deliveryAdminApi.areaFeeOverrides.create(payload);
        }
      }

      setSuccess(editingId ? "Record updated successfully." : "Record created successfully.");
      setShowForm(false);
      setEditingId("");
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(item: Record<string, unknown>) {
    const id = getId(item);
    const next = item.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";

    try {
      if (kind === "areas") {
        await deliveryAdminApi.areas.setStatus(id, next);
      } else if (kind === "methods") {
        await deliveryAdminApi.methods.setStatus(id, next);
      } else {
        await deliveryAdminApi.areaFeeOverrides.setStatus(id, next);
      }
      setSuccess("Status updated.");
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function remove(item: Record<string, unknown>) {
    const id = getId(item);
    if (!window.confirm("Permanently delete this record?")) return;

    try {
      if (kind === "areas") {
        await deliveryAdminApi.areas.remove(id);
      } else if (kind === "methods") {
        await deliveryAdminApi.methods.remove(id);
      } else {
        await deliveryAdminApi.areaFeeOverrides.remove(id);
      }

      setSuccess("Record deleted.");
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const inputClass =
    "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-950 dark:text-white";

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {config.title}
          </h1>
          <p className="mt-1 text-sm text-gray-500">{config.description}</p>
        </div>

        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Add New
        </button>
      </header>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}

      {success && (
        <div role="status" className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300">
          {success}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search..."
            className={`${inputClass} pl-9`}
          />
        </div>

        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className={`${inputClass} max-w-[180px]`}
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>

        <button
          onClick={() => void load()}
          className="rounded-lg border border-gray-300 px-3 py-2 text-gray-700 dark:border-gray-700 dark:text-gray-200"
          title="Refresh"
        >
          <RefreshCw className="h-5 w-5" />
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={submit}
          className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {editingId ? "Edit Record" : "Create Record"}
            </h2>
            <button type="button" onClick={() => setShowForm(false)} className="text-sm text-gray-500">
              Close
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {config.fields.map((field) => (
              <label key={field.name} className="space-y-1.5 text-sm">
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {field.label}{field.required ? " *" : ""}
                </span>

                {field.type === "select" ? (
                  <select
                    required={field.required}
                    value={String(form[field.name] ?? "")}
                    onChange={(event) => setField(field.name, event.target.value)}
                    className={inputClass}
                    disabled={optionsLoading}
                  >
                    <option value="">
                      {optionsLoading ? "Loading options..." : "Select an option"}
                    </option>
                    {(field.name === "zoneId"
                      ? zoneOptions
                      : field.name === "areaId"
                        ? areaOptions
                        : field.name === "methodId"
                          ? methodOptions
                          : []
                    ).map((option) => {
                      const id = getId(option);
                      const label =
                        field.name === "methodId"
                          ? `${showValue(option.name)} (${showValue(option.code)})`
                          : `${showValue(option.name)} — ${showValue(option.city)}`;

                      return (
                        <option key={id} value={id}>
                          {label}
                          {option.status && !["ACTIVE", "active"].includes(String(option.status))
                            ? " (Inactive)"
                            : ""}
                        </option>
                      );
                    })}
                  </select>
                ) : field.type === "checkbox" ? (
                  <span className="flex items-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      checked={Boolean(form[field.name])}
                      onChange={(event) => setField(field.name, event.target.checked)}
                    />
                    Enabled
                  </span>
                ) : field.type === "textarea" ? (
                  <textarea
                    value={String(form[field.name] ?? "")}
                    onChange={(event) => setField(field.name, event.target.value)}
                    className={inputClass}
                    rows={3}
                  />
                ) : (
                  <input
                    type={field.type === "number" ? "number" : "text"}
                    required={field.required}
                    min={field.type === "number" ? 0 : undefined}
                    step={field.type === "number" ? "any" : undefined}
                    value={String(form[field.name] ?? "")}
                    placeholder={field.placeholder}
                    onChange={(event) => setField(field.name, field.type === "number" ? event.target.value : event.target.value)}
                    className={inputClass}
                  />
                )}
              </label>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              disabled={saving}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? "Saving..." : editingId ? "Update" : "Create"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm dark:border-gray-700"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
        <table className="w-full min-w-[850px] text-left text-sm">
          <thead className="bg-gray-50 dark:bg-gray-950">
            <tr>
              {config.columns.map((column) => (
                <th key={column} className="px-4 py-3 font-semibold capitalize text-gray-600 dark:text-gray-300">
                  {column.replace(/([A-Z])/g, " $1")}
                </th>
              ))}
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr><td colSpan={config.columns.length + 1} className="px-4 py-10 text-center text-gray-500">Loading...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={config.columns.length + 1} className="px-4 py-10 text-center text-gray-500">No records found.</td></tr>
            ) : items.map((item) => (
              <tr key={getId(item)} className="border-t border-gray-200 dark:border-gray-800">
                {config.columns.map((column) => (
                  <td key={column} className="max-w-[240px] truncate px-4 py-3 text-gray-700 dark:text-gray-300">
                    {column === "status" ? (
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        item.status === "ACTIVE"
                          ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                          : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                      }`}>
                        {showValue(item[column])}
                      </span>
                    ) : showValue(item[column])}
                  </td>
                ))}

                <td className="px-4 py-3">
                  <div className="flex justify-end gap-3">
                    <button onClick={() => openEdit(item)} title="Edit" className="text-blue-600">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => void changeStatus(item)} title="Change status" className="text-amber-600">
                      {item.status === "ACTIVE" ? "Disable" : "Enable"}
                    </button>
                    <button onClick={() => void remove(item)} title="Delete" className="text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
