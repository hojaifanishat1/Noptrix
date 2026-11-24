"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import apiClient from "@/services/api/client";
import type { ApiResponse } from "@/types/api";
import {
  ArrowLeft,
  Bike,
  RefreshCw,
  Save,
  Wallet,
} from "lucide-react";

type RiderStatus =
  | "PENDING"
  | "ACTIVE"
  | "INACTIVE"
  | "SUSPENDED"
  | "BLOCKED"
  | "TERMINATED";

type RiderType = "INTERNAL" | "CONTRACT" | "FREELANCE";

interface Rider {
  _id: string;
  userId?: string | {
    _id: string;
    name?: string;
    email?: string;
    phone?: string;
    status?: string;
  };
  riderCode: string;
  type: RiderType;
  name: string;
  email: string;
  phone?: string;
  vehicleType?: string;
  vehicleNumber?: string;
  licenseNumber?: string;
  nationalId?: string;
  status: RiderStatus;
  onboardingStatus: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
  onboardingCompletedAt?: string;
  isAvailable: boolean;
  joinedAt?: string;
  notes?: string;
  suspensionReason?: string;
  terminationReason?: string;
  suspendedAt?: string;
  terminatedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  lastLoginAt?: string;
}

const STATUSES: RiderStatus[] = [
  "PENDING",
  "ACTIVE",
  "INACTIVE",
  "SUSPENDED",
  "BLOCKED",
  "TERMINATED",
];

const TYPES: RiderType[] = [
  "INTERNAL",
  "CONTRACT",
  "FREELANCE",
];

const VEHICLES = [
  "MOTORCYCLE",
  "CAR",
  "BICYCLE",
  "VAN",
  "OTHER",
];

function getError(error: unknown): string {
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
    : "Something went wrong.";
}

function date(value?: string) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "—"
    : parsed.toLocaleString();
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-slate-600">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
      />
    </label>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-xl border bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

