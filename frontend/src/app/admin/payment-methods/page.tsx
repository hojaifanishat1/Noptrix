"use client";

import { useCallback, useEffect, useState } from "react";
import { CreditCard, RefreshCw, Save } from "lucide-react";
import {
  paymentMethodsAdminApi,
  type AdminPaymentMethod,
} from "@/services/api/payment-methods-admin.api";

export default function AdminPaymentMethodsPage() {
  const [methods, setMethods] = useState<AdminPaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setMethods(await paymentMethodsAdminApi.list(true));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load payment methods.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const update = async (method: AdminPaymentMethod) => {
    setSaving(method.methodId);
    setError("");
    setNotice("");

    try {
      const updated = await paymentMethodsAdminApi.update(method.methodId, {
        enabled: method.enabled,
        displayOrder: method.displayOrder,
        description: method.description,
      });

      setMethods((current) =>
        current.map((item) =>
          item.methodId === updated.methodId ? updated : item,
        ),
      );
      setNotice(`${updated.name} updated successfully.`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update payment method.",
      );
    } finally {
      setSaving(null);
    }
  };

  const change = (
    id: string,
    patch: Partial<AdminPaymentMethod>,
  ) => {
    setMethods((current) =>
      current.map((method) =>
        method.methodId === id ? { ...method, ...patch } : method,
      ),
    );
  };

  return (
    <main className="space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Payment Methods
            </h1>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Manage available checkout payment methods.
          </p>
        </div>

        <button
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm dark:border-gray-700"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </header>

      {error && (
        <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {notice && (
        <div role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
          {notice}
        </div>
      )}

      {loading ? (
        <p className="py-10 text-center text-sm text-gray-500">Loading payment methods...</p>
      ) : methods.length === 0 ? (
        <div className="rounded-xl border p-8 text-center dark:border-gray-800">
          No payment methods were returned by the server.
        </div>
      ) : (
        <section className="grid gap-4 lg:grid-cols-2">
          {methods.map((method) => (
            <article
              key={method.methodId}
              className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-gray-900 dark:text-white">
                    {method.name}
                  </h2>
                  <p className="mt-1 text-xs uppercase tracking-wide text-gray-500">
                    {method.methodId}
                  </p>
                </div>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={method.enabled}
                    onChange={(event) =>
                      change(method.methodId, { enabled: event.target.checked })
                    }
                    className="h-4 w-4"
                  />
                  Enabled
                </label>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Description
                </label>
                <textarea
                  value={method.description ?? ""}
                  onChange={(event) =>
                    change(method.methodId, { description: event.target.value })
                  }
                  rows={3}
                  className="w-full rounded-lg border bg-transparent p-3 text-sm dark:border-gray-700"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Display order
                </label>
                <input
                  type="number"
                  min={1}
                  value={method.displayOrder}
                  onChange={(event) =>
                    change(method.methodId, {
                      displayOrder: Math.max(1, Number(event.target.value) || 1),
                    })
                  }
                  className="w-full rounded-lg border bg-transparent p-2.5 text-sm dark:border-gray-700"
                />
              </div>

              <button
                onClick={() => void update(method)}
                disabled={saving !== null}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <Save size={16} />
                {saving === method.methodId ? "Saving..." : "Save changes"}
              </button>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
