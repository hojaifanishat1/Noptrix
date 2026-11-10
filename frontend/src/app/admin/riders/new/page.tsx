
"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bike,
  Save,
  UserPlus,
} from "lucide-react";

import apiClient from "@/services/api/client";

type RiderType = "INTERNAL" | "CONTRACT" | "FREELANCE";

interface RiderForm {
  userId: string;
  riderCode: string;
  type: RiderType;
  name: string;
  email: string;
  phone: string;
  vehicleType: string;
  vehicleNumber: string;
  licenseNumber: string;
  nationalId: string;
  joinedAt: string;
  notes: string;
}

const INITIAL_FORM: RiderForm = {
  userId: "",
  riderCode: "",
  type: "INTERNAL",
  name: "",
  email: "",
  phone: "",
  vehicleType: "",
  vehicleNumber: "",
  licenseNumber: "",
  nationalId: "",
  joinedAt: "",
  notes: "",
};

function getErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error
  ) {
    const response = (
      error as {
        response?: { data?: { message?: string } };
      }
    ).response;

    if (response?.data?.message) {
      return response.data.message;
    }
  }

  return error instanceof Error
    ? error.message
    : "Something went wrong.";
}

const inputClass =
  "mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200";

const labelClass =
  "block text-sm font-medium text-slate-700";

