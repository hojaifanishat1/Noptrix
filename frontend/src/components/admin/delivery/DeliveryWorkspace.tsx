"use client";

import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Pencil,
  Trash2,
  Truck,
  X,
} from "lucide-react";

import {
  deliveryAdminApi,
  type ActiveRiderOption,
} from "@/services/api/delivery-admin.api";

type ResourceKind = "deliveries" | "zones" | "fees" | "shipping";

interface Props {
  kind: ResourceKind;
  title: string;
  description: string;
  assignmentMode?: boolean;
}

type Row = Record<string, unknown> & {
  _id?: string;
  id?: string;
};

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-gray-700 dark:bg-gray-900 dark:text-white";

const labelClass =
  "mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300";

const defaults: Record<ResourceKind, Record<string, unknown>> = {
  deliveries: {
    orderId: "",
    recipientName: "",
    recipientPhone: "",
    address: "",
    city: "",
    deliveryFee: 0,
    currency: "BDT",
  },
  zones: {
    name: "",
    slug: "",
    description: "",
    country: "BD",
    city: "",
    postalCodes: [],
    deliveryFee: 0,
    minimumOrderAmount: 0,
    estimatedDeliveryMinDays: 1,
    estimatedDeliveryMaxDays: 3,
    supportsCOD: true,
    priority: 0,
    status: "active",
  },
  fees: {
    name: "",
    slug: "",
    description: "",
    country: "BD",
    city: "",
    postalCodes: [],
    method: "flat",
    baseFee: 0,
    perKgFee: 0,
    minimumOrderAmount: 0,
    minimumWeightKg: 0,
    supportsCOD: true,
    priority: 0,
    status: "active",
  },
  shipping: {
    orderId: "",
    provider: "internal",
    shippingFee: 0,
    currency: "BDT",
    address: {
      recipientName: "",
      phone: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "",
      postalCode: "",
      country: "BD",
    },
  },
};

const config = {
  deliveries: {
    path: "/delivery",
    statuses: [
      "pending",
      "assigned",
      "accepted",
      "picked_up",
      "in_transit",
      "arriving",
      "delivered",
      "failed",
      "cancelled",
      "returned",
    ],
  },
  zones: {
    path: "/delivery-zones",
    statuses: ["active", "inactive"],
  },
  fees: {
    path: "/delivery-fees",
    statuses: ["active", "inactive"],
  },
  shipping: {
    path: "/shipping",
    statuses: [
      "created",
      "ready_to_ship",
      "picked_up",
      "in_transit",
      "out_for_delivery",
      "delivered",
      "failed",
      "returned",
      "cancelled",
    ],
  },
} as const;

function messageOf(error: unknown): string {
  const value = error as {
    response?: { data?: { message?: string } };
    message?: string;
  };

  return (
    value?.response?.data?.message ||
    value?.message ||
    "Request failed. Please try again."
  );
}

function display(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function recordId(row: Row): string {
  return String(row._id ?? row.id ?? "");
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className={labelClass}>{label}</label>
      {children}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  type = "text",
  placeholder,
  required = false,
  min,
  max,
  step,
}: {
  value: unknown;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <input
      type={type}
      value={String(value ?? "")}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      required={required}
      min={min}
      max={max}
      step={step}
      className={inputClass}
    />
  );
}

function SelectInput({
  value,
  onChange,
  options,
}: {
  value: unknown;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <select
      value={String(value ?? "")}
      onChange={(event) => onChange(event.target.value)}
      className={inputClass}
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase())}
        </option>
      ))}
    </select>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
      />
    </label>
  );
}

