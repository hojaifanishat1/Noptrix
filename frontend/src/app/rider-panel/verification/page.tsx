
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { isAxiosError } from "axios";
import {
  BadgeCheck,
  Clock3,
  FileText,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Upload,
} from "lucide-react";

import {
  onboardingApi,
  type OnboardingDocument,
  type OnboardingDocumentType,
  type OnboardingDocumentStatus,
} from "@/services/api/onboarding.api";

import {
  riderAuthApi,
  type RiderProfile,
} from "@/services/api/rider-auth.api";

const REQUIRED_DOCUMENTS: {
  type: OnboardingDocumentType;
  title: string;
  description: string;
}[] = [
  {
    type: "NATIONAL_ID",
    title: "National ID",
    description: "Upload a clear copy of your national identity document.",
  },
  {
    type: "DRIVING_LICENSE",
    title: "Driving License",
    description: "Upload your valid driving license.",
  },
  {
    type: "VEHICLE_REGISTRATION",
    title: "Vehicle Registration",
    description: "Upload your vehicle registration document.",
  },
  {
    type: "VEHICLE_INSURANCE",
    title: "Vehicle Insurance",
    description: "Upload your valid vehicle insurance document.",
  },
];

function errorMessage(error: unknown): string {
  if (isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message ?? error.message;
  }

  return error instanceof Error
    ? error.message
    : "Something went wrong.";
}

function statusStyle(status: OnboardingDocumentStatus) {
  switch (status) {
    case "APPROVED":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "REJECTED":
      return "bg-red-50 text-red-700 border-red-200";
    default:
      return "bg-amber-50 text-amber-700 border-amber-200";
  }
}

function StatusIcon({
  status,
}: {
  status?: OnboardingDocumentStatus;
}) {
  if (status === "APPROVED") {
    return <BadgeCheck className="h-4 w-4" />;
  }

  if (status === "REJECTED") {
    return <ShieldAlert className="h-4 w-4" />;
  }

  return <Clock3 className="h-4 w-4" />;
}

export default function RiderVerificationPage() {
  const [profile, setProfile] = useState<RiderProfile | null>(null);
  const [documents, setDocuments] = useState<OnboardingDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<OnboardingDocumentType | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [rider, riderDocuments] = await Promise.all([
        riderAuthApi.getMe(),
        onboardingApi.getRiderDocuments(),
      ]);

      setProfile(rider);
      setDocuments(riderDocuments);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const latestDocuments = useMemo(() => {
    const result = new Map<
      OnboardingDocumentType,
      OnboardingDocument
    >();

    for (const document of documents) {
      const existing = result.get(document.documentType);

      if (
        !existing ||
        new Date(document.createdAt ?? 0).getTime() >
          new Date(existing.createdAt ?? 0).getTime()
      ) {
        result.set(document.documentType, document);
      }
    }

    return result;
  }, [documents]);

  const approvedCount = REQUIRED_DOCUMENTS.filter(
    (item) =>
      latestDocuments.get(item.type)?.status === "APPROVED",
  ).length;

  const handleUpload = async (
    documentType: OnboardingDocumentType,
    file?: File,
  ) => {
    if (!file) return;

    setError("");
    setSuccess("");

    if (
      !file.type.startsWith("image/") &&
      file.type !== "application/pdf"
    ) {
      setError("Only PDF and image files are allowed.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("File size must not exceed 10 MB.");
      return;
    }

    setUploading(documentType);

    try {
      await onboardingApi.uploadRiderDocument(documentType, file);
      setSuccess("Document uploaded successfully.");
      await loadData();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setUploading(null);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border bg-white p-8 text-center text-sm text-slate-500">
        Loading verification information...
      </div>
    );
  }

  const progress = Math.round(
    (approvedCount / REQUIRED_DOCUMENTS.length) * 100,
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-50 p-3 text-blue-700">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Rider Verification
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Submit your required documents for verification.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void loadData()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </header>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          {success}
        </div>
      )}

      <section className="rounded-xl border bg-white p-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row">
          <div>
            <p className="text-sm text-slate-500">Rider account</p>
            <h2 className="mt-1 text-lg font-bold text-slate-900">
              {profile?.name || "Rider"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {profile?.riderCode || "Rider code not assigned"}
            </p>
          </div>

          <div className="text-left sm:text-right">
            <p className="text-sm text-slate-500">Approved documents</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {approvedCount}/{REQUIRED_DOCUMENTS.length}
            </p>
          </div>
        </div>

        <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>

        <p className="mt-2 text-xs text-slate-500">
          {progress}% of required documents approved
        </p>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Required documents
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Accepted formats: PDF, JPEG, PNG and WebP. Maximum size: 10 MB.
          </p>
        </div>

        {REQUIRED_DOCUMENTS.map((item) => {
          const document = latestDocuments.get(item.type);
          const status = document?.status;
          const isApproved = status === "APPROVED";
          const isPending = status === "PENDING";
          const isUploading = uploading === item.type;

          return (
            <article
              key={item.type}
              className="rounded-xl border border-slate-200 bg-white p-5"
            >
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                <div className="flex gap-3">
                  <div className="rounded-lg bg-slate-100 p-3 text-slate-600">
                    <FileText className="h-5 w-5" />
                  </div>

                  <div>
                    <h3 className="font-semibold text-slate-900">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {item.description}
                    </p>

                    {document?.createdAt && (
                      <p className="mt-2 text-xs text-slate-400">
                        Submitted:{" "}
                        {new Date(document.createdAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>

                {status && (
                  <span
                    className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${statusStyle(status)}`}
                  >
                    <StatusIcon status={status} />
                    {status}
                  </span>
                )}
              </div>

              {status === "REJECTED" && document?.rejectionReason && (
                <div className="mt-4 rounded-lg border border-red-100 bg-red-50 p-3">
                  <p className="text-xs font-semibold text-red-800">
                    Rejection reason
                  </p>
                  <p className="mt-1 text-sm text-red-700">
                    {document.rejectionReason}
                  </p>
                </div>
              )}

              <div className="mt-4 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-slate-500">
                  {isApproved
                    ? "This document has been approved."
                    : isPending
                      ? "Your document is waiting for review."
                      : status === "REJECTED"
                        ? "Upload a corrected document to resubmit."
                        : "No document submitted yet."}
                </p>

                <label
                  className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold ${
                    isApproved || isPending || isUploading
                      ? "cursor-not-allowed bg-slate-100 text-slate-400"
                      : "bg-slate-900 text-white hover:bg-slate-700"
                  }`}
                >
                  <Upload className="h-4 w-4" />
                  {isUploading
                    ? "Uploading..."
                    : status === "REJECTED"
                      ? "Resubmit document"
                      : status === "APPROVED"
                        ? "Approved"
                        : status === "PENDING"
                          ? "Under review"
                          : "Upload document"}

                  <input
                    type="file"
                    accept=".pdf,image/jpeg,image/png,image/webp"
                    className="hidden"
                    disabled={isApproved || isPending || isUploading}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      void handleUpload(item.type, file);
                      event.target.value = "";
                    }}
                  />
                </label>
              </div>
            </article>
          );
        })}
      </section>

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        Delivery availability requires an active rider account and completed
        onboarding verification. Document approval alone does not activate
        delivery availability.
      </div>
    </div>
  );
}
