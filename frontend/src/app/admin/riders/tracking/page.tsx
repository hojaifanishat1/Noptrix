"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  Clock,
  ExternalLink,
  MapPin,
  RefreshCw,
  Search,
  Truck,
  User,
} from "lucide-react";

import apiClient from "@/services/api/client";
import { ridersApi, type Rider } from "@/services/api/riders.api";
import type { ApiResponse } from "@/types/api";

type TrackingStatus =
  | "PENDING"
  | "ASSIGNED"
  | "PICKED_UP"
  | "IN_TRANSIT"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "FAILED"
  | "CANCELLED";

interface TrackingRecord {
  _id: string;
  orderId: string | { _id: string };
  riderId?: string | {
    _id: string;
    name?: string;
    email?: string;
    phone?: string;
    riderCode?: string;
    status?: string;
  };
  status: TrackingStatus;
  currentLatitude?: number;
  currentLongitude?: number;
  currentAddress?: string;
  lastLocationAt?: string;
  estimatedDeliveryAt?: string;
  deliveredAt?: string;
  failedAt?: string;
  failureReason?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface TrackingPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

interface TrackingListResult {
  trackings: TrackingRecord[];
  pagination: TrackingPagination;
}

const STATUSES: TrackingStatus[] = [
  "PENDING",
  "ASSIGNED",
  "PICKED_UP",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "FAILED",
  "CANCELLED",
];

function getError(error: unknown): string {
  const value = error as {
    response?: { data?: { message?: string } };
    message?: string;
  };

  return (
    value.response?.data?.message ||
    value.message ||
    "Unable to load rider tracking records."
  );
}

function formatDate(value?: string): string {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not available";

  return date.toLocaleString();
}

function getId(value: string | { _id: string } | undefined): string {
  if (!value) return "—";
  return typeof value === "string" ? value : value._id;
}

function getStatusStyle(status: TrackingStatus): string {
  switch (status) {
    case "DELIVERED":
      return "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300";
    case "FAILED":
    case "CANCELLED":
      return "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300";
    case "IN_TRANSIT":
    case "OUT_FOR_DELIVERY":
    case "PICKED_UP":
      return "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300";
    case "ASSIGNED":
      return "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300";
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
  }
}

export default function RiderTrackingPage() {
  const [riders, setRiders] = useState<Rider[]>([]);
  const [selectedRiderId, setSelectedRiderId] = useState("");
  const [trackings, setTrackings] = useState<TrackingRecord[]>([]);
  const [pagination, setPagination] = useState<TrackingPagination | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loadingRiders, setLoadingRiders] = useState(true);
  const [loadingTracking, setLoadingTracking] = useState(false);
  const [error, setError] = useState("");

  const loadRiders = useCallback(async () => {
    setLoadingRiders(true);
    setError("");

    try {
      const result = await ridersApi.list({
        page: 1,
        limit: 100,
      });

      setRiders(result.riders || []);

      setSelectedRiderId((current) => {
        if (current && result.riders.some((rider) => rider._id === current)) {
          return current;
        }

        return result.riders[0]?._id || "";
      });
    } catch (err) {
      setError(getError(err));
    } finally {
      setLoadingRiders(false);
    }
  }, []);

  const loadTracking = useCallback(async () => {
    if (!selectedRiderId) {
      setTrackings([]);
      setPagination(null);
      return;
    }

    setLoadingTracking(true);
    setError("");

    try {
      const response = await apiClient.get<ApiResponse<TrackingListResult>>(
        "/tracking",
        {
          params: {
            riderId: selectedRiderId,
            page: 1,
            limit: 100,
          },
        },
      );

      const result = response.data.data;

      setTrackings(result?.trackings || []);
      setPagination(result?.pagination || null);
    } catch (err) {
      setError(getError(err));
      setTrackings([]);
      setPagination(null);
    } finally {
      setLoadingTracking(false);
    }
  }, [selectedRiderId]);

  useEffect(() => {
    void loadRiders();
  }, [loadRiders]);

  useEffect(() => {
    void loadTracking();
  }, [loadTracking]);

  const selectedRider = useMemo(
    () => riders.find((rider) => rider._id === selectedRiderId),
    [riders, selectedRiderId],
  );

