"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw, Plus, Wallet, Search } from "lucide-react";
import apiClient from "@/services/api/client";

type EarningStatus = "PENDING" | "APPROVED" | "PAID" | "CANCELLED";
type EarningType = "DELIVERY" | "BONUS" | "INCENTIVE" | "ADJUSTMENT" | "PENALTY";

interface Earning {
  _id: string;
  riderId: string | { _id: string; name?: string; riderCode?: string };
  orderId?: string;
  type: EarningType;
  amount: number;
  currency: string;
  status: EarningStatus;
  description?: string;
  earningDate: string;
  notes?: string;
}

interface RiderOption {
  _id: string;
  name: string;
  riderCode: string;
}

const TYPES: EarningType[] = [
  "DELIVERY", "BONUS", "INCENTIVE", "ADJUSTMENT", "PENALTY",
];

const STATUSES: EarningStatus[] = [
  "PENDING", "APPROVED", "PAID", "CANCELLED",
];

function message(error: unknown) {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as {
      response?: { data?: { message?: string } };
    }).response;
    if (response?.data?.message) return response.data.message;
  }
  return error instanceof Error ? error.message : "Request failed.";
}

function riderName(value: Earning["riderId"]) {
  return typeof value === "string"
    ? value
    : `${value.name ?? "Rider"} (${value.riderCode ?? "—"})`;
}

function money(amount: number, currency: string) {
  return `${currency} ${Number(amount).toFixed(2)}`;
}

