"use client";

import { useState } from "react";
import { isAxiosError } from "axios";
import { ridersApi, type Rider } from "@/services/api/riders.api";

export default function RiderProfileCompletionForm({
  rider,
  onSaved,
}: {
  rider: Rider;
  onSaved: () => void;
}) {
  const [phone, setPhone] = useState(rider.phone ?? "");
  const [vehicleNumber, setVehicleNumber] = useState(rider.vehicleNumber ?? "");
  const [licenseNumber, setLicenseNumber] = useState(rider.licenseNumber ?? "");
  const [nationalId, setNationalId] = useState(rider.nationalId ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const save = async () => {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const updated = await ridersApi.updateProfile(rider._id, {
        phone: phone.trim(),
        vehicleNumber: vehicleNumber.trim(),
        licenseNumber: licenseNumber.trim(),
        nationalId: nationalId.trim(),
      });

      setMessage(
        updated.onboardingStatus === "COMPLETED"
          ? "Profile saved. Rider onboarding is now COMPLETED."
          : "Profile saved. Complete the remaining required details and document approvals.",
      );
      onSaved();
    } catch (err) {
      setError(
        isAxiosError<{ message?: string }>(err)
          ? err.response?.data?.message ?? err.message
          : err instanceof Error
            ? err.message
            : "Could not save rider profile.",
      );
    } finally {
      setSaving(false);
    }
  };

  const fieldClass =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500";

  return (
    <section className="mt-4 rounded-xl border border-amber-200 bg-amber-50/50 p-4">
      <h4 className="font-semibold text-slate-900">
        Complete rider profile
      </h4>
      <p className="mt-1 text-xs text-slate-600">
        Enter the actual details from the rider. Approved document files do not automatically provide these profile values.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-xs font-medium text-slate-700">
          Phone number
          <input className={fieldClass} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Rider phone number" />
        </label>

        <label className="space-y-1 text-xs font-medium text-slate-700">
          Vehicle number
          <input className={fieldClass} value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} placeholder="Vehicle registration number" />
        </label>

        <label className="space-y-1 text-xs font-medium text-slate-700">
          Driving license number
          <input className={fieldClass} value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} placeholder="License number" />
        </label>

        <label className="space-y-1 text-xs font-medium text-slate-700">
          National ID number
          <input className={fieldClass} value={nationalId} onChange={(e) => setNationalId(e.target.value)} placeholder="National ID number" />
        </label>
      </div>

      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      {message && <p role="status" className="mt-3 text-sm text-emerald-700">{message}</p>}

      <button
        type="button"
        onClick={() => void save()}
        disabled={saving}
        className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save profile details"}
      </button>
    </section>
  );
}
