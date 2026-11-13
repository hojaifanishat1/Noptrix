"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  Store,
} from "lucide-react";

import {
  sellerInvitationsApi,
  type SellerInvitationPreview,
} from "@/services/api/seller-invitations.api";

export default function SellerInvitationForm({
  token,
}: {
  token: string;
}) {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<SellerInvitationPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadPreview() {
      setPreviewLoading(true);
      setError("");

      try {
        const result = await sellerInvitationsApi.preview(token);

        if (active) {
          setPreview(result);
        }
      } catch (previewError: unknown) {
        if (active) {
          setError(
            previewError instanceof Error
              ? previewError.message
              : "Unable to load invitation details. The invitation may be invalid or expired.",
          );
        }
      } finally {
        if (active) {
          setPreviewLoading(false);
        }
      }
    }

    void loadPreview();

    return () => {
      active = false;
    };
  }, [token]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Password and confirm password do not match.");
      return;
    }

    setLoading(true);

    try {
      const result = await sellerInvitationsApi.accept({
        token,
        password,
        confirmPassword,
      });

      if (result.status !== "PENDING") {
        throw new Error("Unexpected seller account status.");
      }

      router.replace("/seller/pending-verification");
    } catch (acceptError: unknown) {
      setError(
        acceptError instanceof Error
          ? acceptError.message
          : "Unable to accept invitation. The invitation may have expired.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 text-white">
      <div className="w-full max-w-lg">
        <div className="mb-8 flex items-center justify-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-400 text-slate-950">
            <Store className="h-6 w-6" />
          </span>
          <span>
            <span className="block text-xl font-black tracking-[0.16em]">
              NOPTRIX
            </span>
            <span className="block text-xs tracking-wider text-slate-400">
              SELLER INVITATION
            </span>
          </span>
        </div>

        <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl backdrop-blur-xl sm:p-9">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-400/10 text-violet-300 ring-1 ring-violet-300/20">
            <ShieldCheck className="h-7 w-7" />
          </div>

          <h1 className="mt-7 text-3xl font-extrabold">
            Create your seller password
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-400">
            Set a new password to create your independent NOPTRIX Seller
            account.
          </p>

          {previewLoading && (
            <p className="mt-6 text-sm text-slate-400">
              Loading invitation details...
            </p>
          )}

          {preview && (
            <div className="mt-6 space-y-4 rounded-2xl border border-white/10 bg-slate-900/70 p-5">
              <h2 className="text-sm font-bold text-slate-200">
                Invitation details
              </h2>

              <div>
                <p className="text-xs text-slate-500">Name</p>
                <p className="mt-1 text-sm font-medium text-white">
                  {preview.name}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500">Business Name</p>
                <p className="mt-1 text-sm font-medium text-white">
                  {preview.businessName}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500">Email</p>
                <p className="mt-1 break-all text-sm font-medium text-white">
                  {preview.email}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500">Phone</p>
                <p className="mt-1 text-sm font-medium text-white">
                  {preview.phone || "Not provided"}
                </p>
              </div>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="mt-6 flex gap-3 rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200"
            >
              <AlertCircle className="h-5 w-5 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label
                htmlFor="seller-new-password"
                className="mb-2 block text-sm font-semibold text-slate-200"
              >
                New password
              </label>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                <input
                  id="seller-new-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  required
                  disabled={loading}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Create a password"
                  className="w-full rounded-xl border border-white/10 bg-slate-900/80 py-3.5 pl-12 pr-12 text-sm text-white outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-white"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="seller-confirm-password"
                className="mb-2 block text-sm font-semibold text-slate-200"
              >
                Confirm password
              </label>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                <input
                  id="seller-confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  required
                  disabled={loading}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Confirm your password"
                  className="w-full rounded-xl border border-white/10 bg-slate-900/80 py-3.5 pl-12 pr-12 text-sm text-white outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20"
                />
                <button
                  type="button"
                  aria-label={
                    showConfirmPassword ? "Hide password" : "Show password"
                  }
                  onClick={() => setShowConfirmPassword((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-white"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <p className="text-xs leading-5 text-slate-500">
              Use at least 8 characters. Your Seller password is separate
              from any NOPTRIX Customer account.
            </p>

            <button
              type="submit"
              disabled={loading || previewLoading || !preview}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-400 px-4 py-3.5 font-bold text-slate-950 transition hover:bg-violet-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <LoaderCircle className="h-5 w-5 animate-spin" />
                  Creating account...
                </>
              ) : (
                <>
                  Accept invitation
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