  const filteredTrackings = useMemo(() => {
    const query = search.trim().toLowerCase();

    return trackings.filter((tracking) => {
      const matchesStatus =
        !statusFilter || tracking.status === statusFilter;

      const orderId = getId(tracking.orderId);

      const matchesSearch =
        !query ||
        orderId.toLowerCase().includes(query) ||
        (tracking.currentAddress || "").toLowerCase().includes(query) ||
        tracking.status.toLowerCase().includes(query);

      return matchesStatus && matchesSearch;
    });
  }, [trackings, search, statusFilter]);

  const counts = useMemo(() => {
    return {
      total: trackings.length,
      active: trackings.filter((item) =>
        ["ASSIGNED", "PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY"].includes(
          item.status,
        ),
      ).length,
      delivered: trackings.filter((item) => item.status === "DELIVERED").length,
      failed: trackings.filter((item) =>
        ["FAILED", "CANCELLED"].includes(item.status),
      ).length,
      located: trackings.filter(
        (item) =>
          typeof item.currentLatitude === "number" &&
          typeof item.currentLongitude === "number",
      ).length,
    };
  }, [trackings]);

  const refresh = async () => {
    await loadRiders();
    await loadTracking();
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Rider Tracking
            </h1>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Monitor assigned deliveries and the latest location reported by riders.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loadingRiders || loadingTracking}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
        >
          <RefreshCw
            className={`h-4 w-4 ${
              loadingRiders || loadingTracking ? "animate-spin" : ""
            }`}
          />
          Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <label
          htmlFor="rider-select"
          className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Select rider
        </label>

        <div className="flex flex-col gap-3 sm:flex-row">
          <select
            id="rider-select"
            value={selectedRiderId}
            onChange={(event) => setSelectedRiderId(event.target.value)}
            disabled={loadingRiders || !riders.length}
            className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
          >
            <option value="">
              {loadingRiders ? "Loading riders..." : "Select a rider"}
            </option>

            {riders.map((rider) => (
              <option key={rider._id} value={rider._id}>
                {rider.name} — {rider.riderCode}
              </option>
            ))}
          </select>