export default function RiderEarningsPage() {
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [riders, setRiders] = useState<RiderOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    riderId: "",
    type: "DELIVERY" as EarningType,
    amount: "",
    currency: "BDT",
    orderId: "",
    description: "",
    notes: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [earningResponse, riderResponse] = await Promise.all([
        apiClient.get("/rider-earnings", {
          params: {
            page,
            limit: 20,
            ...(status ? { status } : {}),
          },
        }),
        apiClient.get("/riders", {
          params: { page: 1, limit: 100 },
        }),
      ]);

      const payload = earningResponse.data;
      setEarnings(payload.data ?? []);
      setTotalPages(payload.pagination?.totalPages ?? 1);

      const riderPayload = riderResponse.data.data;
      setRiders(riderPayload.riders ?? []);
    } catch (err) {
      setError(message(err));
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const createEarning = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      await apiClient.post("/rider-earnings", {
        riderId: form.riderId,
        type: form.type,
        amount: Number(form.amount),
        currency: form.currency.trim().toUpperCase(),
        ...(form.orderId.trim() ? { orderId: form.orderId.trim() } : {}),
        ...(form.description.trim() ? { description: form.description.trim() } : {}),
        ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
      });

      setNotice("Rider earning created.");
      setShowForm(false);
      setForm({
        riderId: "",
        type: "DELIVERY",
        amount: "",
        currency: "BDT",
        orderId: "",
        description: "",
        notes: "",
      });
      await load();
    } catch (err) {
      setError(message(err));
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (
    earning: Earning,
    nextStatus: EarningStatus,
  ) => {
    if (earning.status === nextStatus) return;

    let reason = "";
    if (nextStatus === "CANCELLED") {
      const value = window.prompt("Enter cancellation reason:");
      if (!value?.trim()) return;
      reason = value.trim();
    }

    if (!window.confirm(`Change earning status to ${nextStatus}?`)) return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      await apiClient.patch(`/rider-earnings/${earning._id}/status`, {
        status: nextStatus,
        ...(reason ? { reason } : {}),
      });
      setNotice("Earning status updated.");
      await load();
    } catch (err) {
      setError(message(err));
    } finally {
      setSaving(false);
    }
  };

  const visible = earnings.filter((item) => {
    const query = search.toLowerCase().trim();
    if (!query) return true;
    return (
      riderName(item.riderId).toLowerCase().includes(query) ||
      item.type.toLowerCase().includes(query) ||
      item.orderId?.toLowerCase().includes(query) ||
      item.description?.toLowerCase().includes(query)
    );
  });

  const totals = earnings.reduce(
    (acc, item) => {
      if (item.status === "PENDING") acc.pending += item.amount;
      if (item.status === "APPROVED") acc.approved += item.amount;
      if (item.status === "PAID") acc.paid += item.amount;
      return acc;
    },
    { pending: 0, approved: 0, paid: 0 },
  );

  return (
    <main className="space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">Rider Earnings</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage delivery earnings, bonuses, incentives and adjustments.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
          <button
            onClick={() => setShowForm((value) => !value)}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm text-white"
          >
            <Plus className="h-4 w-4" /> Add Earning
          </button>
        </div>
      </header>

      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {notice && <p className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{notice}</p>}

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          ["Pending", totals.pending],
          ["Approved", totals.approved],
          ["Paid", totals.paid],
        ].map(([label, amount]) => (
          <div key={String(label)} className="rounded-xl border bg-white p-4">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-1 text-xl font-bold">{Number(amount).toFixed(2)}</p>
            <p className="text-xs text-slate-400">Current page totals · mixed currencies</p>
          </div>
        ))}
      </section>

      {showForm && (
        <form onSubmit={createEarning} className="space-y-4 rounded-xl border bg-white p-5">
          <h2 className="font-semibold">Create Rider Earning</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="space-y-1 text-sm">
              <span>Rider *</span>
              <select
                required
                value={form.riderId}
                onChange={(e) => setForm({ ...form, riderId: e.target.value })}
                className="h-10 w-full rounded-lg border px-3"
              >
                <option value="">Select rider</option>
                {riders.map((rider) => (
                  <option key={rider._id} value={rider._id}>
                    {rider.name} — {rider.riderCode}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm">
              <span>Type *</span>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as EarningType })}
                className="h-10 w-full rounded-lg border px-3"
              >
                {TYPES.map((type) => <option key={type}>{type}</option>)}
              </select>
            </label>

            <label className="space-y-1 text-sm">
              <span>Amount *</span>
              <input
                required
                min="0"
                step="0.01"
                type="number"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="h-10 w-full rounded-lg border px-3"
              />
            </label>

            <label className="space-y-1 text-sm">
              <span>Currency *</span>
              <input
                required
                maxLength={3}
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
                className="h-10 w-full rounded-lg border px-3"
              />
            </label>

            <label className="space-y-1 text-sm">
              <span>Order ID (optional)</span>
              <input
                value={form.orderId}
                onChange={(e) => setForm({ ...form, orderId: e.target.value })}
                className="h-10 w-full rounded-lg border px-3"
              />
            </label>

            <label className="space-y-1 text-sm">
              <span>Description</span>
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="h-10 w-full rounded-lg border px-3"
              />
            </label>
          </div>

          <label className="block space-y-1 text-sm">
            <span>Internal Notes</span>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full rounded-lg border p-3"
            />
          </label>

          <div className="flex gap-2">
            <button disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50">
              {saving ? "Saving..." : "Create Earning"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border px-4 py-2 text-sm">
              Close
            </button>
          </div>
        </form>
      )}

      <section className="rounded-xl border bg-white p-4">
        <div className="mb-4 flex flex-wrap gap-3">
          <label className="flex min-w-52 flex-1 items-center gap-2 rounded-lg border px-3">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search rider, order, type..."
              className="h-10 w-full text-sm outline-none"
            />
          </label>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="h-10 rounded-lg border px-3 text-sm"
          >
            <option value="">All statuses</option>
            {STATUSES.map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>

        {loading ? (
          <p className="p-8 text-center text-sm text-slate-500">Loading earnings...</p>
        ) : visible.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            <Wallet className="mx-auto mb-2 h-8 w-8" />
            No rider earnings found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-3">Rider</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {visible.map((item) => (
                  <tr key={item._id}>
                    <td className="p-3 font-medium">{riderName(item.riderId)}</td>
                    <td className="p-3">{item.type}</td>
                    <td className="p-3 font-semibold">{money(item.amount, item.currency)}</td>
                    <td className="p-3">{new Date(item.earningDate).toLocaleDateString()}</td>
                    <td className="p-3">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs">{item.status}</span>
                    </td>
                    <td className="p-3">
                      {item.status === "PENDING" && (
                        <button disabled={saving} onClick={() => void changeStatus(item, "APPROVED")} className="mr-2 rounded-md bg-green-50 px-2 py-1 text-xs text-green-700">
                          Approve
                        </button>
                      )}
                      {item.status === "APPROVED" && (
                        <button disabled={saving} onClick={() => void changeStatus(item, "PAID")} className="mr-2 rounded-md bg-blue-50 px-2 py-1 text-xs text-blue-700">
                          Mark Paid
                        </button>
                      )}
                      {["PENDING", "APPROVED"].includes(item.status) && (
                        <button disabled={saving} onClick={() => void changeStatus(item, "CANCELLED")} className="rounded-md bg-red-50 px-2 py-1 text-xs text-red-700">
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-slate-500">Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <button disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Previous</button>
            <button disabled={page >= totalPages || loading} onClick={() => setPage((value) => value + 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Next</button>
          </div>
        </div>
      </section>

      <Link href="/admin/riders" className="inline-block text-sm text-blue-700 underline">
        Back to Riders
      </Link>
    </main>
  );
}
