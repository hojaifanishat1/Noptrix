
"use client";

import { isAxiosError } from "axios";
import {
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  Bike,
  Mail,
  RefreshCw,
  UserPlus,
} from "lucide-react";

import {
  riderInvitationsApi,
  type RiderInvitation,
} from "@/services/api/rider-invitations.api";

function getErrorMessage(error: unknown): string {
  if (isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message ?? error.message;
  }

  return error instanceof Error
    ? error.message
    : "Something went wrong.";
}

export default function RiderInvitationsPage() {
  const [invitations, setInvitations] = useState<RiderInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadInvitations = useCallback(async () => {
    setLoading(true);

    try {
      const data = await riderInvitationsApi.list();
      setInvitations(data);
      setError("");
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInvitations();
  }, [loadInvitations]);

  const revoke = async (invitation: RiderInvitation) => {
    if (revokingId) return;

    const confirmed = window.confirm(
      `Revoke the invitation for ${invitation.email}?`,
    );

    if (!confirmed) return;

    setError("");
    setMessage("");
    setRevokingId(invitation._id);

    try {
      await riderInvitationsApi.revoke(invitation._id);

      setMessage("Rider invitation revoked successfully.");
      await loadInvitations();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <header className="flex items-center gap-3">
        <div className="rounded-xl bg-slate-900 p-3 text-white">
          <Bike className="h-6 w-6" />
        </div>

        <div>
          <h1 className="text-2xl font-bold text-slate-950">
            Rider Invitations
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            View and manage Rider invitations sent through recruitment.
          </p>
        </div>
      </header>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {message && (
        <div
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
        >
          {message}
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-4">
          <div>
            <h2 className="font-semibold text-slate-900">
              Recent invitations
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Manage invitations sent to Rider applicants.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadInvitations()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>

        {loading ? (
          <p className="p-6 text-center text-sm text-slate-500">
            Loading rider invitations...
          </p>
        ) : invitations.length === 0 ? (
          <div className="p-8 text-center">
            <UserPlus className="mx-auto h-8 w-8 text-slate-300" />

            <p className="mt-3 font-medium text-slate-700">
              No rider invitations yet
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Invitations sent through Rider Applications will appear here.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {invitations.map((invitation) => (
              <li
                key={invitation._id}
                className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <div className="rounded-lg bg-slate-100 p-2">
                    <UserPlus className="h-5 w-5 text-slate-600" />
                  </div>

                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">
                      {invitation.name}
                    </p>

                    <p className="mt-1 flex items-center gap-1 break-all text-sm text-slate-500">
                      <Mail className="h-3.5 w-3.5 shrink-0" />
                      {invitation.email}
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      {invitation.type}
                      {invitation.vehicleType
                        ? ` · ${invitation.vehicleType}`
                        : ""}
                      {" · Expires "}
                      {new Date(invitation.expiresAt).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 sm:shrink-0">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    {invitation.status}
                  </span>

                  {invitation.status === "PENDING" && (
                    <button
                      type="button"
                      onClick={() => void revoke(invitation)}
                      disabled={revokingId !== null}
                      className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {revokingId === invitation._id
                        ? "Revoking..."
                        : "Revoke"}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
