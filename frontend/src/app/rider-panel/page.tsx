"use client";

import { useEffect, useState } from "react";
import { isAxiosError } from "axios";

import {
  riderAuthApi,
  type RiderProfile,
} from "@/services/api/rider-auth.api";

export default function RiderDashboardPage() {
  const [profile, setProfile] = useState<RiderProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    const loadProfile = async () => {
      try {
        const result = await riderAuthApi.getMe();

        if (mounted) {
          setProfile(result);
        }
      } catch (err: unknown) {
        if (mounted) {
          setError(
            isAxiosError(err)
              ? err.response?.data?.message ?? "Could not load rider profile."
              : "Could not load rider profile.",
          );
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void loadProfile();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return <p className="text-sm text-slate-500">Loading dashboard...</p>;
  }

  if (error) {
    return (
      <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  const status = profile?.riderStatus ?? "UNKNOWN";

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
          <p className="mt-2 text-xl font-bold text-slate-900">
            {status}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Availability</p>
          <p className="mt-2 text-xl font-bold text-slate-900">
            {profile?.riderStatus === "ACTIVE" ? "Active account" : "Not active"}
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h3 className="font-semibold text-slate-900">Rider information</h3>

        <dl className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-slate-500">Full name</dt>
            <dd className="mt-1 text-sm font-medium text-slate-900">
              {profile?.name || "—"}
            </dd>
          </div>

          <div>
            <dt className="text-xs text-slate-500">Email</dt>
            <dd className="mt-1 text-sm font-medium text-slate-900">
              {profile?.email || "—"}
            </dd>
          </div>

          <div>
            <dt className="text-xs text-slate-500">Phone</dt>
            <dd className="mt-1 text-sm font-medium text-slate-900">
              {profile?.phone || "—"}
            </dd>
          </div>

          <div>
            <dt className="text-xs text-slate-500">Vehicle</dt>
            <dd className="mt-1 text-sm font-medium text-slate-900">
              {profile?.vehicleType || "—"}
            </dd>
          </div>

          <div>
            <dt className="text-xs text-slate-500">Vehicle number</dt>
            <dd className="mt-1 text-sm font-medium text-slate-900">
              {profile?.vehicleNumber || "—"}
            </dd>
          </div>
        </dl>
      </section>

      {status === "PENDING" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Your rider account is waiting for Owner activation. You will get delivery access after activation.
        </div>
      )}
    </div>
  );
}
