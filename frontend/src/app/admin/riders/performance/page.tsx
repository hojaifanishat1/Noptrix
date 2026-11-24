"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, AlertCircle, CheckCircle2, Clock3, Loader2,
  RefreshCw, Search, TrendingUp, Truck, Wallet, XCircle,
} from "lucide-react";
import { ridersApi, type Rider } from "@/services/api/riders.api";
import { deliveryAdminApi } from "@/services/api/delivery-admin.api";
import apiClient from "@/services/api/client";
import type { DeliveryRecord } from "@/features/delivery/delivery.types";

type Earning = {
  _id: string;
  amount: number;
  currency: string;
  status: "PENDING" | "APPROVED" | "PAID" | "CANCELLED";
  earningDate?: string;
};

function getError(error: unknown) {
  const e = error as {
    response?: { data?: { message?: string } };
    message?: string;
  };
  return e.response?.data?.message || e.message || "Unable to load performance data.";
}

function money(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "BDT",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function Stat({
  title, value, detail, icon: Icon,
}: {
  title: string;
  value: string;
  detail: string;
  icon: typeof Truck;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-gray-500">{title}</p>
        <Icon className="h-5 w-5 text-blue-600" />
      </div>
      <p className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{detail}</p>
    </div>
  );
}

async function loadDeliveries(riderId: string) {
  const first = await deliveryAdminApi.deliveries.list({
    riderId, page: 1, limit: 100, sort: "newest",
  });
  const items = [...first.items];

  for (let page = 2; page <= first.pagination.totalPages; page++) {
    const result = await deliveryAdminApi.deliveries.list({
      riderId, page, limit: 100, sort: "newest",
    });
    items.push(...result.items);
  }

  return { items, total: first.pagination.total };
}

async function loadEarnings(riderId: string) {
  const first = await apiClient.get<{
    data: Earning[];
    pagination?: { total?: number; totalPages?: number };
  }>("/rider-earnings", {
    params: { riderId, page: 1, limit: 100 },
  });

  const items = Array.isArray(first.data.data) ? [...first.data.data] : [];
  const totalPages = first.data.pagination?.totalPages ?? 1;

  for (let page = 2; page <= totalPages; page++) {
    const response = await apiClient.get<{
      data: Earning[];
    }>("/rider-earnings", {
      params: { riderId, page, limit: 100 },
    });
    if (Array.isArray(response.data.data)) items.push(...response.data.data);
  }

  return {
    items,
    total: first.data.pagination?.total ?? items.length,
  };
}

export default function RiderPerformancePage() {
  const [riders, setRiders] = useState<Rider[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [deliveries, setDeliveries] = useState<DeliveryRecord[]>([]);
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [deliveryTotal, setDeliveryTotal] = useState(0);
  const [earningTotal, setEarningTotal] = useState(0);
  const [loadingRiders, setLoadingRiders] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadRiders = useCallback(async () => {
    setLoadingRiders(true);
    try {
      const result = await ridersApi.list({ page: 1, limit: 100 });
      setRiders(result.riders);
      setSelectedId(current =>
        current && result.riders.some(r => r._id === current)
          ? current : result.riders[0]?._id ?? "",
      );
    } catch (err) {
      setError(getError(err));
    } finally {
      setLoadingRiders(false);
    }
  }, []);

  const loadPerformance = useCallback(async () => {
    if (!selectedId) {
      setDeliveries([]);
      setEarnings([]);
      setDeliveryTotal(0);
      setEarningTotal(0);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const [d, e] = await Promise.all([
        loadDeliveries(selectedId),
        loadEarnings(selectedId),
      ]);
      setDeliveries(d.items);
      setDeliveryTotal(d.total);
      setEarnings(e.items);
      setEarningTotal(e.total);
    } catch (err) {
      setError(getError(err));
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => { void loadRiders(); }, [loadRiders]);
  useEffect(() => { void loadPerformance(); }, [loadPerformance]);

  const rider = riders.find(r => r._id === selectedId);

  const filteredRiders = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return riders;
    return riders.filter(r =>
      [r.name, r.email, r.riderCode, r.phone]
        .filter(Boolean)
        .some(v => String(v).toLowerCase().includes(q)),
    );
  }, [riders, search]);

  const stats = useMemo(() => {
    const count = (status: string) =>
      deliveries.filter(d => d.status === status).length;

    const delivered = count("delivered");
    const failed = count("failed");
    const cancelled = count("cancelled");
    const attempts = delivered + failed;
    const completion = attempts ? delivered / attempts * 100 : 0;

    const active = deliveries.filter(d =>
      ["assigned", "accepted", "picked_up", "in_transit", "arriving"].includes(d.status),
    ).length;

    const currencies = [...new Set(earnings.map(e => e.currency || "BDT"))];
    const currency = currencies.length === 1 ? currencies[0] : "";

    const sum = (status: Earning["status"]) =>
      earnings.filter(e => e.status === status)
        .reduce((total, e) => total + Number(e.amount || 0), 0);

    const totalEarnings = earnings.reduce(
      (total, e) => total + Number(e.amount || 0), 0,
    );

    const feeCurrencies = [...new Set(
      deliveries.filter(d => d.status === "delivered").map(d => d.currency || "BDT"),
    )];
    const feeCurrency = feeCurrencies.length === 1 ? feeCurrencies[0] : "";
    const deliveredFees = deliveries
      .filter(d => d.status === "delivered")
      .reduce((total, d) => total + Number(d.deliveryFee || 0), 0);

    const statuses = [
      "pending", "assigned", "accepted", "picked_up", "in_transit",
      "arriving", "delivered", "failed", "cancelled", "returned",
    ].map(status => ({ status, count: count(status) }))
      .filter(item => item.count > 0);

    return {
      delivered, failed, cancelled, completion, active,
      currencies, currency, totalEarnings,
      pending: sum("PENDING"),
      approved: sum("APPROVED"),
      paid: sum("PAID"),
      feeCurrencies, feeCurrency, deliveredFees, statuses,
    };
  }, [deliveries, earnings]);

  const refresh = async () => {
    await loadRiders();
    await loadPerformance();
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Rider Performance
            </h1>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Delivery results and recorded rider earnings.
          </p>
        </div>
        <button
          onClick={() => void refresh()}
          disabled={loading || loadingRiders}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-700"
        >
          <RefreshCw className={`h-4 w-4 ${loading || loadingRiders ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-[1fr_320px]">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search rider name, code, email or phone"
            className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-9 pr-3 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
        </div>
        <select
          value={selectedId}
          onChange={e => setSelectedId(e.target.value)}
          disabled={loadingRiders}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        >
          <option value="">
            {loadingRiders ? "Loading riders..." : "Select a rider"}
          </option>
          {filteredRiders.map(r => (
            <option key={r._id} value={r._id}>
              {r.name} · {r.riderCode}
            </option>
          ))}
        </select>
      </div>

      {rider && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <div>
            <p className="font-semibold text-gray-900 dark:text-white">{rider.name}</p>
            <p className="text-sm text-gray-500">{rider.riderCode} · {rider.email}</p>
          </div>
          <div className="flex gap-2 text-xs">
            <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
              {rider.status}
            </span>
            <span className="rounded-full bg-gray-100 px-3 py-1 dark:bg-gray-800">
              {rider.isAvailable ? "Available" : "Unavailable"}
            </span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white p-12 text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading performance...
        </div>
      ) : selectedId ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat title="Total deliveries" value={deliveryTotal.toLocaleString()} detail={`${stats.active} in progress`} icon={Truck} />
            <Stat title="Delivered" value={stats.delivered.toLocaleString()} detail="Successfully completed" icon={CheckCircle2} />
            <Stat title="Failed deliveries" value={stats.failed.toLocaleString()} detail={`${stats.cancelled} cancelled`} icon={XCircle} />
            <Stat title="Completion rate" value={`${stats.completion.toFixed(1)}%`} detail="Delivered / (delivered + failed)" icon={TrendingUp} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat
              title="Recorded earnings"
              value={stats.currency ? money(stats.totalEarnings, stats.currency) : "Multiple currencies"}
              detail={`${earningTotal} earning records`}
              icon={Wallet}
            />
            <Stat
              title="Pending earnings"
              value={stats.currency ? money(stats.pending, stats.currency) : "Multiple currencies"}
              detail="Awaiting approval"
              icon={Clock3}
            />
            <Stat
              title="Approved earnings"
              value={stats.currency ? money(stats.approved, stats.currency) : "Multiple currencies"}
              detail="Awaiting payment"
              icon={CheckCircle2}
            />
            <Stat
              title="Paid earnings"
              value={stats.currency ? money(stats.paid, stats.currency) : "Multiple currencies"}
              detail="Marked as paid"
              icon={Wallet}
            />
          </div>

          {stats.currencies.length > 1 && (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Earnings include multiple currencies. Totals are not combined; inspect individual earning records for each currency.
            </p>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
              <h2 className="font-semibold text-gray-900 dark:text-white">
                Delivery status breakdown
              </h2>
              {stats.statuses.length ? (
                <div className="mt-4 space-y-3">
                  {stats.statuses.map(item => (
                    <div key={item.status}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span className="capitalize text-gray-600 dark:text-gray-300">
                          {item.status.replaceAll("_", " ")}
                        </span>
                        <span className="font-medium">{item.count}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                        <div
                          className="h-full rounded-full bg-blue-600"
                          style={{ width: `${deliveryTotal ? item.count / deliveryTotal * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-gray-500">No delivery records found.</p>
              )}
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
              <h2 className="font-semibold text-gray-900 dark:text-white">
                Delivery fee total
              </h2>
              <p className="mt-3 text-3xl font-bold text-gray-900 dark:text-white">
                {stats.feeCurrency
                  ? money(stats.deliveredFees, stats.feeCurrency)
                  : stats.feeCurrencies.length > 1
                    ? "Multiple currencies"
                    : money(0, "BDT")}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Sum of deliveryFee for delivered records. This is not rider commission or earnings.
              </p>
              <div className="mt-5 border-t border-gray-100 pt-4 dark:border-gray-800">
                <p className="text-sm text-gray-500">Latest delivery records</p>
                <div className="mt-2 space-y-2">
                  {deliveries.slice(0, 5).map(d => (
                    <div key={d._id} className="flex justify-between gap-3 text-sm">
                      <span className="truncate">{d.deliveryNumber}</span>
                      <span className="shrink-0 capitalize text-gray-500">
                        {d.status.replaceAll("_", " ")}
                      </span>
                    </div>
                  ))}
                  {!deliveries.length && (
                    <p className="text-sm text-gray-500">No deliveries yet.</p>
                  )}
                </div>
              </div>
            </section>
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900">
          {loadingRiders ? "Loading riders..." : "No rider found. Create a rider first."}
        </div>
      )}
    </div>
  );
}
