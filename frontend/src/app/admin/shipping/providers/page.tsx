import { AlertTriangle, Truck } from "lucide-react";

export default function ShippingProvidersPage() {
  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex items-center gap-2">
        <Truck className="h-6 w-6 text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Shipping Providers</h1>
      </div>
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/20">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <h2 className="font-semibold text-amber-900 dark:text-amber-200">Provider management API is not available</h2>
            <p className="mt-2 text-sm text-amber-800 dark:text-amber-300">
              The current Backend has a provider field on shipments, but no separate Shipping Provider CRUD module or management endpoints were found. This page does not create fake provider records.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
