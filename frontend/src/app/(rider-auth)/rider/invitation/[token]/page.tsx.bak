
"use client";

import { isAxiosError } from "axios";
import Link from "next/link";
import { use, useEffect, useState, type FormEvent } from "react";
import {
  Bike,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  Phone,
  ShieldCheck,
  UserRound,
  XCircle,
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
      "Unable to process your invitation."
    );
  }

  return error instanceof Error
    ? error.message
    : "Unable to process your invitation.";
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getVehicleLabel(value?: string): string {
  if (!value) return "Not specified";

  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export default function RiderInvitationPage({ params }: PageProps) {
  const { token } = use(params);

  const [invitation, setInvitation] =
    useState<RiderInvitationValidation | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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

    if (password.length < 8 || password.length > 128) {
      setError("Password must contain between 8 and 128 characters.");
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
        throw new Error(
          "Your rider account was created with an unexpected status. Please contact support.",
        );
      }

      setAccepted(true);
      setPassword("");
      setConfirmPassword("");
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
            <Bike className="h-8 w-8" />
          </div>

          <h1 className="mt-5 text-2xl font-bold tracking-tight text-white">
            NOPTRIX Rider
          </h1>

          <p className="mt-2 text-sm text-slate-400">
            Rider invitation and account registration
          </p>
        </div>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          {loading ? (
            <div className="flex min-h-80 flex-col items-center justify-center p-8 text-center">
              <Loader2 className="h-9 w-9 animate-spin text-blue-600" />
              <p className="mt-4 font-semibold text-slate-900">
                Checking your invitation
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Please wait while we verify your invitation link.
              </p>
            </div>
          ) : accepted ? (
            <div className="px-7 py-12 text-center sm:px-10">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
                <CheckCircle2 className="h-9 w-9 text-emerald-600" />
              </div>

              <h2 className="mt-6 text-2xl font-bold text-slate-950">
                Invitation accepted!
              </h2>

              <p className="mt-3 text-sm leading-6 text-slate-600">
                Your Rider account has been created successfully.
                Your account is currently waiting for Owner verification
                and activation.
              </p>

              <div className="mt-7 rounded-xl border border-amber-200 bg-amber-50 p-4 text-left">
                <div className="flex items-center gap-2 text-amber-800">
                  <ShieldCheck className="h-5 w-5" />
                  <span className="font-semibold">
                    Pending Owner activation
                  </span>
                </div>

                <p className="mt-2 text-sm leading-6 text-amber-700">
                  You can sign in after your Rider account has been
                  activated by the Owner.
                </p>
              </div>

              {invitation && (
                <div className="mt-5 rounded-xl bg-slate-50 p-4 text-left">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Registered email
                  </p>
                  <p className="mt-1 break-all font-semibold text-slate-900">
                    {invitation.email}
                  </p>

                  <p className="mt-4 text-xs font-medium uppercase tracking-wide text-slate-500">
                    Rider code
                  </p>
                  <p className="mt-1 font-semibold text-slate-900">
                    {invitation.riderCode}
                  </p>
                </div>
              )}

              <Link
                href="/rider/login"
                className="mt-7 flex h-12 w-full items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Go to Rider login
              </Link>

              <p className="mt-4 text-xs text-slate-500">
                Login will be available after account activation.
              </p>
            </div>
          ) : (
            <div className="p-6 sm:p-8">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
                  You are invited
                </p>

                <h2 className="mt-2 text-2xl font-bold text-slate-950">
                  Accept your Rider invitation
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Review your invitation details and create your
                  independent Rider account password.
                </p>
              </div>

              {error && (
                <div
                  role="alert"
                  className="mt-6 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
                >
                  <XCircle className="mt-0.5 h-5 w-5 shrink-0" />
                  <p>{error}</p>
                </div>
              )}

              {invitation ? (
                <>
                  <div className="mt-7 rounded-xl border border-slate-200 bg-slate-50 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-semibold text-slate-900">
                        Invitation details
                      </h3>

                      <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                        {invitation.type}
                      </span>
                    </div>

                    <div className="mt-5 space-y-4">
                      <div className="flex items-start gap-3">
                        <UserRound className="mt-0.5 h-5 w-5 text-slate-400" />
                        <div className="min-w-0">
                          <p className="text-xs text-slate-500">
                            Full name
                          </p>
                          <p className="break-words text-sm font-semibold text-slate-900">
                            {invitation.name}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <Mail className="mt-0.5 h-5 w-5 text-slate-400" />
                        <div className="min-w-0">
                          <p className="text-xs text-slate-500">
                            Email address
                          </p>
                          <p className="break-all text-sm font-semibold text-slate-900">
                            {invitation.email}
                          </p>
                        </div>
                      </div>

                      {invitation.phone && (
                        <div className="flex items-start gap-3">
                          <Phone className="mt-0.5 h-5 w-5 text-slate-400" />
                          <div>
                            <p className="text-xs text-slate-500">
                              Phone number
                            </p>
                            <p className="text-sm font-semibold text-slate-900">
                              {invitation.phone}
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="border-t border-slate-200 pt-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-slate-500">
                              Vehicle type
                            </p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">
                              {getVehicleLabel(invitation.vehicleType)}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-slate-500">
                              Vehicle number
                            </p>
                            <p className="mt-1 break-words text-sm font-semibold text-slate-900">
                              {invitation.vehicleNumber || "Not specified"}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-slate-200 pt-4">
                        <p className="text-xs text-slate-500">
                          Invitation expires
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {formatDate(invitation.expiresAt)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <form onSubmit={submit} className="mt-7 space-y-5">
                    <div>
                      <div className="mb-2 flex items-center gap-2">
                        <LockKeyhole className="h-4 w-4 text-slate-500" />
                        <label
                          htmlFor="rider-password"
                          className="text-sm font-semibold text-slate-800"
                        >
                          Create password
                        </label>
                      </div>

                      <div className="relative">
                        <input
                          id="rider-password"
                          required
                          minLength={8}
                          maxLength={128}
                          type={showPassword ? "text" : "password"}
                          autoComplete="new-password"
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          placeholder="Enter your password"
                          className="h-12 w-full rounded-xl border border-slate-300 px-4 pr-12 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                        />

                        <button
                          type="button"
                          onClick={() => setShowPassword((value) => !value)}
                          aria-label={showPassword ? "Hide password" : "Show password"}
                          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-400 hover:text-slate-700"
                        >
                          {showPassword ? (
                            <EyeOff className="h-5 w-5" />
                          ) : (
                            <Eye className="h-5 w-5" />
                          )}
                        </button>
                      </div>

                      <p className="mt-2 text-xs text-slate-500">
                        Password must contain between 8 and 128 characters.
                      </p>
                    </div>

                    <div>
                      <div className="mb-2 flex items-center gap-2">
                        <LockKeyhole className="h-4 w-4 text-slate-500" />
                        <label
                          htmlFor="rider-confirm-password"
                          className="text-sm font-semibold text-slate-800"
                        >
                          Confirm password
                        </label>
                      </div>

                      <div className="relative">
                        <input
                          id="rider-confirm-password"
                          required
                          minLength={8}
                          maxLength={128}
                          type={showConfirmPassword ? "text" : "password"}
                          autoComplete="new-password"
                          value={confirmPassword}
                          onChange={(event) =>
                            setConfirmPassword(event.target.value)
                          }
                          placeholder="Re-enter your password"
                          className="h-12 w-full rounded-xl border border-slate-300 px-4 pr-12 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                        />

                        <button
                          type="button"
                          onClick={() =>
                            setShowConfirmPassword((value) => !value)
                          }
                          aria-label={
                            showConfirmPassword
                              ? "Hide confirm password"
                              : "Show confirm password"
                          }
                          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-400 hover:text-slate-700"
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="h-5 w-5" />
                          ) : (
                            <Eye className="h-5 w-5" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                      <div className="flex gap-2 text-blue-800">
                        <ShieldCheck className="h-5 w-5 shrink-0" />
                        <p className="text-sm font-semibold">
                          Independent Rider account
                        </p>
                      </div>

                      <p className="mt-2 text-xs leading-5 text-blue-700">
                        Your Rider password is separate from your
                        Customer, Seller, and other accounts.
                      </p>
                    </div>

                    <button
                      type="submit"
                      disabled={saving}
                      className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          Accepting invitation...
                        </>
                      ) : (
                        "Accept invitation"
                      )}
                    </button>
                  </form>
                </>
              ) : (
                <div className="mt-7 rounded-xl border border-red-200 bg-red-50 p-4">
                  <p className="text-sm font-semibold text-red-800">
                    Invitation unavailable
                  </p>
                  <p className="mt-1 text-sm leading-6 text-red-700">
                    {error || "This invitation could not be verified."}
                  </p>
                  <Link
                    href="/"
                    className="mt-4 inline-block text-sm font-semibold text-red-800 underline"
                  >
                    Return to home
                  </Link>
                </div>
              )}
            </div>
          )}
        </section>

        <p className="mt-6 text-center text-xs text-slate-500">
          Secure Rider registration · NOPTRIX
        </p>
      </div>
    </main>
  );
}
