
"use client";

import { useCallback, useState } from "react";
import { isAxiosError } from "axios";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  FileText,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";

import {
  getOnboardingDocumentId,
  onboardingApi,
  type OnboardingDocument,
} from "@/services/api/onboarding.api";

const DOCUMENT_LABELS: Record<string, string> = {
  NATIONAL_ID: "National ID",
  DRIVING_LICENSE: "Driving License",
  VEHICLE_REGISTRATION: "Vehicle Registration",
  VEHICLE_INSURANCE: "Vehicle Insurance",
};

function getErrorMessage(error: unknown): string {
  if (isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message ?? error.message;
  }

  return error instanceof Error
    ? error.message
    : "Something went wrong.";
}

function dateLabel(value?: string): string {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString();
}

export default function RiderDocumentReview({
  riderId,
  riderName,
}: {
  riderId: string;
  riderName: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [documents, setDocuments] = useState<OnboardingDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await onboardingApi.getOwnerDocuments(riderId);
      setDocuments(result);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [riderId]);

  const toggleExpanded = async () => {
    const next = !expanded;
    setExpanded(next);

    if (next) {
      await loadDocuments();
    }
  };

  const review = async (
    document: OnboardingDocument,
    status: "APPROVED" | "REJECTED",
  ) => {
    const documentId = getOnboardingDocumentId(document);

    if (!documentId) {
      setError("Document ID is missing.");
      return;
    }

    let rejectionReason: string | undefined;

    if (status === "REJECTED") {
      const input = window.prompt(
        `Enter the rejection reason for ${DOCUMENT_LABELS[document.documentType] ?? document.documentType}:`,
      );

      if (!input?.trim()) return;

      rejectionReason = input.trim();
    } else if (
      !window.confirm(
        `Approve ${DOCUMENT_LABELS[document.documentType] ?? document.documentType} for ${riderName}?`,
      )
    ) {
      return;
    }

    setActionId(documentId);
    setError("");
    setSuccess("");

    try {
      await onboardingApi.reviewDocument(
        documentId,
        status,
        rejectionReason,
      );

      setSuccess(
        status === "APPROVED"
          ? "Document approved successfully."
          : "Document rejected successfully.",
      );

      await loadDocuments();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionId("");
    }
  };

  return (
    <section className="mt-5 border-t border-slate-200 pt-4">
      <button
        type="button"
        onClick={() => void toggleExpanded()}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <FileText className="h-4 w-4" />
          Verification documents
        </span>

        {expanded ? (
          <ChevronUp className="h-4 w-4 text-slate-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-500" />
        )}
      </button>

      {expanded && (
        <div className="mt-4 space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void loadDocuments()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh documents
            </button>
          </div>

          {error && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
              {success}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center gap-2 rounded-lg bg-slate-50 p-6 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading documents...
            </div>
          ) : documents.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-slate-500">
              This rider has not submitted any documents yet.
            </div>
          ) : (
            documents.map((document) => {
              const id = getOnboardingDocumentId(document);
              const isPending = document.status === "PENDING";
              const isBusy = actionId === id;

              return (
                <article
                  key={id || `${document.documentType}-${document.createdAt}`}
                  className="rounded-lg border border-slate-200 p-4"
                >
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div>
                      <h4 className="font-semibold text-slate-900">
                        {DOCUMENT_LABELS[document.documentType] ?? document.documentType}
                      </h4>

                      <p className="mt-1 text-xs text-slate-500">
                        Submitted: {dateLabel(document.createdAt)}
                      </p>

                      <span
                        className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                          document.status === "APPROVED"
                            ? "bg-emerald-50 text-emerald-700"
                            : document.status === "REJECTED"
                              ? "bg-red-50 text-red-700"
                              : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {document.status}
                      </span>
                    </div>

                    {document.downloadUrl && (
                      <a
                        href={document.downloadUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <Download className="h-4 w-4" />
                        View document
                      </a>
                    )}
                  </div>

                  {document.rejectionReason && (
                    <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                      <strong>Previous rejection:</strong>{" "}
                      {document.rejectionReason}
                    </div>
                  )}

                  {isPending && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void review(document, "APPROVED")}
                        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {isBusy ? "Saving..." : "Approve"}
                      </button>

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void review(document, "REJECTED")}
                        className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        <XCircle className="h-4 w-4" />
                        Reject
                      </button>
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>
      )}
    </section>
  );
}
