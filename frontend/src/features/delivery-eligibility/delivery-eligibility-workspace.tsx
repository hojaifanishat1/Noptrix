"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle2, XCircle, Search, Loader2 } from "lucide-react";
import { deliveryAdminApi } from "@/services/api/delivery-admin.api";

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white";

function getError(error: unknown) {
  const value = error as {
    response?: { data?: { message?: string } };
    message?: string;
  };
  return value.response?.data?.message ?? value.message ?? "Eligibility check failed.";
}

export default function DeliveryEligibilityWorkspace() {
  const [form, setForm] = useState({
    country: "BD",
    city: "",
    state: "",
    postalCode: "",
    latitude: "",
    longitude: "",
    orderAmount: "0",
    paymentMethod: "online" as "cod" | "online",
    methodCode: "",
  });

  const [result, setResult] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function update(key: keyof typeof form, value: string) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);

    if ((form.latitude === "") !== (form.longitude === "")) {
      setError("Latitude and longitude must both be supplied, or both left empty.");
      setLoading(false);
      return;
    }

    try {
      const payload = {
        country: form.country.trim().toUpperCase(),
        city: form.city.trim(),
        state: form.state.trim() || undefined,
        postalCode: form.postalCode.trim() || undefined,
        latitude: form.latitude === "" ? undefined : Number(form.latitude),
        longitude: form.longitude === "" ? undefined : Number(form.longitude),
        orderAmount: Number(form.orderAmount),
        paymentMethod: form.paymentMethod,
        methodCode: form.methodCode.trim() || undefined,
      };

      const data = await deliveryAdminApi.areas.checkEligibility(payload);
      setResult(data);
    } catch (err) {
      setError(getError(err));
    } finally {
      setLoading(false);
    }
  }

  const resultObject =
    result && typeof result === "object"
      ? result as Record<string, unknown>
      : null;

  const available = resultObject
    ? Boolean(resultObject.available ?? resultObject.eligible ?? resultObject.success)
    : false;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Delivery Eligibility Checker
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Check whether a customer address can be served by your delivery network.
        </p>
      </header>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}

      <form onSubmit={submit} className="space-y-5 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="space-y-1 text-sm">
            Country *
            <input required maxLength={3} className={inputClass} value={form.country} onChange={(e) => update("country", e.target.value)} />
          </label>

          <label className="space-y-1 text-sm">
            City *
            <input required maxLength={100} className={inputClass} value={form.city} onChange={(e) => update("city", e.target.value)} />
          </label>

          <label className="space-y-1 text-sm">
            State
            <input className={inputClass} value={form.state} onChange={(e) => update("state", e.target.value)} />
          </label>

          <label className="space-y-1 text-sm">
            Postal Code
            <input className={inputClass} value={form.postalCode} onChange={(e) => update("postalCode", e.target.value)} />
          </label>

          <label className="space-y-1 text-sm">
            Order Amount *
            <input required type="number" min="0" step="0.01" className={inputClass} value={form.orderAmount} onChange={(e) => update("orderAmount", e.target.value)} />
          </label>

          <label className="space-y-1 text-sm">
            Payment Method *
            <select className={inputClass} value={form.paymentMethod} onChange={(e) => update("paymentMethod", e.target.value as "cod" | "online")}>
              <option value="online">Online</option>
              <option value="cod">Cash on Delivery</option>
            </select>
          </label>

          <label className="space-y-1 text-sm">
            Delivery Method Code
            <input className={inputClass} placeholder="e.g. EXPRESS" value={form.methodCode} onChange={(e) => update("methodCode", e.target.value)} />
          </label>

          <label className="space-y-1 text-sm">
            Latitude (optional)
            <input type="number" min="-90" max="90" step="any" className={inputClass} value={form.latitude} onChange={(e) => update("latitude", e.target.value)} />
          </label>

          <label className="space-y-1 text-sm">
            Longitude (optional)
            <input type="number" min="-180" max="180" step="any" className={inputClass} value={form.longitude} onChange={(e) => update("longitude", e.target.value)} />
          </label>
        </div>

        <p className="text-xs text-gray-500">
          Latitude and longitude must be provided together. Leave both empty to check using city and postal code.
        </p>

        <button
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Check Eligibility
        </button>
      </form>

      {resultObject && (
        <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            {available ? (
              <CheckCircle2 className="h-7 w-7 text-green-600" />
            ) : (
              <XCircle className="h-7 w-7 text-red-600" />
            )}
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white">
                Eligibility Response
              </h2>
              <p className="text-sm text-gray-500">
                Result returned by the backend eligibility service.
              </p>
            </div>
          </div>

          <pre className="overflow-x-auto rounded-lg bg-gray-50 p-4 text-xs text-gray-800 dark:bg-gray-950 dark:text-gray-200">
            {JSON.stringify(result, null, 2)}
          </pre>
        </section>
      )}
    </div>
  );
}
