
"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

import { deliveryAdminApi, type DeliveryMethodRecord } from "@/services/api/delivery-admin.api";

import type {
  DeliveryFeeRule,
  DeliveryFeeMethod,
} from "@/features/delivery-fees/delivery-fee.types";

import type { DeliveryZone } from "@/features/delivery-zones/delivery-zone.types";

const emptyForm = {
  name: "",
  slug: "",
  description: "",
  deliveryZoneId: "",
  deliveryMethodId: "",
  method: "flat" as DeliveryFeeMethod,
  baseFee: 0,
  perKgFee: 0,
  freeDeliveryThreshold: "",
  minimumOrderAmount: 0,
  minimumWeightKg: 0,
  maximumWeightKg: "",
  supportsCOD: true,
  priority: 0,
  status: "active" as "active" | "inactive",
};

type FeeForm = typeof emptyForm;

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white";

function getMethodId(
  value: DeliveryFeeRule["deliveryMethodId"],
): string {
  if (!value) return "";
  return typeof value === "string" ? value : value._id;
}

export default function DeliveryFeesWorkspace() {
  const [items, setItems] = useState<DeliveryFeeRule[]>([]);
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [methods, setMethods] = useState<DeliveryMethodRecord[]>([]);

  const [form, setForm] = useState<FeeForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);

  const loadZones = useCallback(async () => {
    const result = await deliveryAdminApi.zones.list({
      page: 1,
      limit: 100,
      status: "active",
      sort: "priority",
    });

    setZones(
      result.items.filter((zone) => zone.status === "active"),
    );
  }, []);

  const loadMethods = useCallback(async () => {
    const result = await deliveryAdminApi.methods.list({
      page: 1,
      limit: 100,
      status: "ACTIVE",
      sort: "priority",
    });

    setMethods(
      result.items.filter((method) => method.status === "ACTIVE"),
    );
  }, []);

  const loadFees = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await deliveryAdminApi.fees.list({
        page: 1,
        limit: 100,
        search: search || undefined,
        sort: "priority",
      });

      setItems(result.items);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load fee rules.",
      );
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    void Promise.all([
      loadZones(),
      loadMethods(),
      loadFees(),
    ]).catch((err: unknown) => {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load delivery data.",
      );
    });
  }, [loadZones, loadMethods, loadFees]);

  function update<K extends keyof FeeForm>(
    key: K,
    value: FeeForm[K],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function applyZone(zoneId: string) {
    update("deliveryZoneId", zoneId);
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setSuccess("");
    setShowForm(true);
  }

  function openEdit(fee: DeliveryFeeRule) {
    setEditingId(fee._id);

    setForm({
      name: fee.name,
      slug: fee.slug,
      description: fee.description ?? "",
      deliveryZoneId: fee.deliveryZoneId ?? "",
      deliveryMethodId: getMethodId(fee.deliveryMethodId),
      method: fee.method,
      baseFee: fee.baseFee,
      perKgFee: fee.perKgFee,
      freeDeliveryThreshold:
        fee.freeDeliveryThreshold === undefined
          ? ""
          : String(fee.freeDeliveryThreshold),
      minimumOrderAmount: fee.minimumOrderAmount,
      minimumWeightKg: fee.minimumWeightKg,
      maximumWeightKg:
        fee.maximumWeightKg === undefined
          ? ""
          : String(fee.maximumWeightKg),
      supportsCOD: fee.supportsCOD,
      priority: fee.priority,
      status: fee.status,
    });

    setError("");
    setSuccess("");
    setShowForm(true);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!form.deliveryZoneId) {
      setError("Select a delivery zone before saving this fee rule.");
      return;
    }

    if (!form.deliveryMethodId) {
      setError("Select a delivery method before saving this fee rule.");
      return;
    }

    const selectedZone = zones.find(
      (zone) => zone._id === form.deliveryZoneId,
    );

    if (!selectedZone) {
      setError("The selected zone is no longer active. Select another zone.");
      return;
    }

    const selectedMethod = methods.find(
      (method) => method._id === form.deliveryMethodId,
    );

    if (!selectedMethod || selectedMethod.status !== "ACTIVE") {
      setError("The selected delivery method is no longer active.");
      return;
    }

    if (form.method !== "weight_based" && Number(form.perKgFee) !== 0) {
      setError("Per KG Fee must be zero unless the method is weight based.");
      return;
    }

    if (
      form.maximumWeightKg !== "" &&
      Number(form.maximumWeightKg) < Number(form.minimumWeightKg)
    ) {
      setError("Maximum weight cannot be less than minimum weight.");
      return;
    }

    if (
      form.maximumWeightKg !== "" &&
      Number(form.maximumWeightKg) <= 0
    ) {
      setError("Maximum weight must be greater than zero.");
      return;
    }

    setSaving(true);

    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim(),
      description: form.description.trim() || undefined,

      deliveryZoneId: selectedZone._id,
      deliveryMethodId: selectedMethod._id,

      country: selectedZone.country,
      state: selectedZone.state || undefined,
      city: selectedZone.city || undefined,
      postalCodes: selectedZone.postalCodes ?? [],

      // Calculation type remains unchanged.
      method: form.method,

      baseFee: Number(form.baseFee),
      perKgFee:
        form.method === "weight_based"
          ? Number(form.perKgFee)
          : 0,

      freeDeliveryThreshold:
        form.freeDeliveryThreshold === ""
          ? undefined
          : Number(form.freeDeliveryThreshold),

      minimumOrderAmount: Number(form.minimumOrderAmount),
      minimumWeightKg: Number(form.minimumWeightKg),

      maximumWeightKg:
        form.maximumWeightKg === ""
          ? undefined
          : Number(form.maximumWeightKg),

      supportsCOD: form.supportsCOD,
      priority: Number(form.priority),
      status: form.status,
    };

    try {
      if (editingId) {
        await deliveryAdminApi.fees.update(editingId, payload);
        setSuccess("Delivery fee rule updated.");
      } else {
        await deliveryAdminApi.fees.create(payload);
        setSuccess("Delivery fee rule created.");
      }

      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);

      await loadFees();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save fee rule.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(fee: DeliveryFeeRule) {
    setError("");
    setSuccess("");

    try {
      await deliveryAdminApi.fees.setStatus(
        fee._id,
        fee.status === "active" ? "inactive" : "active",
      );

      setSuccess("Delivery fee status updated.");
      await loadFees();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update fee status.",
      );
    }
  }

  async function remove(fee: DeliveryFeeRule) {
    if (!window.confirm(`Delete fee rule "${fee.name}"?`)) return;

    setError("");
    setSuccess("");

    try {
      await deliveryAdminApi.fees.remove(fee._id);
      setSuccess("Delivery fee rule deleted.");
      await loadFees();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to delete fee rule.",
      );
    }
  }

  const selectedZone = zones.find(
    (zone) => zone._id === form.deliveryZoneId,
  );

  const selectedMethod = methods.find(
    (method) => method._id === form.deliveryMethodId,
  );

  function getMethodLabel(fee: DeliveryFeeRule) {
    const methodId = getMethodId(fee.deliveryMethodId);

    const method = methods.find(
      (item) => item._id === methodId,
    );

    if (method) {
      return `${method.name} (${method.code})`;
    }

    if (
      fee.deliveryMethodId &&
      typeof fee.deliveryMethodId === "object"
    ) {
      return fee.deliveryMethodId.name ?? "Unknown method";
    }

    return "Unlinked method";
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Delivery Fees</h1>
          <p className="mt-1 text-sm text-gray-500">
            Configure delivery fee rules for existing zones and delivery methods.
          </p>
        </div>

        <button
          onClick={openCreate}
          disabled={methods.length === 0 || zones.length === 0}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          + Add Fee Rule
        </button>
      </header>

      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      {success && (
        <p
          role="status"
          className="rounded-lg bg-green-50 p-3 text-sm text-green-700"
        >
          {success}
        </p>
      )}

      {methods.length === 0 && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          No active delivery methods found. Create or activate a delivery method first.
        </p>
      )}

      <input
        className={inputClass}
        placeholder="Search fee rules..."
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />

      {showForm && (
        <form
          onSubmit={submit}
          className="space-y-4 rounded-xl border border-gray-200 p-5 dark:border-gray-800"
        >
          <h2 className="text-lg font-semibold">
            {editingId ? "Edit Fee Rule" : "Create Fee Rule"}
          </h2>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              Fee Rule Name
              <input
                required
                minLength={2}
                maxLength={120}
                className={inputClass}
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
              />
            </label>

            <label className="space-y-1 text-sm">
              Slug
              <input
                required
                minLength={2}
                maxLength={160}
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                className={inputClass}
                value={form.slug}
                onChange={(e) => update("slug", e.target.value)}
              />
            </label>

            <label className="space-y-1 text-sm md:col-span-2">
              Delivery Zone <span className="text-red-600">*</span>

              <select
                required
                className={inputClass}
                value={form.deliveryZoneId}
                onChange={(e) => applyZone(e.target.value)}
              >
                <option value="">Select an active delivery zone</option>

                {zones.map((zone) => (
                  <option key={zone._id} value={zone._id}>
                    {zone.name} —{" "}
                    {[zone.city, zone.state, zone.country]
                      .filter(Boolean)
                      .join(", ")}
                  </option>
                ))}
              </select>

              {zones.length === 0 && (
                <span className="block text-xs text-amber-600">
                  No active zones found. Create or activate a delivery zone first.
                </span>
              )}
            </label>

            <label className="space-y-1 text-sm md:col-span-2">
              Delivery Method <span className="text-red-600">*</span>

              <select
                required
                className={inputClass}
                value={form.deliveryMethodId}
                onChange={(e) =>
                  update("deliveryMethodId", e.target.value)
                }
              >
                <option value="">Select an active delivery method</option>

                {methods.map((method) => (
                  <option key={method._id} value={method._id}>
                    {method.name} ({method.code})
                  </option>
                ))}
              </select>

              {selectedMethod && (
                <span className="block text-xs text-gray-500">
                  Estimated delivery: {selectedMethod.estimatedMinMinutes}–
                  {selectedMethod.estimatedMaxMinutes} minutes
                </span>
              )}
            </label>

            {selectedZone && (
              <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900 dark:bg-blue-950 dark:text-blue-100 md:col-span-2">
                <div className="font-medium">Selected Zone Details</div>

                <div className="mt-1">
                  Country: {selectedZone.country} · State:{" "}
                  {selectedZone.state || "—"} · City:{" "}
                  {selectedZone.city}
                </div>

                <div>
                  Postal Codes: {selectedZone.postalCodes?.join(", ") || "—"}
                </div>

                <div className="mt-1 text-xs">
                  Location values will be copied from the selected zone.
                </div>
              </div>
            )}

            <label className="space-y-1 text-sm">
              Fee Calculation Method
              <select
                className={inputClass}
                value={form.method}
                onChange={(e) =>
                  update("method", e.target.value as DeliveryFeeMethod)
                }
              >
                <option value="flat">Flat</option>
                <option value="weight_based">Weight Based</option>
                <option value="order_value_based">Order Value Based</option>
              </select>
            </label>

            <label className="space-y-1 text-sm">
              Base Fee
              <input
                required
                type="number"
                min="0"
                step="0.01"
                className={inputClass}
                value={form.baseFee}
                onChange={(e) =>
                  update("baseFee", Number(e.target.value))
                }
              />
            </label>

            <label className="space-y-1 text-sm">
              Per KG Fee
              <input
                type="number"
                min="0"
                step="0.01"
                disabled={form.method !== "weight_based"}
                className={inputClass}
                value={
                  form.method === "weight_based"
                    ? form.perKgFee
                    : 0
                }
                onChange={(e) =>
                  update("perKgFee", Number(e.target.value))
                }
              />
            </label>

            <label className="space-y-1 text-sm">
              Free Delivery Threshold
              <input
                type="number"
                min="0"
                step="0.01"
                className={inputClass}
                value={form.freeDeliveryThreshold}
                onChange={(e) =>
                  update("freeDeliveryThreshold", e.target.value)
                }
              />
            </label>

            <label className="space-y-1 text-sm">
              Minimum Order Amount
              <input
                type="number"
                min="0"
                step="0.01"
                className={inputClass}
                value={form.minimumOrderAmount}
                onChange={(e) =>
                  update("minimumOrderAmount", Number(e.target.value))
                }
              />
            </label>

            <label className="space-y-1 text-sm">
              Minimum Weight (KG)
              <input
                type="number"
                min="0"
                step="0.01"
                className={inputClass}
                value={form.minimumWeightKg}
                onChange={(e) =>
                  update("minimumWeightKg", Number(e.target.value))
                }
              />
            </label>

            <label className="space-y-1 text-sm">
              Maximum Weight (KG)
              <input
                type="number"
                min="0"
                step="0.01"
                className={inputClass}
                value={form.maximumWeightKg}
                onChange={(e) =>
                  update("maximumWeightKg", e.target.value)
                }
              />
            </label>

            <label className="space-y-1 text-sm">
              Priority
              <input
                type="number"
                min="0"
                className={inputClass}
                value={form.priority}
                onChange={(e) =>
                  update("priority", Number(e.target.value))
                }
              />
            </label>

            <label className="space-y-1 text-sm">
              Status
              <select
                className={inputClass}
                value={form.status}
                onChange={(e) =>
                  update(
                    "status",
                    e.target.value as FeeForm["status"],
                  )
                }
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.supportsCOD}
                onChange={(e) =>
                  update("supportsCOD", e.target.checked)
                }
              />
              Supports Cash on Delivery
            </label>
          </div>

          <label className="block space-y-1 text-sm">
            Description
            <textarea
              maxLength={1000}
              className={inputClass}
              rows={3}
              value={form.description}
              onChange={(e) =>
                update("description", e.target.value)
              }
            />
          </label>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={
                saving ||
                zones.length === 0 ||
                methods.length === 0
              }
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {saving
                ? "Saving..."
                : editingId
                  ? "Update Fee Rule"
                  : "Create Fee Rule"}
            </button>

            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border px-4 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              {[
                "Fee Rule",
                "Zone",
                "Delivery Method",
                "Fee Type",
                "Base Fee",
                "Per KG",
                "Country",
                "Status",
                "Actions",
              ].map((heading) => (
                <th key={heading} className="px-4 py-3 font-medium">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center">
                  Loading fee rules...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-8 text-center text-gray-500"
                >
                  No fee rules found.
                </td>
              </tr>
            ) : (
              items.map((fee) => {
                const zone = zones.find(
                  (item) => item._id === fee.deliveryZoneId,
                );

                return (
                  <tr
                    key={fee._id}
                    className="border-t border-gray-200 dark:border-gray-800"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">{fee.name}</div>
                      <div className="text-xs text-gray-500">
                        {fee.slug}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      {zone?.name ?? fee.deliveryZoneId ?? "Unlinked zone"}
                    </td>

                    <td className="px-4 py-3">
                      <div className="font-medium">
                        {getMethodLabel(fee)}
                      </div>
                    </td>

                    <td className="px-4 py-3">{fee.method}</td>
                    <td className="px-4 py-3">{fee.baseFee}</td>
                    <td className="px-4 py-3">{fee.perKgFee}</td>
                    <td className="px-4 py-3">{fee.country}</td>
                    <td className="px-4 py-3">{fee.status}</td>

                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEdit(fee)}
                          className="text-blue-600"
                        >
                          Edit
                        </button>

                        <button
                          onClick={() => void changeStatus(fee)}
                          className="text-amber-600"
                        >
                          {fee.status === "active" ? "Disable" : "Enable"}
                        </button>

                        <button
                          onClick={() => void remove(fee)}
                          className="text-red-600"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
