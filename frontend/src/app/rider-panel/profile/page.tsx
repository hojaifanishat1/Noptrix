"use client";

import { useCallback, useEffect, useState } from "react";
import {
  UserRound,
  Mail,
  Phone,
  Bike,
  ShieldCheck,
  RefreshCw,
  Save,
  IdCard,
} from "lucide-react";

import apiClient from "@/services/api/client";
import { riderAuthApi, type RiderProfile } from "@/services/api/rider-auth.api";
import type { ApiResponse } from "@/types/api";

type ProfileForm = {
  name: string;
  phone: string;
  vehicleType: string;
  vehicleNumber: string;
  licenseNumber: string;
  nationalId: string;
};

const EMPTY_FORM: ProfileForm = {
  name: "",
  phone: "",
  vehicleType: "",
  vehicleNumber: "",
  licenseNumber: "",
  nationalId: "",
};

const VEHICLE_TYPES = [
  { value: "MOTORCYCLE", label: "Motorcycle" },
  { value: "CAR", label: "Car" },
  { value: "BICYCLE", label: "Bicycle" },
  { value: "VAN", label: "Van" },
  { value: "OTHER", label: "Other" },
];

function getErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error
  ) {
    const response = error.response;

    if (
      typeof response === "object" &&
      response !== null &&
      "data" in response
    ) {
      const data = response.data;

      if (
        typeof data === "object" &&
        data !== null &&
        "message" in data &&
        typeof data.message === "string"
      ) {
        return data.message;
      }
    }
  }

  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  disabled,
  required,
  type = "text",
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-semibold text-slate-700">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
      />
    </label>
  );
}

