"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
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

import { sellerOpportunitiesApi } from "@/services/api/seller-opportunities.api";

import type {
  SellerOpportunity,
  SellerOpportunityFormField,
  SellerOpportunityDocumentRequirement,
} from "@/features/seller-opportunities/seller-opportunity.types";

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

type DocumentDraft = {
  fileName: string;
  fileUrl: string;
  mimeType: string;
  sizeBytes: string;
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

function DynamicField({
  field,
  value,
  onChange,
}: {
  field: SellerOpportunityFormField;
  value: unknown;
  onChange: (key: string, value: unknown) => void;
}) {
  const label = (
    <span className="mb-1.5 block text-sm font-medium text-gray-700">
      {field.label}{field.required ? " *" : ""}
    </span>
  );

  const inputClass =
    "w-full rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

  if (field.type === "CHECKBOX") {
    return (
      <label className="flex items-start gap-3 rounded-lg border border-gray-200 p-3">
        <input
          type="checkbox"
          checked={value === true}
          onChange={(event) => onChange(field.key, event.target.checked)}
          className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600"
        />
        <span className="text-sm text-gray-700">
          {field.label}{field.required ? " *" : ""}
        </span>
      </label>
    );
  }

  if (field.type === "MULTI_SELECT") {
    const selected = Array.isArray(value) ? value as string[] : [];

    return (
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium text-gray-700">
          {field.label}{field.required ? " *" : ""}
        </legend>
        {(field.options ?? []).map((option) => (
          <label key={option} className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={selected.includes(option)}
              onChange={(event) => {
                const next = event.target.checked
                  ? [...selected, option]
                  : selected.filter((item) => item !== option);

                onChange(field.key, next);
              }}
              className="h-4 w-4 rounded border-gray-300 text-blue-600"
            />
            {option}
          </label>
        ))}
      </fieldset>
    );
  }

  if (field.type === "SELECT") {
    return (
      <label className="block">
        {label}
        <select
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(field.key, event.target.value)}
          required={field.required}
          className={`${inputClass} h-11`}
        >
          <option value="">Select an option</option>
          {(field.options ?? []).map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </label>
    );
  }

  if (field.type === "TEXTAREA") {
    return (
      <label className="block">
        {label}
        <textarea
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(field.key, event.target.value)}
          required={field.required}
          maxLength={field.maxLength}
          placeholder={field.placeholder || field.label}
          rows={4}
          className={`${inputClass} py-3`}
        />
      </label>
    );
  }

  const inputType: Record<string, string> = {
    TEXT: "text",
    NUMBER: "number",
    EMAIL: "email",
    PHONE: "tel",
    URL: "url",
    DATE: "date",
  };

  return (
    <label className="block">
      {label}
      <input
        type={inputType[field.type] || "text"}
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(field.key, event.target.value)}
        required={field.required}
        maxLength={field.maxLength}
        placeholder={field.placeholder || field.label}
        className={`${inputClass} h-11`}
      />
    </label>
  );
}

function createEmptyDocumentDrafts(
  requirements: SellerOpportunityDocumentRequirement[],
): Record<string, DocumentDraft> {
  return Object.fromEntries(
    requirements.map((item) => [
      item.key,
      {
        fileName: "",
        fileUrl: "",
        mimeType: "",
        sizeBytes: "",
      },
    ]),
  );
}