          {selectedRider && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <User className="h-4 w-4" />
              <span>{selectedRider.email}</span>
              <span
                className={`rounded-full px-2 py-1 text-xs font-semibold ${
                  selectedRider.status === "ACTIVE"
                    ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300"
                    : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                }`}
              >
                {selectedRider.status}
              </span>
            </div>
          )}
        </div>
      </section>

      {selectedRider && (
        <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
                <MapPin className="h-5 w-5 text-blue-600" />
                Rider current GPS location
              </h2>
              <p className="mt-1 text-xs text-gray-500">
                {selectedRider.name} · {selectedRider.riderCode}
              </p>
            </div>

            <span
              className={`w-fit rounded-full px-3 py-1.5 text-xs font-semibold ${
                selectedRider.isAvailable
                  ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300"
                  : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
              }`}
            >
              {selectedRider.isAvailable ? "ONLINE / AVAILABLE" : "OFFLINE / UNAVAILABLE"}
            </span>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-950">
              <p className="text-xs text-gray-500">Current place / address</p>
              <p className="mt-2 break-words text-sm font-medium text-gray-900 dark:text-white">
                {selectedRider.currentAddress || "Address not available yet"}
              </p>
              <p className="mt-3 text-xs text-gray-500">GPS coordinates</p>
              {typeof selectedRider.currentLatitude === "number" &&
              typeof selectedRider.currentLongitude === "number" ? (
                <>
                  <p className="mt-2 break-all text-sm font-medium text-gray-900 dark:text-white">
                    {selectedRider.currentLatitude}, {selectedRider.currentLongitude}
                  </p>
                  <a
                    href={`https://www.google.com/maps?q=${selectedRider.currentLatitude},${selectedRider.currentLongitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-white dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-900"
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    Open current location in Maps
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </>
              ) : (
                <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
                  No GPS location received yet. Rider must allow GPS and update location.
                </p>
              )}
            </div>

            <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-950">
              <p className="text-xs text-gray-500">Last GPS update</p>
              <p className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                {formatDate(selectedRider.lastLocationAt)}
              </p>
              <p className="mt-3 text-xs text-gray-500">
                Onboarding: {selectedRider.onboardingStatus || "Not available"}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Account status: {selectedRider.status}
              </p>
            </div>
          </div>

          <p className="mt-3 text-xs text-gray-500">
            Location is the latest GPS position saved by the Rider account. Use Refresh to fetch the latest server data.
          </p>
        </section>
      )}

      {selectedRiderId && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {[
              {
                label: "Total records",
                value: counts.total,
                icon: Truck,
              },
              {
                label: "Active deliveries",
                value: counts.active,
                icon: Activity,
              },
              {
                label: "Delivered",
                value: counts.delivered,
                icon: MapPin,
              },
              {
                label: "Failed / Cancelled",
                value: counts.failed,
                icon: AlertCircle,
              },
              {
                label: "With coordinates",
                value: counts.located,
                icon: MapPin,
              },
            ].map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.label}
                  className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-gray-500">{item.label}</p>
                    <Icon className="h-4 w-4 text-gray-400" />
                  </div>
                  <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
                    {item.value}
                  </p>
                </div>
              );
            })}
          </div>

          <section className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
            <div className="flex flex-col gap-3 border-b border-gray-100 p-4 dark:border-gray-800 sm:flex-row">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search order ID or address..."
                  className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
              >
                <option value="">All statuses</option>
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <h2 className="font-semibold text-gray-900 dark:text-white">
                Rider delivery locations
              </h2>
              <span className="text-xs text-gray-500">
                {pagination?.total ?? trackings.length} records
              </span>
            </div>

            {loadingTracking ? (
              <div className="flex items-center justify-center gap-2 p-12 text-sm text-gray-500">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Loading tracking records...
              </div>
            ) : filteredTrackings.length === 0 ? (
              <div className="p-12 text-center">
                <Truck className="mx-auto h-9 w-9 text-gray-300" />
                <p className="mt-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                  No tracking records found
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  This rider has no matching tracking records.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredTrackings.map((tracking) => {
                  const hasCoordinates =
                    typeof tracking.currentLatitude === "number" &&
                    typeof tracking.currentLongitude === "number";

                  const mapUrl = hasCoordinates
                    ? `https://www.google.com/maps?q=${tracking.currentLatitude},${tracking.currentLongitude}`
                    : "";

                  return (
                    <article
                      key={tracking._id}
                      className="space-y-3 p-4"
                    >
                      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                        <div className="min-w-0">
                          <p className="break-all text-sm font-semibold text-gray-900 dark:text-white">
                            Order: {getId(tracking.orderId)}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            Tracking ID: {tracking._id}
                          </p>
                        </div>

                        <span
                          className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusStyle(
                            tracking.status,
                          )}`}
                        >
                          {tracking.status.replaceAll("_", " ")}
                        </span>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="flex min-w-0 gap-2">
                          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                          <div className="min-w-0">
                            <p className="text-xs text-gray-500">Last known location</p>
                            <p className="mt-1 break-words text-sm text-gray-800 dark:text-gray-200">
                              {tracking.currentAddress || "No address reported"}
                            </p>

                            {hasCoordinates && (
                              <p className="mt-1 break-all text-xs text-gray-500">
                                {tracking.currentLatitude}, {tracking.currentLongitude}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                          <div>
                            <p className="text-xs text-gray-500">
                              Last location update
                            </p>
                            <p className="mt-1 text-sm text-gray-800 dark:text-gray-200">
                              {formatDate(tracking.lastLocationAt)}
                            </p>
                            <p className="mt-2 text-xs text-gray-500">
                              Estimated delivery:{" "}
                              {formatDate(tracking.estimatedDeliveryAt)}
                            </p>
                          </div>
                        </div>
                      </div>

                      {(tracking.failureReason || tracking.cancellationReason) && (
                        <p className="rounded-lg bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-300">
                          {tracking.failureReason || tracking.cancellationReason}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
                        <span className="text-xs text-gray-500">
                          Updated: {formatDate(tracking.updatedAt)}
                        </span>

                        {hasCoordinates ? (
                          <a
                            href={mapUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                          >
                            <MapPin className="h-3.5 w-3.5" />
                            Open in Google Maps
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400">
                            Location coordinates unavailable
                          </span>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <p className="text-xs text-gray-500">
            Location information reflects the latest coordinates reported to the
            tracking service. This page does not continuously stream GPS updates.
          </p>
        </>
      )}

      {!loadingRiders && riders.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500 dark:border-gray-700">
          No riders found. Create a rider first.
        </div>
      )}
    </div>
  );
}