export default function NewRiderPage() {
  const router = useRouter();

  const [form, setForm] = useState<RiderForm>(INITIAL_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const updateField = <K extends keyof RiderForm>(
    field: K,
    value: RiderForm[K],
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!/^[a-f\d]{24}$/i.test(form.userId.trim())) {
      setError("Enter a valid 24-character User ID.");
      return;
    }

    if (!form.riderCode.trim()) {
      setError("Rider code is required.");
      return;
    }

    setLoading(true);

    try {
      await apiClient.post("/riders", {
        userId: form.userId.trim(),
        riderCode: form.riderCode.trim().toUpperCase(),
        type: form.type,
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        ...(form.phone.trim()
          ? { phone: form.phone.trim() }
          : {}),
        ...(form.vehicleType
          ? { vehicleType: form.vehicleType }
          : {}),
        ...(form.vehicleNumber.trim()
          ? { vehicleNumber: form.vehicleNumber.trim() }
          : {}),
        ...(form.licenseNumber.trim()
          ? { licenseNumber: form.licenseNumber.trim() }
          : {}),
        ...(form.nationalId.trim()
          ? { nationalId: form.nationalId.trim() }
          : {}),
        ...(form.joinedAt
          ? { joinedAt: new Date(form.joinedAt).toISOString() }
          : {}),
        ...(form.notes.trim()
          ? { notes: form.notes.trim() }
          : {}),
      });

      router.push("/admin/riders");
      router.refresh();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      {/* Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/admin/riders"
            className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Riders
          </Link>

          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-slate-100 p-3">
              <Bike className="h-6 w-6 text-slate-700" />
            </div>

            <div>
              <h1 className="text-2xl font-bold text-slate-950">
                Add New Rider
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Create a Rider profile for an existing User account.
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Notice */}
      <div className="flex gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
        <UserPlus className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
        <div>
          <p className="text-sm font-semibold text-blue-900">
            Existing User account required
          </p>
          <p className="mt-1 text-sm text-blue-800">
            Enter the User ID and profile information. A new Rider will
            be created with PENDING status and must be verified before
            activation.
          </p>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Account information */}
        <section className="rounded-xl border bg-white p-5 sm:p-6">
          <div className="mb-5">
            <h2 className="text-base font-bold text-slate-900">
              User Account
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Link the Rider profile to an existing customer User account.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5">
            <div>
              <label htmlFor="userId" className={labelClass}>
                User ID <span className="text-red-500">*</span>
              </label>
              <input
                id="userId"
                required
                value={form.userId}
                onChange={(event) =>
                  updateField("userId", event.target.value)
                }
                placeholder="Enter 24-character MongoDB User ID"
                className={inputClass}
              />
              <p className="mt-1 text-xs text-slate-500">
                This must belong to an existing User account not already
                linked to a Rider.
              </p>
            </div>
          </div>
        </section>

        {/* Basic information */}
        <section className="rounded-xl border bg-white p-5 sm:p-6">
          <div className="mb-5">
            <h2 className="text-base font-bold text-slate-900">
              Basic Information
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Rider identity and contact details.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="riderCode" className={labelClass}>
                Rider Code <span className="text-red-500">*</span>
              </label>
              <input
                id="riderCode"
                required
                minLength={3}
                maxLength={50}
                value={form.riderCode}
                onChange={(event) =>
                  updateField(
                    "riderCode",
                    event.target.value.toUpperCase(),
                  )
                }
                placeholder="e.g. RID-0001"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="type" className={labelClass}>
                Rider Type <span className="text-red-500">*</span>
              </label>
              <select
                id="type"
                required
                value={form.type}
                onChange={(event) =>
                  updateField(
                    "type",
                    event.target.value as RiderType,
                  )
                }
                className={inputClass}
              >
                <option value="INTERNAL">Internal</option>
                <option value="CONTRACT">Contract</option>
                <option value="FREELANCE">Freelance</option>
              </select>
            </div>

            <div>
              <label htmlFor="name" className={labelClass}>
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                required
                minLength={2}
                maxLength={150}
                value={form.name}
                onChange={(event) =>
                  updateField("name", event.target.value)
                }
                placeholder="Rider full name"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="email" className={labelClass}>
                Email <span className="text-red-500">*</span>
              </label>
              <input
                id="email"
                type="email"
                required
                maxLength={254}
                value={form.email}
                onChange={(event) =>
                  updateField("email", event.target.value)
                }
                placeholder="rider@example.com"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="phone" className={labelClass}>
                Phone
              </label>
              <input
                id="phone"
                type="tel"
                maxLength={30}
                value={form.phone}
                onChange={(event) =>
                  updateField("phone", event.target.value)
                }
                placeholder="Phone number"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="joinedAt" className={labelClass}>
                Joining Date
              </label>
              <input
                id="joinedAt"
                type="date"
                value={form.joinedAt}
                onChange={(event) =>
                  updateField("joinedAt", event.target.value)
                }
                className={inputClass}
              />
            </div>
          </div>
        </section>

        {/* Vehicle information */}
        <section className="rounded-xl border bg-white p-5 sm:p-6">
          <div className="mb-5">
            <h2 className="text-base font-bold text-slate-900">
              Vehicle Information
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Vehicle and registration information.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="vehicleType" className={labelClass}>
                Vehicle Type
              </label>
              <select
                id="vehicleType"
                value={form.vehicleType}
                onChange={(event) =>
                  updateField("vehicleType", event.target.value)
                }
                className={inputClass}
              >
                <option value="">Select vehicle</option>
                <option value="MOTORCYCLE">Motorcycle</option>
                <option value="CAR">Car</option>
                <option value="BICYCLE">Bicycle</option>
                <option value="VAN">Van</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div>
              <label htmlFor="vehicleNumber" className={labelClass}>
                Vehicle Registration Number
              </label>
              <input
                id="vehicleNumber"
                maxLength={50}
                value={form.vehicleNumber}
                onChange={(event) =>
                  updateField("vehicleNumber", event.target.value)
                }
                placeholder="Vehicle registration"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="licenseNumber" className={labelClass}>
                Driving License Number
              </label>
              <input
                id="licenseNumber"
                maxLength={100}
                value={form.licenseNumber}
                onChange={(event) =>
                  updateField("licenseNumber", event.target.value)
                }
                placeholder="License number"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="nationalId" className={labelClass}>
                National ID
              </label>
              <input
                id="nationalId"
                maxLength={100}
                value={form.nationalId}
                onChange={(event) =>
                  updateField("nationalId", event.target.value)
                }
                placeholder="National ID number"
                className={inputClass}
              />
            </div>
          </div>
        </section>

        {/* Notes */}
        <section className="rounded-xl border bg-white p-5 sm:p-6">
          <h2 className="mb-1 text-base font-bold text-slate-900">
            Internal Notes
          </h2>
          <p className="mb-4 text-sm text-slate-500">
            Optional information for Owner and management.
          </p>

          <textarea
            rows={4}
            maxLength={5000}
            value={form.notes}
            onChange={(event) =>
              updateField("notes", event.target.value)
            }
            placeholder="Write internal notes..."
            className="w-full rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
          />
        </section>

        {/* Actions */}
        <div className="flex flex-col-reverse justify-end gap-3 sm:flex-row">
          <Link
            href="/admin/riders"
            className="inline-flex h-11 items-center justify-center rounded-lg border px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </Link>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-slate-900 px-6 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {loading ? "Creating Rider..." : "Create Rider"}
          </button>
        </div>
      </form>
    </div>
  );
}
