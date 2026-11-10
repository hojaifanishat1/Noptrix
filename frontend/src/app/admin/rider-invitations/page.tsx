"use client";

import { isAxiosError } from "axios";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Bike, Mail, RefreshCw, Send, UserPlus } from "lucide-react";
import {
  riderInvitationsApi,
  type RiderInvitation,
  type RiderVehicleType,
} from "@/services/api/rider-invitations.api";

function getErrorMessage(error: unknown) {
  if (isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message ?? error.message;
  }
  return error instanceof Error ? error.message : "Something went wrong.";
}

export default function RiderInvitationsPage() {
  const [invitations, setInvitations] = useState<RiderInvitation[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [type, setType] = useState<RiderInvitation["type"]>("INTERNAL");
  const [vehicleType, setVehicleType] =
    useState<RiderVehicleType | "">("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadInvitations = useCallback(async () => {
    setLoading(true);
    try {
      setInvitations(await riderInvitationsApi.list());
      setError("");
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInvitations();
  }, [loadInvitations]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await riderInvitationsApi.create({
        name: name.trim(),
        email: email.trim(),
        ...(phone.trim() ? { phone: phone.trim() } : {}),
        type,
        ...(vehicleType ? { vehicleType } : {}),
      });
      setName("");
      setEmail("");
      setPhone("");
      setVehicleType("");
      setMessage("Rider invitation sent. The rider profile will remain pending until verified.");
      await loadInvitations();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  const revoke = async (invitation: RiderInvitation) => {
    setError("");
    setMessage("");
    if (!window.confirm(`Revoke the invitation for ${invitation.email}?`)) return;
    try {
      await riderInvitationsApi.revoke(invitation._id);
      await loadInvitations();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  };

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <header className="flex items-center gap-3">
        <div className="rounded-xl bg-slate-900 p-3 text-white"><Bike className="h-6 w-6" /></div>
        <div>
          <h1 className="text-2xl font-bold text-slate-950">Rider Invitations</h1>
          <p className="mt-1 text-sm text-slate-500">Invite a rider directly without a job application.</p>
        </div>
      </header>

      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {message && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</div>}

      <form onSubmit={submit} className="grid gap-4 rounded-xl border bg-white p-5 sm:grid-cols-2">
        <label className="text-sm font-medium text-slate-700">
          Full name
          <input required minLength={2} maxLength={100} value={name} onChange={(event) => setName(event.target.value)} className="mt-1 h-10 w-full rounded-lg border px-3" />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Email
          <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 h-10 w-full rounded-lg border px-3" />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Phone (optional)
          <input value={phone} onChange={(event) => setPhone(event.target.value)} className="mt-1 h-10 w-full rounded-lg border px-3" />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Rider type
          <select value={type} onChange={(event) => setType(event.target.value as RiderInvitation["type"])} className="mt-1 h-10 w-full rounded-lg border bg-white px-3">
            <option value="INTERNAL">Internal</option>
            <option value="CONTRACT">Contract</option>
            <option value="FREELANCE">Freelance</option>
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">
          Vehicle type (optional)
          <select value={vehicleType} onChange={(event) => setVehicleType(event.target.value as RiderVehicleType | "")} className="mt-1 h-10 w-full rounded-lg border bg-white px-3">
            <option value="">Not specified</option>
            <option value="MOTORCYCLE">Motorcycle</option>
            <option value="CAR">Car</option>
            <option value="BICYCLE">Bicycle</option>
            <option value="VAN">Van</option>
            <option value="OTHER">Other</option>
          </select>
        </label>
        <div className="flex items-end">
          <button type="submit" disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50">
            <Send className="h-4 w-4" /> {saving ? "Sending…" : "Send rider invitation"}
          </button>
        </div>
      </form>

      <section className="rounded-xl border bg-white">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="font-semibold text-slate-900">Recent invitations</h2>
          <button type="button" onClick={() => void loadInvitations()} disabled={loading} className="inline-flex items-center gap-2 text-sm text-slate-600 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
        {loading ? (
          <p className="p-6 text-center text-sm text-slate-500">
            Loading rider invitations...
          </p>
        ) : invitations.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-500">
            No rider invitations yet.
          </p>
        ) : (
          <ul className="divide-y">
            {invitations.map((invitation) => (
              <li key={invitation._id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <UserPlus className="h-5 w-5 text-slate-500" />
                  <div>
                    <p className="font-medium text-slate-900">{invitation.name}</p>
                    <p className="inline-flex items-center gap-1 text-sm text-slate-500">
                      <Mail className="h-3.5 w-3.5" />
                      {invitation.email}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {invitation.type}
                      {invitation.vehicleType ? ` · ${invitation.vehicleType}` : ""}
                      {" · Expires "}
                      {new Date(invitation.expiresAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{invitation.status}</span>
                  {invitation.status === "PENDING" && (
                    <button type="button" onClick={() => void revoke(invitation)} className="text-sm font-medium text-red-600 hover:text-red-800">Revoke</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
