
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Building2,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  RefreshCw,
  Search,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import { DataTable } from "@/components/tables/DataTable";

import {
  sellerApplicationsApi,
  type SellerApplication,
  type SellerApplicationStatus,
  type SellerApplicationType,
  type SellerApplicationPagination,
} from "@/services/api/seller-applications.api";

const STATUSES: SellerApplicationStatus[] = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
  "WITHDRAWN",
];

const TYPES: SellerApplicationType[] = [
  "INDIVIDUAL",
  "BUSINESS",
];

const EMPTY_PAGINATION: SellerApplicationPagination = {
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false,
};

function getErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (
      error as {
        response?: {
          data?: { message?: string };
        };
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

function formatDate(value?: string): string {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString();
}

function getStatusClasses(status: SellerApplicationStatus): string {
  const classes: Record<SellerApplicationStatus, string> = {
    SUBMITTED: "bg-blue-100 text-blue-800",
    UNDER_REVIEW: "bg-amber-100 text-amber-800",
    APPROVED: "bg-green-100 text-green-800",
    REJECTED: "bg-red-100 text-red-800",
    WITHDRAWN: "bg-slate-100 text-slate-700",
  };

  return classes[status];
}

function StatusBadge({
  status,
}: {
  status: SellerApplicationStatus;
}) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusClasses(status)}`}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}

function getApplicantName(
  applicant: SellerApplication["applicantId"],
): string {
  return typeof applicant === "string"
    ? applicant
    : applicant?.name || applicant?.email || applicant?._id || "—";
}

function SummaryCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: number;
  description: string;
  icon: typeof FileText;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">
          {title}
        </p>

        <div className="rounded-lg bg-muted p-2 text-foreground">
          <Icon className="h-5 w-5" />
        </div>
      </div>

      <p className="mt-3 text-2xl font-bold text-foreground">
        {value.toLocaleString()}
      </p>

      <p className="mt-1 text-xs text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

export default function AdminSellerApplicationsPage() {
  const [applications, setApplications] = useState<SellerApplication[]>([]);
  const [pagination, setPagination] =
    useState<SellerApplicationPagination>(EMPTY_PAGINATION);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionId, setActionId] = useState("");

  const [selected, setSelected] = useState<SellerApplication | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  const loadApplications = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await sellerApplicationsApi.list({
        page,
        limit: 20,
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(status
          ? { status: status as SellerApplicationStatus }
          : {}),
        ...(type ? { type: type as SellerApplicationType } : {}),
      });

      setApplications(result.applications ?? []);
      setPagination(result.pagination ?? EMPTY_PAGINATION);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
      setApplications([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, status, type]);

  useEffect(() => {
    void loadApplications();
  }, [loadApplications]);

  const openDetails = async (application: SellerApplication) => {
    setSelected(application);
    setDetailLoading(true);
    setDetailError("");

    try {
      const result = await sellerApplicationsApi.getById(application._id);
      setSelected(result);
    } catch (requestError) {
      setDetailError(getErrorMessage(requestError));
    } finally {
      setDetailLoading(false);
    }
  };

  const updateStatus = async (
    application: SellerApplication,
    nextStatus: SellerApplicationStatus,
  ) => {
    if (application.status === nextStatus) return;

    let rejectionReason: string | undefined;

    if (nextStatus === "REJECTED") {
      const reason = window.prompt("Enter the rejection reason:");

      if (!reason?.trim()) return;

      rejectionReason = reason.trim();
    }

    let notes: string | undefined;

    if (nextStatus === "UNDER_REVIEW" || nextStatus === "APPROVED") {
      const value = window.prompt("Internal notes (optional):");
      notes = value?.trim() || undefined;
    }

    const confirmed = window.confirm(
      `Change application for "${application.businessName}" from ${application.status} to ${nextStatus}?`,
    );

    if (!confirmed) return;

    setActionId(application._id);

    try {
      await sellerApplicationsApi.updateStatus(application._id, {
        status: nextStatus,
        ...(rejectionReason ? { rejectionReason } : {}),
        ...(notes ? { notes } : {}),
      });

      if (selected?._id === application._id) {
        setSelected(null);
      }

      await loadApplications();
    } catch (requestError) {
      window.alert(getErrorMessage(requestError));
    } finally {
      setActionId("");
    }
  };

  const resetFilters = () => {
    setSearch("");
    setStatus("");
    setType("");
    setPage(1);
  };

  const submittedCount = applications.filter(
    (application) => application.status === "SUBMITTED",
  ).length;

  const reviewCount = applications.filter(
    (application) => application.status === "UNDER_REVIEW",
  ).length;

  const approvedCount = applications.filter(
    (application) => application.status === "APPROVED",
  ).length;

  const columns = [
    {
      key: "business",
      header: "Business",
      cell: (application: SellerApplication) => (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Building2 className="h-5 w-5" />
          </div>

          <div className="min-w-0">
            <p className="font-semibold text-foreground">
              {application.businessName}
            </p>

            <p className="text-xs text-muted-foreground">
              {application.legalName || "No legal name"}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "applicant",
      header: "Applicant",
      cell: (application: SellerApplication) => (
        <div>
          <p className="text-sm text-foreground">
            {getApplicantName(application.applicantId)}
          </p>

          <p className="text-xs text-muted-foreground">
            {application.email}
          </p>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      cell: (application: SellerApplication) => (
        <span className="text-sm text-muted-foreground">
          {application.type}
        </span>
      ),
    },
    {
      key: "location",
      header: "Location",
      cell: (application: SellerApplication) => (
        <span className="text-sm text-muted-foreground">
          {[application.city, application.country]
            .filter(Boolean)
            .join(", ") || "—"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (application: SellerApplication) => (
        <StatusBadge status={application.status} />
      ),
    },
    {
      key: "submitted",
      header: "Submitted",
      cell: (application: SellerApplication) => (
        <span className="text-sm text-muted-foreground">
          {formatDate(application.createdAt)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (application: SellerApplication) => (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            title="View application"
            onClick={() => void openDetails(application)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted"
          >
            <Eye className="h-4 w-4" />
          </button>

          {["SUBMITTED", "UNDER_REVIEW"].includes(application.status) && (
            <>
              <button
                type="button"
                disabled={actionId === application._id}
                onClick={() =>
                  void updateStatus(application, "APPROVED")
                }
                className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
              >
                Approve
              </button>

              <button
                type="button"
                disabled={actionId === application._id}
                onClick={() =>
                  void updateStatus(application, "REJECTED")
                }
                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                Reject
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-foreground" />

            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Seller Applications
            </h1>
          </div>

          <p className="mt-1 text-sm text-muted-foreground">
            Review applications and manage seller onboarding decisions.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadApplications()}
          disabled={loading}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-semibold hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw
            className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
          />
          Refresh
        </button>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Total Applications"
          value={pagination.total}
          description="Matching applications"
          icon={FileText}
        />

        <SummaryCard
          title="Submitted"
          value={submittedCount}
          description="On the current page"
          icon={Clock}
        />

        <SummaryCard
          title="Under Review"
          value={reviewCount}
          description="On the current page"
          icon={ShieldCheck}
        />

        <SummaryCard
          title="Approved"
          value={approvedCount}
          description="On the current page"
          icon={CheckCircle2}
        />
      </div>

      <section className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />

          <h2 className="text-sm font-semibold text-foreground">
            Search and filters
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search business, email or applicant..."
            className="h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-foreground"
          />

          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
          >
            <option value="">All statuses</option>

            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {value.replaceAll("_", " ")}
              </option>
            ))}
          </select>

          <select
            value={type}
            onChange={(event) => {
              setType(event.target.value);
              setPage(1);
            }}
            className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
          >
            <option value="">All types</option>

            {TYPES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={resetFilters}
            className="h-10 rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted"
          >
            Reset filters
          </button>
        </div>
      </section>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
          <button
            type="button"
            onClick={() => void loadApplications()}
            className="ml-2 font-semibold underline"
          >
            Retry
          </button>
        </div>
      )}

      <section className="space-y-3">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-bold text-foreground">
              Application Directory
            </h2>

            <p className="text-sm text-muted-foreground">
              {pagination.total} application(s) found
            </p>
          </div>

          <p className="text-xs text-muted-foreground">
            Page {pagination.page} of {Math.max(pagination.totalPages, 1)}
          </p>
        </div>

        <DataTable
          columns={columns}
          data={applications}
          getRowKey={(application) => application._id}
          loading={loading}
          loadingRows={8}
          emptyMessage="No seller applications found."
        />

        <div className="flex flex-col justify-between gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center">
          <p className="text-sm text-muted-foreground">
            Showing {applications.length ? (page - 1) * 20 + 1 : 0}
            {" – "}
            {(page - 1) * 20 + applications.length}
            {" of "}
            {pagination.total}
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!pagination.hasPreviousPage || loading}
              onClick={() =>
                setPage((current) => Math.max(1, current - 1))
              }
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>

            <button
              type="button"
              disabled={!pagination.hasNextPage || loading}
              onClick={() => setPage((current) => current + 1)}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelected(null);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="seller-application-title"
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id="seller-application-title"
                  className="text-xl font-bold text-foreground"
                >
                  Application Details
                </h2>

                <p className="mt-1 text-sm text-muted-foreground">
                  {selected.businessName}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted"
              >
                Close
              </button>
            </div>

            {detailLoading ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Loading application details...
              </p>
            ) : (
              <div className="mt-5 space-y-5">
                {detailError && (
                  <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                    {detailError}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={selected.status} />

                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                    {selected.type}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <DetailItem label="Business name" value={selected.businessName} />
                  <DetailItem label="Legal name" value={selected.legalName} />
                  <DetailItem label="Applicant" value={getApplicantName(selected.applicantId)} />
                  <DetailItem label="Email" value={selected.email} />
                  <DetailItem label="Phone" value={selected.phone} />
                  <DetailItem label="Tax number" value={selected.taxNumber} />
                  <DetailItem label="Registration number" value={selected.registrationNumber} />
                  <DetailItem label="Website" value={selected.website} />
                  <DetailItem
                    label="Location"
                    value={[selected.address, selected.city, selected.country]
                      .filter(Boolean)
                      .join(", ")}
                  />
                  <DetailItem label="Submitted" value={formatDate(selected.createdAt)} />
                  <DetailItem label="Reviewed" value={formatDate(selected.reviewedAt)} />
                </div>

                {selected.description && (
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground">
                      Description
                    </p>

                    <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                      {selected.description}
                    </p>
                  </div>
                )}

                {selected.rejectionReason && (
                  <div className="rounded-lg bg-red-50 p-3">
                    <p className="text-xs font-semibold uppercase text-red-700">
                      Rejection reason
                    </p>

                    <p className="mt-1 text-sm text-red-800">
                      {selected.rejectionReason}
                    </p>
                  </div>
                )}

                {selected.notes && (
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground">
                      Internal notes
                    </p>

                    <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                      {selected.notes}
                    </p>
                  </div>
                )}

                {["SUBMITTED", "UNDER_REVIEW"].includes(selected.status) && (
                  <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
                    {selected.status === "SUBMITTED" && (
                      <button
                        type="button"
                        disabled={actionId === selected._id}
                        onClick={() =>
                          void updateStatus(selected, "UNDER_REVIEW")
                        }
                        className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50"
                      >
                        Mark Under Review
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={actionId === selected._id}
                      onClick={() => void updateStatus(selected, "APPROVED")}
                      className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      Approve
                    </button>

                    <button
                      type="button"
                      disabled={actionId === selected._id}
                      onClick={() => void updateStatus(selected, "REJECTED")}
                      className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase text-muted-foreground">
        {label}
      </p>

      <p className="mt-1 break-words text-sm text-foreground">
        {value || "—"}
      </p>
    </div>
  );
}
