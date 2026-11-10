"use client";

import { useState, type FormEvent } from "react";
import { Search, Truck, Loader2, AlertCircle, MapPin, Clock } from "lucide-react";
import { deliveryAdminApi } from "@/services/api/delivery-admin.api";
import type { TrackingResult } from "@/features/shipping/shipping.types";

function getError(error: unknown) {
  const value = error as { response?: { data?: { message?: string } }; message?: string };
  return value.response?.data?.message || value.message || "Tracking lookup failed.";
}

export default function AdminTrackingPage() {
  const [trackingNumber, setTrackingNumber] = useState("");
  const [result, setResult] = useState<TrackingResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!trackingNumber.trim()) return;

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const data = await deliveryAdminApi.shipping.track(trackingNumber.trim());
      setResult(data);
    } catch (err) {
      setError(getError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex items-center gap-2">
        <Truck className="h-6 w-6 text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Delivery Tracking</h1>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Look up a shipment using its public tracking number.
      </p>

      <form onSubmit={submit} className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:flex-row dark:border-gray-800 dark:bg-gray-900">
        <input
          value={trackingNumber}
          onChange={(event) => setTrackingNumber(event.target.value)}
          placeholder="Enter tracking number"
          className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        />
        <button
          type="submit"
          disabled={loading || !trackingNumber.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Track shipment
        </button>
      </form>

      {error && (
        <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-5 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Tracking number", result.trackingNumber],
              ["Shipment number", result.shipmentNumber],
              ["Order ID", result.orderId],
              ["Status", result.status],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-xs text-gray-500">{label}</p>
                <p className="mt-1 break-all font-semibold text-gray-900 dark:text-white">{value || "—"}</p>
              </div>
            ))}
          </div>

          {result.address && (
            <div className="flex gap-2 border-t border-gray-100 pt-4 text-sm dark:border-gray-800">
              <MapPin className="h-4 w-4 shrink-0 text-gray-400" />
              <p className="text-gray-700 dark:text-gray-300">
                {[
                  result.address.recipientName,
                  result.address.addressLine1,
                  result.address.city,
                  result.address.state,
                  result.address.postalCode,
                  result.address.country,
                ].filter(Boolean).join(", ")}
              </p>
            </div>
          )}

          <div className="border-t border-gray-100 pt-4 dark:border-gray-800">
            <h2 className="mb-4 font-semibold text-gray-900 dark:text-white">Tracking events</h2>
            {!result.trackingEvents?.length ? (
              <p className="text-sm text-gray-500">No tracking events returned.</p>
            ) : (
              <ol className="space-y-4">
                {result.trackingEvents.map((event, index) => (
                  <li key={`${event.occurredAt ?? event.createdAt ?? index}-${index}`} className="flex gap-3">
                    <Clock className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{event.status || "Update"}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-300">{event.description || "—"}</p>
                      <p className="mt-1 text-xs text-gray-500">{event.location || ""} {event.occurredAt || event.createdAt || ""}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