export default function RiderProfilePage() {
  const [profile, setProfile] = useState<RiderProfile | null>(null);
  const [form, setForm] = useState<ProfileForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);

  const isOnboardingComplete =
    profile?.onboardingStatus === "COMPLETED";

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const rider = await riderAuthApi.getMe();

      setProfile(rider);
      setAvatarUrl(rider.avatarUrl || "");
      setForm({
        name: rider.name ?? "",
        phone: rider.phone ?? "",
        vehicleType: rider.vehicleType ?? "",
        vehicleNumber: rider.vehicleNumber ?? "",
        licenseNumber: "",
        nationalId: "",
      });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const handleAvatarChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("Image size must not exceed 10 MB.");
      return;
    }

    setError("");
    setSuccess("");
    setAvatarUploading(true);

    try {
      const uploadedUrl = await riderAuthApi.uploadAvatar(file);
      setAvatarUrl(uploadedUrl);
      setSuccess("Profile picture updated successfully.");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setAvatarUploading(false);
    }
  };

  const updateField = (field: keyof ProfileForm, value: string) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isOnboardingComplete) return;

    setError("");
    setSuccess("");

    if (
      !form.name.trim() ||
      !form.phone.trim() ||
      !form.vehicleType ||
      !form.vehicleNumber.trim() ||
      !form.licenseNumber.trim() ||
      !form.nationalId.trim()
    ) {
      setError("Please complete all required profile fields.");
      return;
    }

    setSaving(true);

    try {
      await apiClient.patch<
        ApiResponse<{
          profile: {
            id: string;
            name: string;
            phone?: string;
            vehicleType?: string;
            vehicleNumber?: string;
            onboardingStatus: string;
          };
        }>
      >("/onboarding/rider/profile", {
        name: form.name.trim(),
        phone: form.phone.trim(),
        vehicleType: form.vehicleType,
        vehicleNumber: form.vehicleNumber.trim(),
        licenseNumber: form.licenseNumber.trim(),
        nationalId: form.nationalId.trim(),
      });

      setSuccess("Profile updated successfully.");
      await loadProfile();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
        Loading rider profile...
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
        <p className="text-sm text-red-700">
          {error || "Unable to load rider profile."}
        </p>
        <button
          type="button"
          onClick={() => void loadProfile()}
          className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
        >
          Try again
        </button>
      </div>
    );
  }

  const onboardingLabel =
    profile.onboardingStatus === "COMPLETED"
      ? "Completed"
      : profile.onboardingStatus === "IN_PROGRESS"
        ? "In progress"
        : "Not started";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-slate-100 p-3 text-slate-700">
            <UserRound className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              My Profile
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Manage your personal and vehicle information.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void loadProfile()}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </header>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700"
        >
          {success}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-xl font-bold text-slate-700">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Rider profile"
                  className="h-full w-full object-cover"
                />
              ) : (
                (profile.name || "R").charAt(0).toUpperCase()
              )}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {profile.name || "Rider"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {profile.riderCode || "Rider code not assigned"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700">
              Account: {profile.riderStatus || "Unknown"}
            </span>
            <span
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                isOnboardingComplete
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-amber-200 bg-amber-50 text-amber-700"
              }`}
            >
              Onboarding: {onboardingLabel}
            </span>
          </div>
        </div>
      </section>

      {isOnboardingComplete && (
        <div className="flex gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
          <p>
            Your onboarding is completed. Profile editing is locked.
            Contact the administration if your information needs to be changed.
          </p>
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-slate-100 bg-slate-100 text-3xl font-bold text-slate-600">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Rider profile picture"
                className="h-full w-full object-cover"
              />
            ) : (
              (profile.name || "R").charAt(0).toUpperCase()
            )}
          </div>

          <div className="flex-1 text-center sm:text-left">
            <h2 className="font-bold text-slate-900">Profile picture</h2>
            <p className="mt-1 text-sm text-slate-500">
              Upload a clear photo so your identity is recognizable.
            </p>
            <label className={`mt-3 inline-flex cursor-pointer items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 ${avatarUploading ? "pointer-events-none opacity-60" : ""}`}>
              {avatarUploading ? "Uploading..." : avatarUrl ? "Change picture" : "Upload picture"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                className="hidden"
                disabled={avatarUploading}
                onChange={handleAvatarChange}
              />
            </label>
            <p className="mt-2 text-xs text-slate-400">
              JPG, PNG, WEBP or AVIF · Maximum 10 MB
            </p>
          </div>
        </div>
      </section>

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <UserRound className="h-5 w-5 text-slate-500" />
            <div>
              <h2 className="font-bold text-slate-900">
                Personal information
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Your registered rider identity.
              </p>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Full name"
              value={form.name}
              onChange={(value) => updateField("name", value)}
              placeholder="Enter your full name"
              disabled={isOnboardingComplete}
              required
            />

            <Field
              label="Email address"
              value={profile.email || ""}
              disabled
            />

            <Field
              label="Phone number"
              value={form.phone}
              onChange={(value) => updateField("phone", value)}
              placeholder="Enter phone number"
              disabled={isOnboardingComplete}
              required
              type="tel"
            />

            <Field
              label="Rider code"
              value={profile.riderCode || "Not assigned"}
              disabled
            />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <Bike className="h-5 w-5 text-slate-500" />
            <div>
              <h2 className="font-bold text-slate-900">
                Vehicle information
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Details used for rider verification.
              </p>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-slate-700">
                Vehicle type <span className="text-red-500">*</span>
              </span>
              <select
                value={form.vehicleType}
                onChange={(event) =>
                  updateField("vehicleType", event.target.value)
                }
                disabled={isOnboardingComplete}
                required
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500 disabled:bg-slate-100"
              >
                <option value="">Select vehicle type</option>
                {VEHICLE_TYPES.map((vehicle) => (
                  <option key={vehicle.value} value={vehicle.value}>
                    {vehicle.label}
                  </option>
                ))}
              </select>
            </label>

            <Field
              label="Vehicle number"
              value={form.vehicleNumber}
              onChange={(value) => updateField("vehicleNumber", value)}
              placeholder="Enter vehicle registration number"
              disabled={isOnboardingComplete}
              required
            />

            <Field
              label="Driving license number"
              value={form.licenseNumber}
              onChange={(value) => updateField("licenseNumber", value)}
              placeholder="Enter driving license number"
              disabled={isOnboardingComplete}
              required
            />

            <Field
              label="National ID number"
              value={form.nationalId}
              onChange={(value) => updateField("nationalId", value)}
              placeholder="Enter national ID number"
              disabled={isOnboardingComplete}
              required
            />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <IdCard className="mt-0.5 h-5 w-5 text-slate-500" />
            <div>
              <h2 className="font-bold text-slate-900">
                Verification information
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Your identity documents are managed separately in the
                Verification section.
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-600">
            <span className="rounded-lg bg-slate-100 px-3 py-2">
              National ID
            </span>
            <span className="rounded-lg bg-slate-100 px-3 py-2">
              Driving license
            </span>
            <span className="rounded-lg bg-slate-100 px-3 py-2">
              Vehicle registration
            </span>
            <span className="rounded-lg bg-slate-100 px-3 py-2">
              Vehicle insurance
            </span>
          </div>
        </section>

        {!isOnboardingComplete && (
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving profile..." : "Save profile"}
            </button>
          </div>
        )}
      </form>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-600">
        <Mail className="mr-2 inline h-4 w-4" />
        Email address and rider code are managed by administration.
        <Phone className="mx-2 inline h-4 w-4" />
        Keep your phone number up to date for delivery communication.
      </div>
    </div>
  );
}
