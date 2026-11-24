"use client";

import { useCallback, useEffect, useState } from "react";
import { isAxiosError } from "axios";

import {
  riderAuthApi,
  type RiderProfile,
} from "@/services/api/rider-auth.api";

export default function RiderDashboardPage() {
  const [profile, setProfile] = useState<RiderProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadProfile = useCallback(async () => {
    const result = await riderAuthApi.getMe();
    setProfile(result);
  }, []);

  useEffect(() => {
    let mounted = true;

    riderAuthApi.getMe()
      .then((result) => {
        if (mounted) setProfile(result);
      })
      .catch((err: unknown) => {
        if (mounted) {
          setError(
            isAxiosError(err)
              ? err.response?.data?.message ?? "Could not load rider profile."
              : "Could not load rider profile.",
          );
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const updateAvailability = async (available: boolean) => {
    setWorking(true);
    setError("");
    setMessage("");

    try {
      if (available) {
        if (!navigator.geolocation) {
          throw new Error("GPS is not supported by this device or browser.");
        }

        const position = await new Promise<GeolocationPosition>(
          (resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 15000,
              maximumAge: 0,
            });
          },
        );

        await riderAuthApi.updateLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      }

      const updated = await riderAuthApi.updateAvailability(available);
      setProfile((current) => current ? { ...current, ...updated } : updated);
      setMessage(
        available
          ? "You are now online and available for deliveries."
          : "You are now offline.",
      );
    } catch (err: unknown) {
      let detail = "Could not update rider availability.";

      if (isAxiosError(err)) {
        detail = err.response?.data?.message ?? err.message;
      } else if (err instanceof GeolocationPositionError) {
        detail =
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied. Allow location access in your device settings."
            : err.code === err.TIMEOUT
              ? "Could not get GPS location in time. Try again in an open area."
              : "Current location is unavailable. Turn on device location and try again.";
      } else if (err instanceof Error) {
        detail = err.message;
      }

      setError(detail);
      try {
        await loadProfile();
      } catch {
        // Keep the original availability error visible.
      }
    } finally {
      setWorking(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-slate-500">Loading dashboard...</p>;
  }

  if (error && !profile) {
    return (
      <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  const status = profile?.riderStatus ?? "UNKNOWN";
  const onboardingComplete = profile?.onboardingStatus === "COMPLETED";
  const active = status === "ACTIVE";
  const available = profile?.isAvailable === true;
  const canGoOnline = active && onboardingComplete;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Dashboard</h2>
        <p className="mt-1 text-sm text-slate-500">
          Welcome back, {profile?.name || "Rider"}.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Rider code</p>
          <p className="mt-2 text-xl font-bold text-slate-900">
            {profile?.riderCode || "Not assigned"}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Account status</p>
          <p className="mt-2 text-xl font-bold text-slate-900">{status}</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Availability</p>
          <p className={`mt-2 text-xl font-bold ${available ? "text-emerald-700" : "text-slate-700"}`}>
            {available ? "Available" : "Unavailable"}
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-semibold text-slate-900">Delivery availability</h3>
            <p className="mt-1 text-sm text-slate-500">
              {available
                ? "You are online and can receive delivery assignments."
                : "Go online when you are ready to receive delivery assignments."}
            </p>
          </div>

          <button
            type="button"
            disabled={working || (!available && !canGoOnline)}
            onClick={() => void updateAvailability(!available)}
            className={`rounded-lg px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${
              available
                ? "bg-slate-700 hover:bg-slate-800"
                : "bg-emerald-600 hover:bg-emerald-700"
            }`}
          >
            {working ? "Please wait..." : available ? "Go Offline" : "Go Online"}
          </button>
        </div>

        {!active && (
          <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            Your rider account must be ACTIVE before you can go online.
          </p>
        )}

        {active && !onboardingComplete && (
          <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            Complete your onboarding and document verification before going online.
            <a href="/rider-panel/verification" className="ml-1 font-semibold underline">
              Complete verification
            </a>
          </p>
        )}

        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {message && (
          <p role="status" className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
            {message}
          </p>
        )}

        <p className="mt-3 text-xs text-slate-500">
          Going online shares your current GPS coordinates with NOPTRIX for delivery assignment.
          Location must be refreshed within five minutes.
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h3 className="font-semibold text-slate-900">Rider information</h3>
        <dl className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-slate-500">Full name</dt>
            <dd className="mt-1 text-sm font-medium text-slate-900">{profile?.name || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Email</dt>
            <dd className="mt-1 text-sm font-medium text-slate-900">{profile?.email || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Phone</dt>
            <dd className="mt-1 text-sm font-medium text-slate-900">{profile?.phone || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Vehicle</dt>
            <dd className="mt-1 text-sm font-medium text-slate-900">{profile?.vehicleType || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Vehicle number</dt>
            <dd className="mt-1 text-sm font-medium text-slate-900">{profile?.vehicleNumber || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Onboarding</dt>
            <dd className="mt-1 text-sm font-medium text-slate-900">{profile?.onboardingStatus || "—"}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