export default function DeliveryWorkspace({
  kind,
  title,
  description,
  assignmentMode = false,
}: Props) {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [assignmentFilter, setAssignmentFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [selected, setSelected] = useState<Row | null>(null);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [postalCodesText, setPostalCodesText] = useState("");
  const [riderModalItem, setRiderModalItem] = useState<Row | null>(null);
  const [activeRiders, setActiveRiders] = useState<ActiveRiderOption[]>([]);
  const [riderSearch, setRiderSearch] = useState("");
  const [selectedRiderId, setSelectedRiderId] = useState("");
  const [ridersLoading, setRidersLoading] = useState(false);
  const [riderSaving, setRiderSaving] = useState(false);


  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params: Record<string, unknown> = {
        page,
        limit: 20,
        search: search.trim() || undefined,
        status: status || undefined,
        sort: kind === "zones" ? "priority" : "newest",
      };

      let result;

      switch (kind) {
        case "deliveries":
          result = await deliveryAdminApi.deliveries.list(params);
          break;
        case "zones":
          result = await deliveryAdminApi.zones.list(params);
          break;
        case "fees":
          result = await deliveryAdminApi.fees.list(params);
          break;
        case "shipping":
          result = await deliveryAdminApi.shipping.list(params);
          break;
      }

      setItems(result.items as Row[]);
      setTotal(result.pagination.total);
      setTotalPages(result.pagination.totalPages);
    } catch (err) {
      setError(messageOf(err));
      setItems([]);
      setTotal(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  }, [kind, page, search, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setFormData({ ...defaults[kind] });
    setPostalCodesText("");
    setError("");
    setSuccess("");
    setModalOpen(true);
  };

  const openEdit = (item: Row) => {
    setEditing(item);

    const editable = { ...item };
    delete editable._id;
    delete editable.id;
    delete editable.createdAt;
    delete editable.updatedAt;
    delete editable.createdBy;
    delete editable.updatedBy;

    setFormData(editable);

    setPostalCodesText(
      Array.isArray(editable.postalCodes)
        ? editable.postalCodes.map(String).join(", ")
        : "",
    );

    setError("");
    setSuccess("");
    setModalOpen(true);
  };

  const updateField = (key: string, value: unknown) => {
    setFormData((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const updateShippingAddress = (key: string, value: string) => {
    setFormData((previous) => {
      const address =
        (previous.address as Record<string, unknown> | undefined) ?? {};

      return {
        ...previous,
        address: {
          ...address,
          [key]: value,
        },
      };
    });
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    const payload: Record<string, unknown> = {
      ...formData,
    };

    if (kind === "zones" || kind === "fees") {
      payload.postalCodes = postalCodesText
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
    }

    if (kind === "zones" || kind === "fees") {
      if (
        typeof payload.name !== "string" ||
        !payload.name.trim() ||
        typeof payload.slug !== "string" ||
        !payload.slug.trim() ||
        typeof payload.city !== "string" ||
        !payload.city.trim()
      ) {
        setError("Name, slug and city are required.");
        return;
      }
    }

    setSaving(true);

    try {
      const id = editing ? recordId(editing) : "";

      if (editing && !id) {
        throw new Error("This record has no valid ID.");
      }

      switch (kind) {
        case "deliveries":
          if (editing) {
            throw new Error(
              "Delivery records cannot be edited through this API. Use status or assignment actions.",
            );
          }
          await deliveryAdminApi.deliveries.create(payload);
          break;

        case "zones":
          if (editing) {
            await deliveryAdminApi.zones.update(id, payload);
          } else {
            await deliveryAdminApi.zones.create(payload);
          }
          break;

        case "fees":
          if (editing) {
            await deliveryAdminApi.fees.update(id, payload);
          } else {
            await deliveryAdminApi.fees.create(payload);
          }
          break;

        case "shipping":
          if (editing) {
            throw new Error(
              "Shipment editing is not supported by the available API.",
            );
          }
          await deliveryAdminApi.shipping.create(payload);
          break;
      }

      setSuccess(
        editing
          ? "Record updated successfully."
          : "Record created successfully.",
      );

      setModalOpen(false);
      setEditing(null);
      await load();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setSaving(false);
    }
  };

  const setRecordStatus = async (item: Row) => {
    const id = recordId(item);
    const current = String(item.status ?? "");

    const next = window.prompt(
      `Enter the new status.\nAllowed: ${config[kind].statuses.join(", ")}`,
      current,
    );

    if (!next || next === current) return;

    if (!(config[kind].statuses as readonly string[]).includes(next)) {
      setError("Invalid status value.");
      return;
    }

    setActionId(id);
    setError("");
    setSuccess("");

    try {
      if (kind === "zones") {
        await deliveryAdminApi.zones.setStatus(
          id,
          next as "active" | "inactive",
        );
      } else if (kind === "fees") {
        await deliveryAdminApi.fees.setStatus(
          id,
          next as "active" | "inactive",
        );
      } else if (kind === "deliveries") {
        const description = window.prompt(
          "Status update description:",
          `Status changed to ${next}`,
        );

        if (!description) return;

        await deliveryAdminApi.deliveries.updateStatus(id, {
          status: next,
          eventId: `admin-${Date.now()}`,
          description,
        });
      } else {
        const description = window.prompt(
          "Tracking event description:",
          `Status changed to ${next}`,
        );

        if (!description) return;

        await deliveryAdminApi.shipping.updateStatus(id, {
          status: next,
          eventId: `admin-${Date.now()}`,
          description,
        });
      }

      setSuccess("Status updated successfully.");
      await load();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setActionId("");
    }
  };

  const assignRider = async (item: Row) => {
    setRiderModalItem(item);
    setActiveRiders([]);
    setRiderSearch("");
    setSelectedRiderId("");
    setError("");
    setSuccess("");
    setRidersLoading(true);

    try {
      const riders = await deliveryAdminApi.riders.getActive();
      setActiveRiders(riders);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setRidersLoading(false);
    }
  };

  const confirmRiderAssignment = async () => {
    if (!riderModalItem || !selectedRiderId) return;

    const id = recordId(riderModalItem);

    setRiderSaving(true);
    setActionId(id);
    setError("");
    setSuccess("");

    try {
      if (kind === "deliveries") {
        await deliveryAdminApi.deliveries.assignRider(id, selectedRiderId);
      } else {
        await deliveryAdminApi.shipping.assignRider(id, selectedRiderId);
      }

      setSuccess("Rider assigned successfully.");
      setRiderModalItem(null);
      setSelectedRiderId("");
      await load();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setRiderSaving(false);
      setActionId("");
    }
  };

  const cancelRecord = async (item: Row) => {
    const id = recordId(item);
    const reason = window.prompt("Enter cancellation reason:");

    if (!reason?.trim()) return;
    if (!window.confirm("Confirm cancellation?")) return;

    setActionId(id);
    setError("");
    setSuccess("");

    try {
      if (kind === "deliveries") {
        await deliveryAdminApi.deliveries.cancel(id, reason.trim());
      } else if (kind === "shipping") {
        await deliveryAdminApi.shipping.cancel(id, reason.trim());
      } else {
        throw new Error(
          "Cancellation is not supported for this resource.",
        );
      }

      setSuccess("Record cancelled.");
      await load();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setActionId("");
    }
  };

  const removeRecord = async (item: Row) => {
    if (kind !== "zones" && kind !== "fees") return;

    const id = recordId(item);

    if (!window.confirm("Permanently delete this record?")) return;

    setActionId(id);
    setError("");
    setSuccess("");

    try {
      if (kind === "zones") {
        await deliveryAdminApi.zones.remove(id);
      } else {
        await deliveryAdminApi.fees.remove(id);
      }

      setSuccess("Record deleted.");
      await load();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setActionId("");
    }
  };

  const assignedCount = items.filter(
    (item) =>
      item.riderId !== null &&
      item.riderId !== undefined &&
      String(item.riderId).trim() !== "",
  ).length;

  const unassignedCount = items.length - assignedCount;

  const visibleItems = assignmentMode
    ? items.filter((item) => {
        const assigned =
          item.riderId !== null &&
          item.riderId !== undefined &&
          String(item.riderId).trim() !== "";

        if (assignmentFilter === "assigned") return assigned;
        if (assignmentFilter === "unassigned") return !assigned;
        return true;
      })
    : items;

  const columns = assignmentMode
    ? kind === "deliveries"
      ? ["deliveryNumber", "orderId", "recipientName", "city", "riderId", "status"]
      : ["shipmentNumber", "trackingNumber", "orderId", "provider", "riderId", "status"]
    : kind === "deliveries"
      ? ["deliveryNumber", "orderId", "recipientName", "city", "deliveryFee", "status"]
      : kind === "zones"
        ? ["name", "slug", "city", "country", "deliveryFee", "status"]
        : kind === "fees"
          ? ["name", "slug", "method", "baseFee", "country", "status"]
          : [
              "shipmentNumber",
              "trackingNumber",
              "orderId",
              "provider",
              "shippingFee",
              "status",
            ];

  const renderZoneForm = () => (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Zone Name *">
          <TextInput
            value={formData.name}
            onChange={(value) => updateField("name", value)}
            placeholder="Example: Dhaka Central"
            required
          />
        </Field>

        <Field label="Slug *">
          <TextInput
            value={formData.slug}
            onChange={(value) =>
              updateField(
                "slug",
                value.toLowerCase().trim().replace(/\s+/g, "-"),
              )
            }
            placeholder="dhaka-central"
            required
          />
        </Field>

        <Field label="Country *">
          <TextInput
            value={formData.country}
            onChange={(value) => updateField("country", value.toUpperCase())}
            placeholder="BD"
            required
          />
        </Field>

        <Field label="City *">
          <TextInput
            value={formData.city}
            onChange={(value) => updateField("city", value)}
            placeholder="Dhaka"
            required
          />
        </Field>

        <Field label="State / Division">
          <TextInput
            value={formData.state}
            onChange={(value) => updateField("state", value)}
            placeholder="Dhaka Division"
          />
        </Field>

        <Field label="Delivery Fee *">
          <TextInput
            type="number"
            min={0}
            step={0.01}
            value={formData.deliveryFee}
            onChange={(value) => updateField("deliveryFee", Number(value))}
            required
          />
        </Field>

        <Field label="Minimum Order Amount">
          <TextInput
            type="number"
            min={0}
            step={0.01}
            value={formData.minimumOrderAmount}
            onChange={(value) =>
              updateField("minimumOrderAmount", Number(value))
            }
          />
        </Field>

        <Field label="Free Delivery Threshold">
          <TextInput
            type="number"
            min={0}
            step={0.01}
            value={formData.freeDeliveryThreshold ?? ""}
            onChange={(value) =>
              updateField(
                "freeDeliveryThreshold",
                value === "" ? undefined : Number(value),
              )
            }
            placeholder="Optional"
          />
        </Field>

        <Field label="Minimum Delivery Days">
          <TextInput
            type="number"
            min={0}
            max={365}
            value={formData.estimatedDeliveryMinDays}
            onChange={(value) =>
              updateField("estimatedDeliveryMinDays", Number(value))
            }
          />
        </Field>

        <Field label="Maximum Delivery Days">
          <TextInput
            type="number"
            min={0}
            max={365}
            value={formData.estimatedDeliveryMaxDays}
            onChange={(value) =>
              updateField("estimatedDeliveryMaxDays", Number(value))
            }
          />
        </Field>

        <Field label="Priority">
          <TextInput
            type="number"
            min={0}
            max={100000}
            value={formData.priority}
            onChange={(value) => updateField("priority", Number(value))}
          />
        </Field>

        <Field label="Status">
          <SelectInput
            value={formData.status}
            onChange={(value) => updateField("status", value)}
            options={["active", "inactive"]}
          />
        </Field>
      </div>

      <Field label="Description">
        <textarea
          value={String(formData.description ?? "")}
          onChange={(event) =>
            updateField("description", event.target.value)
          }
          rows={3}
          maxLength={500}
          className={inputClass}
          placeholder="Describe this delivery zone..."
        />
      </Field>

      <Field label="Postal Codes">
        <textarea
          value={postalCodesText}
          onChange={(event) => setPostalCodesText(event.target.value)}
          rows={2}
          className={inputClass}
          placeholder="1205, 1206, 1207"
        />
        <p className="mt-1 text-xs text-gray-500">
          Enter multiple postal codes separated by commas.
        </p>
      </Field>

      <Toggle
        checked={Boolean(formData.supportsCOD)}
        onChange={(value) => updateField("supportsCOD", value)}
        label="Cash on Delivery supported"
      />
    </>
  );

  const renderFeeForm = () => (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Fee Rule Name *">
          <TextInput
            value={formData.name}
            onChange={(value) => updateField("name", value)}
            placeholder="Standard Delivery Fee"
            required
          />
        </Field>

        <Field label="Slug *">
          <TextInput
            value={formData.slug}
            onChange={(value) =>
              updateField(
                "slug",
                value.toLowerCase().trim().replace(/\s+/g, "-"),
              )
            }
            placeholder="standard-delivery"
            required
          />
        </Field>

        <Field label="Country">
          <TextInput
            value={formData.country}
            onChange={(value) => updateField("country", value.toUpperCase())}
          />
        </Field>

        <Field label="City *">
          <TextInput
            value={formData.city}
            onChange={(value) => updateField("city", value)}
            placeholder="Dhaka"
            required
          />
        </Field>

        <Field label="State">
          <TextInput
            value={formData.state}
            onChange={(value) => updateField("state", value)}
          />
        </Field>

        <Field label="Fee Method">
          <SelectInput
            value={formData.method}
            onChange={(value) => updateField("method", value)}
            options={["flat", "weight_based", "order_value_based"]}
          />
        </Field>

        <Field label="Base Fee *">
          <TextInput
            type="number"
            min={0}
            step={0.01}
            value={formData.baseFee}
            onChange={(value) => updateField("baseFee", Number(value))}
            required
          />
        </Field>

        <Field label="Per KG Fee">
          <TextInput
            type="number"
            min={0}
            step={0.01}
            value={formData.perKgFee}
            onChange={(value) => updateField("perKgFee", Number(value))}
          />
        </Field>

        <Field label="Minimum Order Amount">
          <TextInput
            type="number"
            min={0}
            step={0.01}
            value={formData.minimumOrderAmount}
            onChange={(value) =>
              updateField("minimumOrderAmount", Number(value))
            }
          />
        </Field>

        <Field label="Free Delivery Threshold">
          <TextInput
            type="number"
            min={0}
            step={0.01}
            value={formData.freeDeliveryThreshold ?? ""}
            onChange={(value) =>
              updateField(
                "freeDeliveryThreshold",
                value === "" ? undefined : Number(value),
              )
            }
            placeholder="Optional"
          />
        </Field>

        <Field label="Minimum Weight (KG)">
          <TextInput
            type="number"
            min={0}
            step={0.01}
            value={formData.minimumWeightKg}
            onChange={(value) =>
              updateField("minimumWeightKg", Number(value))
            }
          />
        </Field>

        <Field label="Maximum Weight (KG)">
          <TextInput
            type="number"
            min={0}
            step={0.01}
            value={formData.maximumWeightKg ?? ""}
            onChange={(value) =>
              updateField(
                "maximumWeightKg",
                value === "" ? undefined : Number(value),
              )
            }
            placeholder="Optional"
          />
        </Field>

        <Field label="Priority">
          <TextInput
            type="number"
            min={0}
            max={100000}
            value={formData.priority}
            onChange={(value) => updateField("priority", Number(value))}
          />
        </Field>

        <Field label="Status">
          <SelectInput
            value={formData.status}
            onChange={(value) => updateField("status", value)}
            options={["active", "inactive"]}
          />
        </Field>
      </div>

      <Field label="Description">
        <textarea
          value={String(formData.description ?? "")}
          onChange={(event) =>
            updateField("description", event.target.value)
          }
          rows={3}
          maxLength={500}
          className={inputClass}
          placeholder="Describe this delivery fee rule..."
        />
      </Field>

      <Field label="Postal Codes">
        <textarea
          value={postalCodesText}
          onChange={(event) => setPostalCodesText(event.target.value)}
          rows={2}
          className={inputClass}
          placeholder="1205, 1206, 1207"
        />
        <p className="mt-1 text-xs text-gray-500">
          Enter multiple postal codes separated by commas.
        </p>
      </Field>

      <Toggle
        checked={Boolean(formData.supportsCOD)}
        onChange={(value) => updateField("supportsCOD", value)}
        label="Cash on Delivery supported"
      />
    </>
  );

  const renderDeliveryForm = () => (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Order ID *">
        <TextInput
          value={formData.orderId}
          onChange={(value) => updateField("orderId", value)}
          required
        />
      </Field>

      <Field label="Customer ID">
        <TextInput
          value={formData.customerId ?? ""}
          onChange={(value) => updateField("customerId", value)}
        />
      </Field>

      <Field label="Recipient Name *">
        <TextInput
          value={formData.recipientName}
          onChange={(value) => updateField("recipientName", value)}
          required
        />
      </Field>

      <Field label="Recipient Phone *">
        <TextInput
          value={formData.recipientPhone}
          onChange={(value) => updateField("recipientPhone", value)}
          required
        />
      </Field>

      <Field label="City *">
        <TextInput
          value={formData.city}
          onChange={(value) => updateField("city", value)}
          required
        />
      </Field>

      <Field label="Delivery Fee *">
        <TextInput
          type="number"
          min={0}
          step={0.01}
          value={formData.deliveryFee}
          onChange={(value) => updateField("deliveryFee", Number(value))}
          required
        />
      </Field>

      <Field label="Currency">
        <TextInput
          value={formData.currency}
          onChange={(value) => updateField("currency", value.toUpperCase())}
        />
      </Field>

      <div className="sm:col-span-2">
        <Field label="Delivery Address *">
          <textarea
            value={String(formData.address ?? "")}
            onChange={(event) => updateField("address", event.target.value)}
            rows={3}
            required
            className={inputClass}
          />
        </Field>
      </div>
    </div>
  );

  const renderShippingForm = () => {
    const address =
      (formData.address as Record<string, unknown> | undefined) ?? {};

    return (
      <>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Order ID *">
            <TextInput
              value={formData.orderId}
              onChange={(value) => updateField("orderId", value)}
              required
            />
          </Field>

          <Field label="Customer ID">
            <TextInput
              value={formData.customerId ?? ""}
              onChange={(value) => updateField("customerId", value)}
            />
          </Field>

          <Field label="Shipping Provider">
            <TextInput
              value={formData.provider}
              onChange={(value) => updateField("provider", value)}
            />
          </Field>

          <Field label="Provider Shipment ID">
            <TextInput
              value={formData.providerShipmentId ?? ""}
              onChange={(value) =>
                updateField("providerShipmentId", value)
              }
            />
          </Field>

          <Field label="Shipping Fee">
            <TextInput
              type="number"
              min={0}
              step={0.01}
              value={formData.shippingFee}
              onChange={(value) =>
                updateField("shippingFee", Number(value))
              }
            />
          </Field>

          <Field label="Currency">
            <TextInput
              value={formData.currency}
              onChange={(value) =>
                updateField("currency", value.toUpperCase())
              }
            />
          </Field>

          <Field label="Rider ID">
            <TextInput
              value={formData.riderId ?? ""}
              onChange={(value) => updateField("riderId", value)}
            />
          </Field>

          <Field label="Estimated Delivery">
            <TextInput
              type="datetime-local"
              value={
                typeof formData.estimatedDeliveryAt === "string"
                  ? formData.estimatedDeliveryAt.slice(0, 16)
                  : ""
              }
              onChange={(value) =>
                updateField(
                  "estimatedDeliveryAt",
                  value ? new Date(value).toISOString() : undefined,
                )
              }
            />
          </Field>
        </div>

        <div className="border-t border-gray-200 pt-4 dark:border-gray-700">
          <h3 className="mb-4 font-semibold text-gray-900 dark:text-white">
            Recipient Address
          </h3>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Recipient Name *">
              <TextInput
                value={address.recipientName}
                onChange={(value) =>
                  updateShippingAddress("recipientName", value)
                }
                required
              />
            </Field>

            <Field label="Phone *">
              <TextInput
                value={address.phone}
                onChange={(value) =>
                  updateShippingAddress("phone", value)
                }
                required
              />
            </Field>

            <Field label="Address Line 1 *">
              <TextInput
                value={address.addressLine1}
                onChange={(value) =>
                  updateShippingAddress("addressLine1", value)
                }
                required
              />
            </Field>

            <Field label="Address Line 2">
              <TextInput
                value={address.addressLine2 ?? ""}
                onChange={(value) =>
                  updateShippingAddress("addressLine2", value)
                }
              />
            </Field>

            <Field label="City *">
              <TextInput
                value={address.city}
                onChange={(value) =>
                  updateShippingAddress("city", value)
                }
                required
              />
            </Field>

            <Field label="State">
              <TextInput
                value={address.state ?? ""}
                onChange={(value) =>
                  updateShippingAddress("state", value)
                }
              />
            </Field>

            <Field label="Postal Code">
              <TextInput
                value={address.postalCode ?? ""}
                onChange={(value) =>
                  updateShippingAddress("postalCode", value)
                }
              />
            </Field>

            <Field label="Country">
              <TextInput
                value={address.country ?? "BD"}
                onChange={(value) =>
                  updateShippingAddress("country", value.toUpperCase())
                }
              />
            </Field>
          </div>
        </div>
      </>
    );
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <Truck className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {title}
            </h1>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {description}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm dark:border-gray-700 dark:text-gray-200"
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>

          {!assignmentMode && (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Create
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300">
          <CheckCircle2 className="h-4 w-4" />
          {success}
        </div>
      )}

      {assignmentMode ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm text-gray-500">Total on this page</p>
            <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
              {items.length}
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm text-gray-500">Assigned</p>
            <p className="mt-1 text-2xl font-bold text-green-600">
              {assignedCount}
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm text-gray-500">Unassigned</p>
            <p className="mt-1 text-2xl font-bold text-orange-600">
              {unassignedCount}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm text-gray-500">Filtered records</p>
            <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
              {total}
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm text-gray-500">Records on this page</p>
            <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
              {items.length}
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm text-gray-500">Page</p>
            <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
              {page} / {Math.max(totalPages, 1)}
            </p>
          </div>
        </div>
      )}

      <section className="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 sm:grid-cols-2">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search records..."
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
          {config[kind].statuses.map((value) => (
            <option key={value} value={value}>
              {value.replaceAll("_", " ")}
            </option>
          ))}
        </select>

        {assignmentMode && (
          <select
            value={assignmentFilter}
            onChange={(event) => {
              setAssignmentFilter(event.target.value);
              setPage(1);
            }}
            className={inputClass}
          >
            <option value="all">All assignments</option>
            <option value="assigned">Assigned</option>
            <option value="unassigned">Unassigned</option>
          </select>
        )}
      </section>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
          <h2 className="font-semibold text-gray-900 dark:text-white">
            {title}
          </h2>
          <span className="text-sm text-gray-500">{total} total</span>
        </div>

        {loading ? (
          <div className="flex min-h-56 items-center justify-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading records...
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="flex min-h-56 flex-col items-center justify-center px-4 text-center">
            <Truck className="h-10 w-10 text-gray-300" />
            <p className="mt-3 font-medium text-gray-700 dark:text-gray-200">
              No records found
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {assignmentMode ? "Try another assignment filter." : "Try changing the filters or create a record."}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800/70 dark:text-gray-400">
                  <tr>
                    {columns.map((column) => (
                      <th key={column} className="px-4 py-3">
                        {column.replaceAll(/([A-Z])/g, " $1")}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {visibleItems.map((item) => {
                    const id = recordId(item);

                    return (
                      <tr
                        key={id}
                        className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40"
                      >
                        {columns.map((column) => (
                          <td
                            key={column}
                            className="max-w-56 truncate px-4 py-4 text-gray-700 dark:text-gray-300"
                          >
                            {column === "status" ? (
                              <span
                                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                  ["active", "delivered"].includes(
                                    String(item[column]),
                                  )
                                    ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                                    : [
                                          "failed",
                                          "cancelled",
                                          "inactive",
                                        ].includes(String(item[column]))
                                      ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                                      : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                                }`}
                              >
                                {display(item[column])}
                              </span>
                            ) : (
                              display(item[column])
                            )}
                          </td>
                        ))}

                        <td className="px-4 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              title="View details"
                              onClick={() => setSelected(item)}
                              className="rounded-lg border border-gray-200 p-2 text-gray-600 dark:border-gray-700 dark:text-gray-300"
                            >
                              <Eye className="h-4 w-4" />
                            </button>

                            {!assignmentMode &&
                              (kind === "zones" || kind === "fees") && (
                              <button
                                type="button"
                                title="Edit"
                                onClick={() => openEdit(item)}
                                className="rounded-lg border border-gray-200 p-2 text-gray-600 dark:border-gray-700 dark:text-gray-300"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                            )}

                            {(kind === "deliveries" ||
                              kind === "shipping") && (
                              <button
                                type="button"
                                title={
                                  item.riderId ? "Reassign rider" : "Assign rider"
                                }
                                disabled={actionId === id}
                                onClick={() => void assignRider(item)}
                                className="rounded-lg border border-blue-200 p-2 text-blue-600 disabled:opacity-50 dark:border-blue-900"
                              >
                                {actionId === id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Truck className="h-4 w-4" />
                                )}
                              </button>
                            )}

                            {!assignmentMode && (
                              <button
                                type="button"
                                title="Update status"
                                disabled={actionId === id}
                                onClick={() => void setRecordStatus(item)}
                                className="rounded-lg border border-gray-200 p-2 text-gray-600 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300"
                              >
                                <RefreshCw className="h-4 w-4" />
                              </button>
                            )}

                            {!assignmentMode &&
                              (kind === "deliveries" ||
                                kind === "shipping") && (
                                <button
                                  type="button"
                                  title="Cancel"
                                  disabled={actionId === id}
                                  onClick={() => void cancelRecord(item)}
                                  className="rounded-lg border border-red-200 p-2 text-red-600 disabled:opacity-50 dark:border-red-900"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              )}

                            {!assignmentMode &&
                              (kind === "zones" || kind === "fees") && (
                              <button
                                type="button"
                                title="Delete"
                                disabled={actionId === id}
                                onClick={() => void removeRecord(item)}
                                className="rounded-lg border border-red-200 p-2 text-red-600 disabled:opacity-50 dark:border-red-900"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t border-gray-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800">
              <p className="text-sm text-gray-500">
                Page {page} of {Math.max(totalPages, 1)} · {total} records
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1 || loading}
                  onClick={() =>
                    setPage((value) => Math.max(1, value - 1))
                  }
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
          <div className="my-auto w-full max-w-4xl rounded-2xl bg-white shadow-2xl dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-800">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  {editing ? "Edit" : "Create"}{" "}
                  {kind === "zones"
                    ? "Delivery Zone"
                    : kind === "fees"
                      ? "Delivery Fee Rule"
                      : kind === "deliveries"
                        ? "Delivery"
                        : "Shipment"}
                </h2>
                <p className="mt-1 text-xs text-gray-500">
                  Enter the required information below.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={saving}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={submit}>
              <div className="max-h-[70vh] space-y-5 overflow-y-auto p-5">
                {error && (
                  <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
                    {error}
                  </p>
                )}

                {kind === "zones" && renderZoneForm()}
                {kind === "fees" && renderFeeForm()}
                {kind === "deliveries" && renderDeliveryForm()}
                {kind === "shipping" && renderShippingForm()}
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-gray-200 px-5 py-4 sm:flex-row sm:justify-end dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={saving}
                  className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm dark:border-gray-700 dark:text-gray-200"
                >
                  Close
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {saving && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  {saving
                    ? "Saving..."
                    : editing
                      ? "Save Changes"
                      : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {riderModalItem && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/50 p-3 sm:p-6">
          <div className="my-auto w-full max-w-xl rounded-2xl bg-white shadow-2xl dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-800">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  Assign Rider
                </h2>
                <p className="mt-1 text-xs text-gray-500">
                  Select an active rider for this{" "}
                  {kind === "deliveries" ? "delivery" : "shipment"}.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setRiderModalItem(null)}
                disabled={riderSaving}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div>
                <label className={labelClass}>Search active riders</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    value={riderSearch}
                    onChange={(event) => setRiderSearch(event.target.value)}
                    placeholder="Search by name, rider code or phone..."
                    className={`${inputClass} pl-10`}
                  />
                </div>
              </div>

              <div className="max-h-80 space-y-2 overflow-y-auto">
                {ridersLoading ? (
                  <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Loading active riders...
                  </div>
                ) : activeRiders.length === 0 ? (
                  <p className="py-10 text-center text-sm text-gray-500">
                    No active riders found.
                  </p>
                ) : (
                  activeRiders
                    .filter((rider) => {
                      const query = riderSearch.trim().toLowerCase();
                      if (!query) return true;

                      return [
                        rider.name,
                        rider.riderCode,
                        rider.phone,
                        rider.vehicleType,
                      ]
                        .filter(Boolean)
                        .some((value) =>
                          String(value).toLowerCase().includes(query),
                        );
                    })
                    .map((rider) => (
                      <button
                        key={rider._id}
                        type="button"
                        onClick={() => setSelectedRiderId(rider._id)}
                        className={`w-full rounded-xl border p-3 text-left transition ${
                          selectedRiderId === rider._id
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                            : "border-gray-200 hover:border-blue-300 dark:border-gray-700"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white">
                              {rider.name}
                            </p>
                            <p className="mt-1 text-xs text-gray-500">
                              {rider.riderCode}
                              {rider.phone ? ` · ${rider.phone}` : ""}
                            </p>
                            {rider.vehicleType && (
                              <p className="mt-1 text-xs text-gray-500">
                                Vehicle: {rider.vehicleType}
                              </p>
                            )}
                          </div>

                          {selectedRiderId === rider._id && (
                            <CheckCircle2 className="h-5 w-5 shrink-0 text-blue-600" />
                          )}
                        </div>
                      </button>
                    ))
                )}
              </div>

              {activeRiders.length > 0 &&
                activeRiders.filter((rider) => {
                  const query = riderSearch.trim().toLowerCase();
                  return !query || [
                    rider.name,
                    rider.riderCode,
                    rider.phone,
                    rider.vehicleType,
                  ]
                    .filter(Boolean)
                    .some((value) =>
                      String(value).toLowerCase().includes(query),
                    );
                }).length === 0 && (
                  <p className="text-center text-sm text-gray-500">
                    No riders match your search.
                  </p>
                )}
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-gray-200 px-5 py-4 sm:flex-row sm:justify-end dark:border-gray-800">
              <button
                type="button"
                onClick={() => setRiderModalItem(null)}
                disabled={riderSaving}
                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm dark:border-gray-700 dark:text-gray-200"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => void confirmRiderAssignment()}
                disabled={!selectedRiderId || riderSaving || ridersLoading}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {riderSaving && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                {riderSaving ? "Assigning..." : "Confirm Assignment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-3 sm:p-6">
          <div className="my-auto w-full max-w-3xl rounded-2xl bg-white shadow-2xl dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-800">
              <h2 className="font-bold text-gray-900 dark:text-white">
                Record details
              </h2>

              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap break-words p-5 text-xs text-gray-700 dark:text-gray-300">
              {JSON.stringify(selected, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