export default function SellerApplicationPage() {
  const [form, setForm] = useState<CreateSellerApplicationInput>(initialForm);
  const [applications, setApplications] = useState<SellerApplication[]>([]);
  const [opportunity, setOpportunity] = useState<SellerOpportunity | null>(null);
  const [opportunitySlug, setOpportunitySlug] = useState("");
  const [opportunityLoading, setOpportunityLoading] = useState(false);
  const [opportunityError, setOpportunityError] = useState("");
  const [formResponses, setFormResponses] = useState<Record<string, unknown>>({});
  const [documentDrafts, setDocumentDrafts] = useState<Record<string, DocumentDraft>>({});
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get("opportunitySlug")?.trim();

    if (!slug) return;

    setOpportunitySlug(slug);
    setOpportunityLoading(true);
    setOpportunityError("");

    sellerOpportunitiesApi
      .getPublicBySlug(slug)
      .then((result) => {
        setOpportunity(result);
        setDocumentDrafts(createEmptyDocumentDrafts(result.requiredDocuments ?? []));
      })
      .catch((requestError: unknown) => {
        setOpportunityError(getErrorMessage(requestError));
      })
      .finally(() => {
        setOpportunityLoading(false);
      });
  }, []);

  function updateField(
    name: keyof CreateSellerApplicationInput,
    value: string,
  ) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function updateDocument(
    key: string,
    name: keyof DocumentDraft,
    value: string,
  ) {
    setDocumentDrafts((current) => ({
      ...current,
      [key]: {
        ...(current[key] ?? {
          fileName: "",
          fileUrl: "",
          mimeType: "",
          sizeBytes: "",
        }),
        [name]: value,
      },
    }));
  }

  function validateOpportunityForm(): string | null {
    if (!opportunity) return null;

    for (const field of opportunity.applicationForm ?? []) {
      const value = formResponses[field.key];

      if (!field.required) continue;

      if (field.type === "CHECKBOX") {
        if (value !== true) return `Please confirm: ${field.label}`;
        continue;
      }

      if (field.type === "MULTI_SELECT") {
        if (!Array.isArray(value) || value.length === 0) {
          return `Please select at least one option for "${field.label}".`;
        }
        continue;
      }

      if (value === undefined || value === null || String(value).trim() === "") {
        return `Please complete the required field: ${field.label}`;
      }
    }

    for (const requirement of opportunity.requiredDocuments ?? []) {
      const draft = documentDrafts[requirement.key];
      const hasAnyValue = Boolean(
        draft?.fileName.trim() ||
        draft?.fileUrl.trim() ||
        draft?.mimeType.trim() ||
        draft?.sizeBytes.trim(),
      );

      if (requirement.required && !draft?.fileUrl.trim()) {
        return `Please provide the document URL for: ${requirement.label}`;
      }

      if (hasAnyValue) {
        if (!draft.fileName.trim() || !draft.fileUrl.trim() ||
            !draft.mimeType.trim() || !draft.sizeBytes.trim()) {
          return `Please complete all document details for: ${requirement.label}`;
        }

        if (!/^https?:\/\//i.test(draft.fileUrl.trim())) {
          return `Please provide a valid HTTP or HTTPS URL for: ${requirement.label}`;
        }

        const sizeBytes = Number(draft.sizeBytes);

        if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
          return `Please enter a valid file size for: ${requirement.label}`;
        }

        if (sizeBytes > requirement.maxSizeMB * 1024 * 1024) {
          return `${requirement.label} exceeds the ${requirement.maxSizeMB} MB limit.`;
        }

        if (
          requirement.acceptedMimeTypes.length > 0 &&
          !requirement.acceptedMimeTypes.includes(draft.mimeType.trim())
        ) {
          return `Unsupported document type for: ${requirement.label}`;
        }
      }
    }

    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");

    if (opportunitySlug && !opportunity) {
      setError(
        opportunityError ||
        "The selected seller opportunity could not be loaded. Please return to the opportunity page and try again.",
      );
      setSubmitting(false);
      return;
    }

    const opportunityValidationError = validateOpportunityForm();

    if (opportunityValidationError) {
      setError(opportunityValidationError);
      setSubmitting(false);
      return;
    }

    const basePayload = Object.fromEntries(
      Object.entries(form).filter(
        ([key, value]) =>
          key === "type" ||
          (typeof value === "string" && value.trim() !== ""),
      ),
    ) as CreateSellerApplicationInput;

    const submittedDocuments = Object.entries(documentDrafts)
      .filter(([, draft]) => draft.fileUrl.trim() !== "")
      .map(([key, draft]) => ({
        key,
        fileName: draft.fileName.trim(),
        fileUrl: draft.fileUrl.trim(),
        mimeType: draft.mimeType.trim(),
        sizeBytes: Number(draft.sizeBytes),
      })) as NonNullable<CreateSellerApplicationInput["documents"]>;

    const payload: CreateSellerApplicationInput = {
      ...basePayload,
      ...(opportunity
        ? {
            opportunityId: opportunity._id,
            formResponses,
            documents: submittedDocuments,
          }
        : {}),
    };

    try {
      await sellerApplicationsApi.create(payload);
      setForm(initialForm);
      setFormResponses({});
      setDocumentDrafts(
        opportunity
          ? createEmptyDocumentDrafts(opportunity.requiredDocuments ?? [])
          : {},
      );
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

        {opportunitySlug && (
          <section className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 p-5">
            {opportunityLoading ? (
              <div className="flex items-center gap-2 text-sm text-blue-800">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading seller opportunity...
              </div>
            ) : opportunity ? (
              <>
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                  Applying for opportunity
                </p>
                <h2 className="mt-1 text-xl font-bold text-gray-900">
                  {opportunity.title}
                </h2>
                <p className="mt-2 text-sm text-gray-700">
                  {opportunity.summary}
                </p>
                {opportunity.applicationDeadline && (
                  <p className="mt-3 text-xs font-medium text-blue-800">
                    Application deadline:{" "}
                    {new Date(opportunity.applicationDeadline).toLocaleDateString()}
                  </p>
                )}
                <Link
                  href={`/become-a-seller/${encodeURIComponent(opportunity.slug)}`}
                  className="mt-3 inline-block text-sm font-semibold text-blue-700 hover:underline"
                >
                  View opportunity details
                </Link>
              </>
            ) : (
              <p className="text-sm text-red-700">
                {opportunityError || "This seller opportunity could not be loaded."}
              </p>
            )}
          </section>
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

            {opportunity && opportunity.applicationForm.length > 0 && (
              <div className="space-y-5 border-t border-gray-100 pt-6">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    Opportunity application questions
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Complete the additional information requested for this opportunity.
                  </p>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  {opportunity.applicationForm.map((field) => (
                    <div
                      key={field.key}
                      className={
                        field.type === "TEXTAREA" || field.type === "MULTI_SELECT" ||
                        field.type === "CHECKBOX"
                          ? "sm:col-span-2"
                          : ""
                      }
                    >
                      <DynamicField
                        field={field}
                        value={formResponses[field.key]}
                        onChange={(key, value) =>
                          setFormResponses((current) => ({
                            ...current,
                            [key]: value,
                          }))
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {opportunity && opportunity.requiredDocuments.length > 0 && (
              <div className="space-y-5 border-t border-gray-100 pt-6">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    Required documents
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Provide a hosted URL and file details for each requested document.
                  </p>
                </div>

                <div className="space-y-4">
                  {opportunity.requiredDocuments.map((requirement) => {
                    const draft = documentDrafts[requirement.key] ?? {
                      fileName: "",
                      fileUrl: "",
                      mimeType: "",
                      sizeBytes: "",
                    };

                    return (
                      <div
                        key={requirement.key}
                        className="rounded-xl border border-gray-200 p-4"
                      >
                        <div className="mb-3">
                          <h4 className="text-sm font-semibold text-gray-900">
                            {requirement.label}
                            {requirement.required ? " *" : " (optional)"}
                          </h4>
                          <p className="mt-1 text-xs text-gray-500">
                            Maximum size: {requirement.maxSizeMB} MB
                            {requirement.acceptedMimeTypes.length > 0
                              ? ` · Accepted: ${requirement.acceptedMimeTypes.join(", ")}`
                              : ""}
                          </p>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="block">
                            <span className="mb-1 block text-xs font-medium text-gray-600">
                              File name
                            </span>
                            <input
                              value={draft.fileName}
                              onChange={(event) =>
                                updateDocument(requirement.key, "fileName", event.target.value)
                              }
                              placeholder="business-registration.pdf"
                              className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm"
                            />
                          </label>

                          <label className="block">
                            <span className="mb-1 block text-xs font-medium text-gray-600">
                              Hosted document URL
                            </span>
                            <input
                              type="url"
                              value={draft.fileUrl}
                              onChange={(event) =>
                                updateDocument(requirement.key, "fileUrl", event.target.value)
                              }
                              placeholder="https://..."
                              className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm"
                            />
                          </label>

                          <label className="block">
                            <span className="mb-1 block text-xs font-medium text-gray-600">
                              MIME type
                            </span>
                            <input
                              value={draft.mimeType}
                              onChange={(event) =>
                                updateDocument(requirement.key, "mimeType", event.target.value)
                              }
                              placeholder="application/pdf"
                              className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm"
                            />
                          </label>

                          <label className="block">
                            <span className="mb-1 block text-xs font-medium text-gray-600">
                              File size (bytes)
                            </span>
                            <input
                              type="number"
                              min="1"
                              value={draft.sizeBytes}
                              onChange={(event) =>
                                updateDocument(requirement.key, "sizeBytes", event.target.value)
                              }
                              placeholder="e.g. 250000"
                              className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm"
                            />
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex flex-col justify-between gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:items-center">
              <p className="text-xs text-gray-500">
                Your application will be reviewed before seller onboarding.
              </p>
              <button
                type="submit"
                disabled={
                  submitting ||
                  opportunityLoading ||
                  Boolean(opportunitySlug && !opportunity)
                }
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
                        Submitted:{" "}
                        {application.createdAt
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
                        {withdrawingId === application._id
                          ? "Withdrawing..."
                          : "Withdraw application"}
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
