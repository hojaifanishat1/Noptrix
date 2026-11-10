import { AlertTriangle, ChartNoAxesCombined } from "lucide-react";

export default function DeliveryReportsPage() {
  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex items-center gap-2">
        <ChartNoAxesCombined className="h-6 w-6 text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Delivery Reports</h1>
      </div>
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/20">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <h2 className="font-semibold text-amber-900 dark:text-amber-200">Reporting endpoint not available</h2>
            <p className="mt-2 text-sm text-amber-800 dark:text-amber-300">
              No dedicated delivery reports or analytics endpoint was found in the current Backend contract. Real delivery report totals cannot be calculated reliably from the available list endpoints, so this page does not display fabricated metrics.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
