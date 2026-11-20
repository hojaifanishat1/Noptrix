"use client";

import { useCallback, useEffect, useState } from "react";
import {
  RefreshCw,
  Search,
  Mail,
  Store,
  Clock,
  CheckCircle2,
  XCircle,
  Ban,
  Eye,
} from "lucide-react";

import { DataTable } from "@/components/tables/DataTable";

import {
  sellerInvitationsApi,
  type SellerInvitation,
  type SellerInvitationStatus,
  type SellerInvitationPagination,
  type SellerInvitationCounts,
} from "@/services/api/seller-invitations.api";

import { sellerApplicationsApi } from "@/services/api/seller-applications.api";

const EMPTY_PAGINATION: SellerInvitationPagination = {
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false,
};

const EMPTY_COUNTS: SellerInvitationCounts = {
  total: 0,
  pending: 0,
  accepted: 0,
  expired: 0,
  revoked: 0,
};

const STATUSES: SellerInvitationStatus[] = [
  "PENDING",
  "ACCEPTED",
  "EXPIRED",
  "REVOKED",
];

function getErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error
  ) {
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
    : date.toLocaleString();
}

function getApplication(
  value: SellerInvitation["applicationId"],
) {
  return typeof value === "string" ? null : value;
}

function getSeller(
  value: SellerInvitation["acceptedSellerId"],
) {
  return typeof value === "string" || !value ? null : value;
}

function getStatusClasses(status: SellerInvitationStatus): string {
  const classes: Record<SellerInvitationStatus, string> = {
    PENDING: "bg-amber-100 text-amber-800",
    ACCEPTED: "bg-green-100 text-green-800",
    EXPIRED: "bg-slate-100 text-slate-700",
    REVOKED: "bg-red-100 text-red-800",
  };

  return classes[status];
}

