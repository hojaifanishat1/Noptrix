"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  Store,
  XCircle,
} from "lucide-react";

import {
  sellerApplicationsApi,
  type CreateSellerApplicationInput,
  type SellerApplication,
  type SellerApplicationType,
} from "@/services/api/seller-applications.api";

const initialForm: CreateSellerApplicationInput = {
  businessName: "",
  legalName: "",
  type: "BUSINESS",
  email: "",
  phone: "",
  taxNumber: "",
  registrationNumber: "",
  description: "",
  logoUrl: "",
  website: "",
  address: "",
  city: "",
  country: "",
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

    if (response?.data?.message) return response.data.message;
  }

  return error instanceof Error ? error.message : "Something went wrong.";
}

function statusStyle(status: SellerApplication["status"]) {
  const styles: Record<SellerApplication["status"], string> = {
    SUBMITTED: "bg-blue-100 text-blue-800",
    UNDER_REVIEW: "bg-amber-100 text-amber-800",
    APPROVED: "bg-green-100 text-green-800",
    REJECTED: "bg-red-100 text-red-800",
    WITHDRAWN: "bg-gray-100 text-gray-700",
  };

  return styles[status];
}

function Field({
  label,
  name,
  value,
  onChange,
  required = false,
  type = "text",
  placeholder,
}: {
  label: string;
  name: keyof CreateSellerApplicationInput;
  value: string;
  onChange: (name: keyof CreateSellerApplicationInput, value: string) => void;
  required?: boolean;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}{required ? " *" : ""}
      </span>
      <input
        name={name}
        type={type}
        value={value}
        required={required}
        onChange={(event) => onChange(name, event.target.value)}
        placeholder={placeholder || label}
        className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </label>
  );
}

