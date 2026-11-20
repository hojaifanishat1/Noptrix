"use client";

import { isAxiosError } from "axios";
import { use, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  Bike,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
} from "lucide-react";

import {
  riderInvitationsApi,
  type RiderInvitationValidation,
} from "@/services/api/rider-invitations.api";

interface PageProps {
  params: Promise<{ token: string }>;
}

function getErrorMessage(error: unknown): string {
  if (isAxiosError<{ message?: string }>(error)) {
    return (
      error.response?.data?.message ??
      error.message ??
      "Unable to process invitation."
    );
  }

  return error instanceof Error
    ? error.message
    : "Unable to process invitation.";
}

export default function RiderInvitationPage({ params }: PageProps) {
  const { token } = use(params);

  const [invitation, setInvitation] =
    useState<RiderInvitationValidation | null>(null);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError("");

    riderInvitationsApi
      .validate(token)
      .then((result) => {
        if (active) {
          setInvitation(result);
        }
      })
      .catch((requestError: unknown) => {
        if (active) {
          setError(getErrorMessage(requestError));
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [token]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    if (password.length > 128) {
      setError("Password cannot exceed 128 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Password and confirm password do not match.");
      return;
    }

    setSaving(true);

    try {
      const result = await riderInvitationsApi.accept({
        token,
        password,
        confirmPassword,
      });

      if (result.status !== "PENDING") {
        throw new Error("Unexpected rider account status.");
      }

      setAccepted(true);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <section className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-7 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-slate-900 p-3 text-white">
              <Bike className="h-7 w-7" />
            </div>

            <div>
              <h1 className="text-xl font-bold text-slate-950">
                NOPTRIX Rider Invitation
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Complete your rider registration
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-7 sm:px-8">
          {accepted ? (
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
                <CheckCircle2 className="h-9 w-9 text-emerald-600" />
              </div>

              <h2 className="mt-5 text-2xl font-bold text-slate-950">
                Invitation Accepted!
              </h2>

              <p className="mt-3 text-sm leading-6 text-slate-600">
                Your rider account has been created successfully.
                Your account is currently pending verification.
                You can sign in after an Owner activates your account.
              </p>

              {invitation && (
                <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-left">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Rider code
                  </p>
                  <p className="mt-1 text-lg font-bold text-slate-950">
                    {invitation.riderCode}
                  </p>
                </div>
              )}

              <div className="mt-6 flex items-center justify-center gap-2 rounded-lg bg-amber-50 p-3 text-left text-sm text-amber-800">
                <ShieldCheck className="h-5 w-5 shrink-0" />
                <span>
                  Your account must be activated by an Owner before login.
                </span>
              </div>

              <Link
                href="/rider/login"
                className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-700"
              >
                Go to Rider Login
              </Link>
            </div>
          ) : loading ? (
            <div className="flex flex-col items-center py-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-slate-700" />
              <p className="mt-4 text-sm text-slate-500">
                Verifying your invitation...
              </p>
            </div>
          ) : error && !invitation ? (
            <div>
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
              >
                {error}
              </div>

              <Link
                href="/"
                className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-lg border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Return to Home
              </Link>
            </div>
          ) : invitation ? (
            <>
              <div>
                <h2 className="text-lg font-bold text-slate-950">
                  Welcome, {invitation.name}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Review your invitation and create your Rider password.
                </p>
              </div>

              <div className="mt-5 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div>
                  <p className="text-xs text-slate-500">Full name</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {invitation.name}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">Email address</p>
                  <p className="mt-1 break-all text-sm font-semibold text-slate-900">
                    {invitation.email}
                  </p>
                </div>

                {invitation.phone && (
                  <div>
                    <p className="text-xs text-slate-500">Phone</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {invitation.phone}
                    </p>
                  </div>
                )}

                <div>
                  <p className="text-xs text-slate-500">Rider type</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {invitation.type}
                  </p>
                </div>

                {invitation.vehicleType && (
                  <div>
                    <p className="text-xs text-slate-500">Vehicle type</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {invitation.vehicleType}
                    </p>
                  </div>
                )}

                {invitation.vehicleNumber && (
                  <div>
                    <p className="text-xs text-slate-500">Vehicle number</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {invitation.vehicleNumber}
                    </p>
                  </div>
                )}

                <div>
                  <p className="text-xs text-slate-500">Invitation expires</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {new Date(invitation.expiresAt).toLocaleString()}
                  </p>
                </div>
              </div>

              {error && (
                <div
                  role="alert"
                  className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                >
                  {error}
                </div>
              )}

              <form onSubmit={submit} className="mt-6 space-y-4">
                <div>
                  <label
                    htmlFor="password"
                    className="block text-sm font-semibold text-slate-700"
                  >
                    Create password
                  </label>

                  <div className="relative mt-1">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      minLength={8}
                      maxLength={128}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="h-11 w-full rounded-lg border border-slate-300 px-3 pr-11 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                      placeholder="Enter password"
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 hover:text-slate-900"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </button>
                  </div>

                  <p className="mt-1 text-xs text-slate-500">
                    Password must be between 8 and 128 characters.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="block text-sm font-semibold text-slate-700"
                  >
                    Confirm password
                  </label>

                  <div className="relative mt-1">
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      minLength={8}
                      maxLength={128}
                      value={confirmPassword}
                      onChange={(event) =>
                        setConfirmPassword(event.target.value)
                      }
                      className="h-11 w-full rounded-lg border border-slate-300 px-3 pr-11 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                      placeholder="Re-enter password"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword((value) => !value)
                      }
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 hover:text-slate-900"
                      aria-label={
                        showConfirmPassword
                          ? "Hide confirm password"
                          : "Show confirm password"
                      }
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {saving ? "Accepting invitation..." : "Accept Invitation"}
                </button>
              </form>

              <p className="mt-5 text-center text-xs leading-5 text-slate-500">
                By accepting this invitation, you agree to create a separate
                NOPTRIX Rider account. Your account requires Owner activation
                before you can log in.
              </p>
            </>
          ) : null}
        </div>
      </section>
    </main>
  );
}