function StatusBadge({
  status,
}: {
  status: SellerInvitationStatus;
}) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusClasses(status)}`}
    >
      {status}
    </span>
  );
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
  icon: typeof Mail;
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

function DetailItem({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-medium text-foreground">
        {value || "—"}
      </p>
    </div>
  );
}

export default function AdminSellerInvitationsPage() {
  const [invitations, setInvitations] = useState<SellerInvitation[]>([]);
  const [pagination, setPagination] =
    useState<SellerInvitationPagination>(EMPTY_PAGINATION);
  const [counts, setCounts] =
    useState<SellerInvitationCounts>(EMPTY_COUNTS);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionId, setActionId] = useState("");

  const [selected, setSelected] =
    useState<SellerInvitation | null>(null);

  const loadInvitations = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await sellerInvitationsApi.list({
        page,
        limit: 20,
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(status
          ? { status: status as SellerInvitationStatus }
          : {}),
      });

      setInvitations(result.invitations ?? []);
      setPagination(result.pagination ?? EMPTY_PAGINATION);
      setCounts(result.counts ?? EMPTY_COUNTS);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
      setInvitations([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, status]);

  useEffect(() => {
    void loadInvitations();
  }, [loadInvitations]);

  const revokeInvitation = async (invitation: SellerInvitation) => {
    const application = getApplication(invitation.applicationId);
    const businessName = application?.businessName || invitation.email;

    const confirmed = window.confirm(
      `Revoke the pending seller invitation for ${businessName} (${invitation.email})? The invitation link will stop working.`,
    );

    if (!confirmed) return;

    setActionId(invitation._id);

    try {
      await sellerInvitationsApi.revoke(invitation._id);

      if (selected?._id === invitation._id) {
        setSelected(null);
      }

      await loadInvitations();
    } catch (requestError) {
      window.alert(getErrorMessage(requestError));
    } finally {
      setActionId("");
    }
  };

  const resendInvitation = async (invitation: SellerInvitation) => {
    const application = getApplication(invitation.applicationId);

    if (!application?._id) {
      window.alert(
        "Application information is unavailable. Cannot resend this invitation.",
      );
      return;
    }

    if (invitation.status === "ACCEPTED") {
      window.alert("Accepted invitations cannot be resent.");
      return;
    }

    const confirmed = window.confirm(
      `Send a new invitation to ${invitation.email}? The previous invitation link will become invalid.`,
    );

    if (!confirmed) return;

    setActionId(invitation._id);

    try {
      await sellerApplicationsApi.resendInvitation(application._id);

      window.alert("A new seller invitation has been sent.");
      await loadInvitations();
    } catch (requestError) {
      window.alert(getErrorMessage(requestError));
    } finally {
      setActionId("");
    }
  };

  const resetFilters = () => {
    setSearch("");
    setStatus("");
    setPage(1);
  };

  const columns = [
    {
      key: "business",
      header: "Business",
      cell: (invitation: SellerInvitation) => {
        const application = getApplication(invitation.applicationId);

        return (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Store className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <p className="font-semibold text-foreground">
                {application?.businessName || "Application unavailable"}
              </p>
              <p className="text-xs text-muted-foreground">
                {application?.legalName || application?.type || "—"}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      key: "email",
      header: "Invitation Email",
      cell: (invitation: SellerInvitation) => (
        <span className="text-sm text-foreground">
          {invitation.email}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (invitation: SellerInvitation) => (
        <StatusBadge status={invitation.status} />
      ),
    },
    {
      key: "sent",
      header: "Sent At",
      cell: (invitation: SellerInvitation) => (
        <span className="text-sm text-muted-foreground">
          {formatDate(invitation.sentAt)}
        </span>
      ),
    },
    {
      key: "expires",
      header: "Expires At",
      cell: (invitation: SellerInvitation) => (
        <span className="text-sm text-muted-foreground">
          {formatDate(invitation.expiresAt)}
        </span>
      ),
    },
    {
      key: "accepted",
      header: "Accepted At",
      cell: (invitation: SellerInvitation) => (
        <span className="text-sm text-muted-foreground">
          {formatDate(invitation.acceptedAt)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (invitation: SellerInvitation) => (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            title="View invitation details"
            onClick={() => setSelected(invitation)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted"
          >
            <Eye className="h-4 w-4" />
          </button>

          {invitation.status !== "ACCEPTED" &&
            invitation.status !== "REVOKED" && (
              <button
                type="button"
                disabled={actionId === invitation._id}
                onClick={() => void resendInvitation(invitation)}
                className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
              >
                {actionId === invitation._id ? "Sending..." : "Resend"}
              </button>
            )}

          {invitation.status === "PENDING" && (
            <button
              type="button"
              disabled={actionId === invitation._id}
              onClick={() => void revokeInvitation(invitation)}
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
            >
              Revoke
            </button>
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
            <Mail className="h-6 w-6 text-foreground" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Seller Invitations
            </h1>
          </div>

          <p className="mt-1 text-sm text-muted-foreground">
            Monitor seller invitations, expiry, acceptance and delivery lifecycle.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadInvitations()}
          disabled={loading}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-semibold hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw
            className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
          />
          Refresh
        </button>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard
          title="Total Invitations"
          value={counts.total}
          description="All invitation records"
          icon={Mail}
        />
        <SummaryCard
          title="Pending"
          value={counts.pending}
          description="Awaiting acceptance"
          icon={Clock}
        />
        <SummaryCard
          title="Accepted"
          value={counts.accepted}
          description="Seller accounts created"
          icon={CheckCircle2}
        />
        <SummaryCard
          title="Expired"
          value={counts.expired}
          description="Past expiry date"
          icon={XCircle}
        />
        <SummaryCard
          title="Revoked"
          value={counts.revoked}
          description="Cancelled invitations"
          icon={Ban}
        />
      </div>

      <section className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">
            Search and filters
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search business or invitation email..."
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
            onClick={() => void loadInvitations()}
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
              Invitation Directory
            </h2>
            <p className="text-sm text-muted-foreground">
              {pagination.total} invitation(s) found
            </p>
          </div>

          <p className="text-xs text-muted-foreground">
            Page {pagination.page} of {Math.max(pagination.totalPages, 1)}
          </p>
        </div>

        <DataTable
          columns={columns}
          data={invitations}
          getRowKey={(invitation) => invitation._id}
          loading={loading}
          loadingRows={8}
          emptyMessage="No seller invitations found."
        />

        <div className="flex flex-col justify-between gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center">
          <p className="text-sm text-muted-foreground">
            Showing {invitations.length ? (page - 1) * 20 + 1 : 0}
            {" – "}
            {(page - 1) * 20 + invitations.length}
            {" of "}
            {pagination.total}
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!pagination.hasPreviousPage || loading}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
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
            aria-labelledby="seller-invitation-title"
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id="seller-invitation-title"
                  className="text-xl font-bold text-foreground"
                >
                  Invitation Details
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selected.email}
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

            <div className="mt-5 space-y-5">
              <StatusBadge status={selected.status} />

              <div>
                <h3 className="mb-3 text-sm font-semibold text-foreground">
                  Invitation information
                </h3>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <DetailItem label="Email" value={selected.email} />
                  <DetailItem label="Invitation ID" value={selected._id} />
                  <DetailItem label="Sent at" value={formatDate(selected.sentAt)} />
                  <DetailItem label="Expires at" value={formatDate(selected.expiresAt)} />
                  <DetailItem label="Accepted at" value={formatDate(selected.acceptedAt)} />
                  <DetailItem label="Created at" value={formatDate(selected.createdAt)} />
                </div>
              </div>

              <div className="border-t border-border pt-5">
                <h3 className="mb-3 text-sm font-semibold text-foreground">
                  Application information
                </h3>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <DetailItem
                    label="Business"
                    value={getApplication(selected.applicationId)?.businessName}
                  />
                  <DetailItem
                    label="Legal name"
                    value={getApplication(selected.applicationId)?.legalName}
                  />
                  <DetailItem
                    label="Type"
                    value={getApplication(selected.applicationId)?.type}
                  />
                  <DetailItem
                    label="Application status"
                    value={getApplication(selected.applicationId)?.status}
                  />
                  <DetailItem
                    label="Location"
                    value={[
                      getApplication(selected.applicationId)?.city,
                      getApplication(selected.applicationId)?.country,
                    ].filter(Boolean).join(", ")}
                  />
                </div>
              </div>

              {getSeller(selected.acceptedSellerId) && (
                <div className="border-t border-border pt-5">
                  <h3 className="mb-3 text-sm font-semibold text-foreground">
                    Created seller account
                  </h3>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <DetailItem
                      label="Seller code"
                      value={getSeller(selected.acceptedSellerId)?.sellerCode}
                    />
                    <DetailItem
                      label="Seller email"
                      value={getSeller(selected.acceptedSellerId)?.email}
                    />
                    <DetailItem
                      label="Account status"
                      value={getSeller(selected.acceptedSellerId)?.status}
                    />
                    <DetailItem
                      label="Onboarding status"
                      value={getSeller(selected.acceptedSellerId)?.onboardingStatus}
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
                {selected.status === "PENDING" && (
                  <button
                    type="button"
                    disabled={actionId === selected._id}
                    onClick={() => void revokeInvitation(selected)}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    Revoke invitation
                  </button>
                )}

                {selected.status !== "ACCEPTED" &&
                  selected.status !== "REVOKED" && (
                    <button
                      type="button"
                      disabled={actionId === selected._id}
                      onClick={() => void resendInvitation(selected)}
                      className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                    >
                      Resend invitation
                    </button>
                  )}
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