export default function SellerApplicationPage() {
  const [form, setForm] = useState<CreateSellerApplicationInput>(initialForm);
  const [applications, setApplications] = useState<SellerApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [withdrawingId, setWithdrawingId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadApplications = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await sellerApplicationsApi.listMine({
        page: 1,
        limit: 50,
      });

      setApplications(result.applications ?? []);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadApplications();
  }, [loadApplications]);

  function updateField(
    name: keyof CreateSellerApplicationInput,
    value: string,
  ) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");

    // Do not send empty optional values to Zod URL validators.
    const payload = Object.fromEntries(
      Object.entries(form).filter(
        ([key, value]) =>
          key === "type" || (typeof value === "string" && value.trim() !== ""),
      ),
    ) as CreateSellerApplicationInput;

    try {
      await sellerApplicationsApi.create(payload);
      setForm(initialForm);
      setSuccess("Your seller application has been submitted successfully.");
      await loadApplications();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleWithdraw(application: SellerApplication) {
    const confirmed = window.confirm(
      `Withdraw your application for "${application.businessName}"?`,
    );

    if (!confirmed) return;

    setWithdrawingId(application._id);
    setError("");
    setSuccess("");

    try {
      await sellerApplicationsApi.withdrawMine(application._id);
      setSuccess("Your application has been withdrawn.");
      await loadApplications();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setWithdrawingId("");
    }
  }

  const canWithdraw = (status: SellerApplication["status"]) =>
    status === "SUBMITTED" || status === "UNDER_REVIEW";

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/account"
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-blue-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to My Account
        </Link>

        <header className="mb-8">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-100 p-3 text-blue-700">
              <Store className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
                Become a NOPTRIX Seller
              </h1>
              <p className="mt-1 text-sm text-gray-600">
                Submit your business details for review.
              </p>
            </div>
          </div>
        </header>

        {error && (
          <div role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div role="status" className="mb-5 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            {success}
          </div>
        )}

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="mb-6 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-blue-700" />
            <h2 className="text-lg font-bold text-gray-900">
              Business information
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <span className="mb-2 block text-sm font-medium text-gray-700">
                Application type *
              </span>
              <div className="grid gap-3 sm:grid-cols-2">
                {(["BUSINESS", "INDIVIDUAL"] as SellerApplicationType[]).map((type) => (
                  <label
                    key={type}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 ${
                      form.type === type
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200"
                    }`}
                  >
                    <input
                      type="radio"
                      name="type"
                      value={type}
                      checked={form.type === type}
                      onChange={() => updateField("type", type)}
                    />
                    <span className="text-sm font-semibold text-gray-800">
                      {type === "BUSINESS" ? "Registered Business" : "Individual"}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Business / Store name" name="businessName" value={form.businessName} onChange={updateField} required />
              <Field label="Legal name" name="legalName" value={form.legalName || ""} onChange={updateField} />
              <Field label="Contact email" name="email" value={form.email} onChange={updateField} type="email" required />
              <Field label="Phone number" name="phone" value={form.phone || ""} onChange={updateField} type="tel" />
              <Field label="Tax number" name="taxNumber" value={form.taxNumber || ""} onChange={updateField} />
              <Field label="Registration number" name="registrationNumber" value={form.registrationNumber || ""} onChange={updateField} />
              <Field label="Website URL" name="website" value={form.website || ""} onChange={updateField} type="url" placeholder="https://example.com" />
              <Field label="Logo URL" name="logoUrl" value={form.logoUrl || ""} onChange={updateField} type="url" placeholder="https://example.com/logo.png" />
              <Field label="City" name="city" value={form.city || ""} onChange={updateField} />
              <Field label="Country" name="country" value={form.country || ""} onChange={updateField} />
            </div>

            <Field label="Business address" name="address" value={form.address || ""} onChange={updateField} />

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-gray-700">
                Business description
              </span>
              <textarea
                value={form.description || ""}
                onChange={(event) => updateField("description", event.target.value)}
                rows={5}
                maxLength={5000}
                placeholder="Describe your business, products and experience..."
                className="w-full rounded-lg border border-gray-300 px-3 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
              <span className="mt-1 block text-right text-xs text-gray-400">
                {(form.description || "").length}/5000
              </span>
            </label>

            <div className="flex flex-col justify-between gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:items-center">
              <p className="text-xs text-gray-500">
                Your application will be reviewed before seller onboarding.
              </p>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {submitting ? "Submitting..." : "Submit Application"}
              </button>
            </div>
          </form>
        </section>

        <section className="mt-8">
          <div className="mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5 text-gray-700" />
            <h2 className="text-xl font-bold text-gray-900">
              My Applications
            </h2>
          </div>

          {loading ? (
            <div className="rounded-xl border bg-white p-8 text-center text-sm text-gray-500">
              Loading your applications...
            </div>
          ) : applications.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-white p-8 text-center">
              <FileText className="mx-auto h-8 w-8 text-gray-400" />
              <p className="mt-3 font-semibold text-gray-800">
                No applications yet
              </p>
              <p className="mt-1 text-sm text-gray-500">
                Submit the form above to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {applications.map((application) => (
                <article
                  key={application._id}
                  className="rounded-xl border border-gray-200 bg-white p-5"
                >
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div>
                      <h3 className="font-bold text-gray-900">
                        {application.businessName}
                      </h3>
                      <p className="mt-1 text-sm text-gray-500">
                        {application.type} · {application.email}
                      </p>
                      <p className="mt-1 text-xs text-gray-400">
                        Submitted: {application.createdAt
                          ? new Date(application.createdAt).toLocaleDateString()
                          : "—"}
                      </p>
                    </div>

                    <span className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${statusStyle(application.status)}`}>
                      {application.status.replaceAll("_", " ")}
                    </span>
                  </div>

                  {application.rejectionReason && (
                    <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">
                      <strong>Reason:</strong> {application.rejectionReason}
                    </div>
                  )}

                  {canWithdraw(application.status) && (
                    <div className="mt-4 border-t border-gray-100 pt-3">
                      <button
                        type="button"
                        disabled={withdrawingId === application._id}
                        onClick={() => void handleWithdraw(application)}
                        className="inline-flex items-center gap-2 text-sm font-semibold text-red-600 hover:text-red-800 disabled:opacity-50"
                      >
                        <XCircle className="h-4 w-4" />
                        {withdrawingId === application._id ? "Withdrawing..." : "Withdraw application"}
                      </button>
                    </div>
                  )}

                  {application.status === "APPROVED" && (
                    <p className="mt-3 flex items-center gap-2 text-sm text-green-700">
                      <CheckCircle2 className="h-4 w-4" />
                      Application approved. Check your email for the seller invitation.
                    </p>
                  )}

                  {application.status === "UNDER_REVIEW" && (
                    <p className="mt-3 flex items-center gap-2 text-sm text-amber-700">
                      <Clock className="h-4 w-4" />
                      Your application is currently under review.
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => void loadApplications()}
            disabled={loading}
            className="mt-4 text-sm font-semibold text-blue-700 hover:underline disabled:opacity-50"
          >
            Refresh applications
          </button>
        </section>
      </div>
    </main>
  );
}
