"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import {
  AlertCircle,
  ArrowLeft,
  LoaderCircle,
  ShieldCheck,
  Store,
  RefreshCw,
} from "lucide-react";

import {
  sellerAuthApi,
  type SellerLoginChallenge,
} from "@/services/api/seller-auth.api";

import { useSellerAuthStore } from "@/stores/seller-auth.store";

const CHALLENGE_KEY = "noptrix:seller-login-challenge";

export default function SellerVerifyOtpForm() {
  const router = useRouter();
  const setSeller = useSellerAuthStore((state) => state.setSeller);

  const [challenge, setChallenge] =
    useState<SellerLoginChallenge | null>(null);

  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [expiryRemaining, setExpiryRemaining] = useState(0);

  useEffect(() => {
    const stored = sessionStorage.getItem(CHALLENGE_KEY);

    if (!stored) {
      router.replace("/seller/login");
      return;
    }

    try {
      const parsed = JSON.parse(stored) as SellerLoginChallenge;

      if (!parsed.challengeId || !parsed.verificationRequired) {
        throw new Error("Invalid challenge");
      }

      setChallenge(parsed);
    } catch {
      sessionStorage.removeItem(CHALLENGE_KEY);
      router.replace("/seller/login");
    }
  }, [router]);

  useEffect(() => {
    if (!challenge) return;

    const updateCountdown = () => {
      const now = Date.now();

      setRemaining(
        Math.max(
          0,
          Math.ceil(
            (new Date(challenge.resendAvailableAt).getTime() - now) / 1000,
          ),
        ),
      );

      setExpiryRemaining(
        Math.max(
          0,
          Math.ceil(
            (new Date(challenge.expiresAt).getTime() - now) / 1000,
          ),
        ),
      );
    };

    updateCountdown();

    const timer = window.setInterval(updateCountdown, 1000);

    return () => window.clearInterval(timer);
  }, [challenge]);

  function formatTime(seconds: number) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!challenge) return;

    const cleanCode = code.replace(/\\D/g, "").slice(0, 6);

    if (cleanCode.length !== 6) {
      setError(`Enter all 6 digits. Currently entered: ${cleanCode.length}`);
      return;
    }

    setLoading(true);

    try {
      await sellerAuthApi.verifyLogin({
        challengeId: challenge.challengeId,
        code: cleanCode,
      });

      const seller = await sellerAuthApi.getMe();

      if (seller.status !== "ACTIVE") {
        await sellerAuthApi.logout();

        throw new Error(
          "Your seller account is not active. Please contact support.",
        );
      }

      sessionStorage.removeItem(CHALLENGE_KEY);

      setSeller(seller);
      router.replace("/seller-panel");
    } catch (verifyError: unknown) {
      setError(
        verifyError instanceof Error
          ? verifyError.message
          : "Unable to verify your code. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!challenge || remaining > 0 || resending || expiryRemaining <= 0) {
      return;
    }

    setError("");
    setResending(true);

    try {
      const updated = await sellerAuthApi.resendLoginCode(
        challenge.challengeId,
      );

      setChallenge(updated);

      sessionStorage.setItem(
        CHALLENGE_KEY,
        JSON.stringify(updated),
      );

      setCode("");
    } catch (resendError: unknown) {
      setError(
        resendError instanceof Error
          ? resendError.message
          : "Unable to resend verification code.",
      );
    } finally {
      setResending(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-12 text-white">
      <div className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-violet-500/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-32 h-96 w-96 rounded-full bg-cyan-600/20 blur-3xl" />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-400 text-slate-950">
            <Store className="h-6 w-6" />
          </span>

          <span>
            <span className="block text-xl font-black tracking-[0.16em]">
              NOPTRIX
            </span>
            <span className="block text-xs tracking-wider text-slate-400">
              SELLER PORTAL
            </span>
          </span>
        </div>

        <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl backdrop-blur-xl sm:p-9">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-400/10 text-violet-300 ring-1 ring-violet-300/20">
            <ShieldCheck className="h-7 w-7" />
          </div>

          <h1 className="mt-7 text-3xl font-extrabold tracking-tight">
            Verify your login
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-400">
            Enter the 6-digit verification code sent to your registered
            Seller email address or phone number.
          </p>

          {challenge && (
            <div className="mt-5 rounded-xl border border-white/10 bg-slate-900/70 p-4 text-sm text-slate-300">
              {challenge.email && (
                <p className="break-all">
                  Email: <span className="text-white">{challenge.email}</span>
                </p>
              )}

              {challenge.phone && (
                <p className="mt-1">
                  Phone: <span className="text-white">{challenge.phone}</span>
                </p>
              )}
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="mt-6 flex gap-3 rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200"
            >
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <form onSubmit={handleVerify} className="mt-8 space-y-5">
            <div>
              <label
                htmlFor="seller-otp"
                className="mb-2 block text-sm font-semibold text-slate-200"
              >
                Verification code
              </label>

              <input
                id="seller-otp"
                name="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                disabled={loading || expiryRemaining <= 0}
                value={code}
                onChange={(event) => {
                  setCode(event.target.value.replace(/\\D/g, "").slice(0, 6));
                  setError("");
                }}
                placeholder="000000"
                className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-4 text-center text-2xl font-bold tracking-[0.5em] text-white outline-none transition placeholder:text-slate-600 focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20 disabled:opacity-60"
              />
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>
                Code expires in:{" "}
                <strong className="text-white">
                  {formatTime(expiryRemaining)}
                </strong>
              </span>

              <span>
                {expiryRemaining > 0 ? "Keep this page open" : "Code expired"}
              </span>
            </div>

            <button
              type="submit"
              disabled={loading || !challenge || code.length !== 6 || expiryRemaining <= 0}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-400 px-4 py-3.5 font-bold text-slate-950 transition hover:bg-violet-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <LoaderCircle className="h-5 w-5 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  Verify and sign in
                  <ShieldCheck className="h-5 w-5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 border-t border-white/10 pt-6">
            <button
              type="button"
              onClick={handleResend}
              disabled={
                resending ||
                remaining > 0 ||
                expiryRemaining <= 0 ||
                !challenge
              }
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-violet-300 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {resending ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Sending new code...
                </>
              ) : remaining > 0 ? (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Resend code in {formatTime(remaining)}
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Resend verification code
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => router.replace("/seller/login")}
              className="mt-4 flex w-full items-center justify-center gap-2 text-sm text-slate-400 transition hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to seller login
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
