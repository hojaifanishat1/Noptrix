"use client";

import { isAxiosError } from "axios";
import { use, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Bike, CheckCircle2 } from "lucide-react";
import {
  riderInvitationsApi,
  type RiderInvitationValidation,
} from "@/services/api/rider-invitations.api";

interface PageProps {
  params: Promise<{ token: string }>;
}

function getErrorMessage(error: unknown) {
  if (isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message ?? error.message;
  }
  return error instanceof Error ? error.message : "Unable to process invitation.";
}

export default function RiderInvitationPage({ params }: PageProps) {
  const { token } = use(params);
  const [invitation, setInvitation] = useState<RiderInvitationValidation | null>(null);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    riderInvitationsApi.validate(token)
      .then((result) => { if (active) setInvitation(result); })
      .catch((requestError: unknown) => { if (active) setError(getErrorMessage(requestError)); });
    return () => { active = false; };
  }, [token]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await riderInvitationsApi.accept({
        token,
        ...(password ? { password } : {}),
      });
      setAccepted(true);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <section className="w-full max-w-md rounded-2xl border bg-white p-7 shadow-sm">
        {accepted ? (
          <div className="text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
            <h1 className="mt-4 text-xl font-bold text-slate-950">Invitation accepted</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Your rider profile is pending verification. You can sign in after an owner activates your account.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-slate-900 p-3 text-white"><Bike className="h-6 w-6" /></div>
              <div>
                <h1 className="text-xl font-bold text-slate-950">Rider invitation</h1>
                <p className="text-sm text-slate-500">Join as a {invitation?.type.toLowerCase() ?? "rider"} rider</p>
              </div>
            </div>
            {error && <div role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
            {invitation ? (
              <form onSubmit={submit} className="mt-6 space-y-4">
                <div className="rounded-lg bg-slate-50 p-3 text-sm">
                  <p className="font-semibold text-slate-900">{invitation.name}</p>
                  <p className="text-slate-600">{invitation.email}</p>
                </div>
                {invitation.requiresPassword ? (
                  <label className="block text-sm font-medium text-slate-700">
                    Create a password
                    <input
                      required
                      minLength={8}
                      maxLength={128}
                      type="password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="mt-1 h-11 w-full rounded-lg border px-3"
                    />
                    <span className="mt-1 block text-xs font-normal text-slate-500">
                      Use at least 8 characters.
                    </span>
                  </label>
                ) : (
                  <p className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800">
                    An existing account was found for this email. Your current password will remain unchanged.
                  </p>
                )}
                <button type="submit" disabled={saving} className="h-11 w-full rounded-lg bg-slate-900 font-semibold text-white hover:bg-slate-700 disabled:opacity-50">
                  {saving ? "Accepting…" : "Accept invitation"}
                </button>
              </form>
            ) : !error ? (
              <p className="mt-6 text-sm text-slate-500">Checking invitation…</p>
            ) : null}
          </>
        )}
        {accepted && <Link href="/" className="mt-5 block text-center text-sm font-medium text-slate-700 hover:text-slate-950">Return to home</Link>}
      </section>
    </main>
  );
}