export default function RiderDetailsPage() {
  const params = useParams<{ riderId: string }>();
  const router = useRouter();
  const riderId = params.riderId;

  const [rider, setRider] = useState<Rider | null>(null);
  const [form, setForm] = useState({
    riderCode: "",
    name: "",
    email: "",
    phone: "",
    type: "INTERNAL" as RiderType,
    vehicleType: "",
    vehicleNumber: "",
    licenseNumber: "",
    nationalId: "",
    notes: "",
    joinedAt: "",
  });

  const [status, setStatus] = useState<RiderStatus>("PENDING");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadRider = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await apiClient.get<ApiResponse<Rider>>(
        `/riders/${encodeURIComponent(riderId)}`,
      );

      const data = response.data.data;
      setRider(data);
      setStatus(data.status);

      setForm({
        riderCode: data.riderCode ?? "",
        name: data.name ?? "",
        email: data.email ?? "",
        phone: data.phone ?? "",
        type: data.type ?? "INTERNAL",
        vehicleType: data.vehicleType ?? "",
        vehicleNumber: data.vehicleNumber ?? "",
        licenseNumber: data.licenseNumber ?? "",
        nationalId: data.nationalId ?? "",
        notes: data.notes ?? "",
        joinedAt: data.joinedAt
          ? data.joinedAt.slice(0, 10)
          : "",
      });
    } catch (err) {
      setError(getError(err));
    } finally {
      setLoading(false);
    }
  }, [riderId]);

  useEffect(() => {
    void loadRider();
  }, [loadRider]);

  const change = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const saveProfile = async () => {
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await apiClient.patch<ApiResponse<Rider>>(
        `/riders/${encodeURIComponent(riderId)}`,
        {
          riderCode: form.riderCode.trim(),
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          type: form.type,
          vehicleType: form.vehicleType || undefined,
          vehicleNumber: form.vehicleNumber.trim(),
          licenseNumber: form.licenseNumber.trim(),
          nationalId: form.nationalId.trim(),
          notes: form.notes,
          ...(form.joinedAt
            ? { joinedAt: form.joinedAt }
            : {}),
        },
      );

      setRider(response.data.data);
      setNotice("Rider profile updated successfully.");
      await loadRider();
    } catch (err) {
      setError(getError(err));
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async () => {
    if (!rider || status === rider.status) return;

    const requiresReason = [
      "SUSPENDED",
      "BLOCKED",
      "TERMINATED",
    ].includes(status);

    const statusReason = requiresReason ? reason.trim() : "";

    if (requiresReason && !statusReason) {
      setError("A reason is required for this status.");
      return;
    }

    if (!window.confirm(`Change rider status to ${status}?`)) return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      await apiClient.patch(`/riders/${riderId}/status`, {
        status,
        ...(statusReason ? { reason: statusReason } : {}),
      });

      setNotice("Rider status updated successfully.");
      setReason("");
      await loadRider();
    } catch (err) {
      setError(getError(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-sm text-slate-500">
        Loading rider profile...
      </div>
    );
  }

  if (!rider) {
    return (
      <div className="space-y-4 p-6">
        <p className="text-sm text-red-600">
          {error || "Rider not found."}
        </p>
        <button
          type="button"
          onClick={() => router.push("/admin/riders")}
          className="rounded-lg border px-4 py-2 text-sm"
        >
          Back to Riders
        </button>
      </div>
    );
  }

  const user =
    typeof rider.userId === "object" ? rider.userId : null;

  return (
    <main className="space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Bike className="h-7 w-7 text-slate-700" />
          <div>
            <h1 className="text-2xl font-bold text-slate-950">
              Rider Details
            </h1>
            <p className="text-sm text-slate-500">
              {rider.name} · {rider.riderCode}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/riders"
            className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            Riders
          </Link>

          <button
            type="button"
            onClick={() => void loadRider()}
            className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </header>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {notice && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {notice}
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Rider Code", rider.riderCode],
          ["Status", rider.status],
          ["Rider Type", rider.type],
          ["Availability", rider.isAvailable ? "Available" : "Unavailable"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border bg-white p-4">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="mt-1 font-semibold text-slate-900">{value}</p>
          </div>
        ))}
      </section>

      <Section title="Profile and Contact">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Field label="Rider Code" value={form.riderCode} onChange={(v) => change("riderCode", v)} />
          <Field label="Full Name" value={form.name} onChange={(v) => change("name", v)} />
          <Field label="Email" type="email" value={form.email} onChange={(v) => change("email", v)} />
          <Field label="Phone" value={form.phone} onChange={(v) => change("phone", v)} />

          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-600">Rider Type</span>
            <select
              value={form.type}
              onChange={(e) => change("type", e.target.value)}
              className="h-10 w-full rounded-lg border px-3 text-sm"
            >
              {TYPES.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>

          <Field label="Joined Date" type="date" value={form.joinedAt} onChange={(v) => change("joinedAt", v)} />
        </div>
      </Section>

      <Section title="Vehicle and Identification">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-600">Vehicle Type</span>
            <select
              value={form.vehicleType}
              onChange={(e) => change("vehicleType", e.target.value)}
              className="h-10 w-full rounded-lg border px-3 text-sm"
            >
              <option value="">Not specified</option>
              {VEHICLES.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>

          <Field label="Vehicle Number" value={form.vehicleNumber} onChange={(v) => change("vehicleNumber", v)} />
          <Field label="License Number" value={form.licenseNumber} onChange={(v) => change("licenseNumber", v)} />
          <Field label="National ID" value={form.nationalId} onChange={(v) => change("nationalId", v)} />
        </div>
      </Section>

      <Section title="Onboarding and Account">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <div>
            <p className="text-xs text-slate-500">Onboarding Status</p>
            <p className="mt-1 font-medium">{rider.onboardingStatus}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Onboarding Completed</p>
            <p className="mt-1 font-medium">{date(rider.onboardingCompletedAt)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">User Account</p>
            <p className="mt-1 font-medium">{user?.status ?? (user ? "Linked" : "Not linked")}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Last Login</p>
            <p className="mt-1 font-medium">{date(rider.lastLoginAt)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Created</p>
            <p className="mt-1 font-medium">{date(rider.createdAt)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Updated</p>
            <p className="mt-1 font-medium">{date(rider.updatedAt)}</p>
          </div>
        </div>
      </Section>

      <Section title="Administrative Notes">
        <textarea
          rows={4}
          value={form.notes}
          onChange={(e) => change("notes", e.target.value)}
          className="w-full rounded-lg border p-3 text-sm"
          placeholder="Internal notes about this rider..."
        />
        <button
          type="button"
          onClick={() => void saveProfile()}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          Save Profile
        </button>
      </Section>

      <Section title="Rider Status Management">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-600">Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as RiderStatus)}
              disabled={rider.status === "TERMINATED"}
              className="h-10 w-full rounded-lg border px-3 text-sm disabled:opacity-50"
            >
              {STATUSES.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>

          <Field
            label="Reason (required for suspension/block/termination)"
            value={reason}
            onChange={setReason}
          />
        </div>

        <button
          type="button"
          onClick={() => void updateStatus()}
          disabled={saving || status === rider.status || rider.status === "TERMINATED"}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          Update Status
        </button>

        {rider.suspensionReason && (
          <p className="text-sm text-orange-700">
            Suspension reason: {rider.suspensionReason}
          </p>
        )}

        {rider.terminationReason && (
          <p className="text-sm text-red-700">
            Termination reason: {rider.terminationReason}
          </p>
        )}
      </Section>

      <Section title="Rider Financial Records">
        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/rider-earnings"
            className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium"
          >
            <Wallet className="h-4 w-4" />
            Rider Earnings
          </Link>

          <Link
            href={`/admin/riders/payouts?riderId=${encodeURIComponent(rider._id)}`}
            className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium"
          >
            Rider Payouts
          </Link>
        </div>
      </Section>
    </main>
  );
}
