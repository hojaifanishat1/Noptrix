"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  Store,
  ShieldCheck,
  AlertCircle,
  LoaderCircle,
} from "lucide-react";

import { sellerAuthApi } from "@/services/api/seller-auth.api";
import { useSellerAuthStore } from "@/stores/seller-auth.store";

export default function SellerLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const setSeller = useSellerAuthStore((state) => state.setSeller);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await sellerAuthApi.login({
        email: email.trim().toLowerCase(),
        password,
      });

      const seller = await sellerAuthApi.getMe();

      if (seller.status !== "ACTIVE") {
        await sellerAuthApi.logout();
        throw new Error(
          "Your seller account is awaiting Owner verification.",
        );
      }

      setSeller(seller);
      router.replace("/seller-panel");
    } catch (loginError: unknown) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : "Unable to sign in. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-12 text-white">
      <div className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-violet-500/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-32 h-96 w-96 rounded-full bg-cyan-600/20 blur-3xl" />

      <div className="relative z-10 w-full max-w-md">
        <Link href="/" className="mb-8 flex items-center justify-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-400 text-slate-950">
            <Store className="h-6 w-6" />
          </span>
          <span>
            <span className="block text-xl font-black tracking-[0.16em]">
              NOPTRIX
            </span>
            <span className="block text-xs font-medium tracking-wider text-slate-400">
              SELLER PORTAL
            </span>
          </span>
        </Link>

        <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl backdrop-blur-xl sm:p-9">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-400/10 text-violet-300 ring-1 ring-violet-300/20">
            <ShieldCheck className="h-7 w-7" />
          </div>

          <h1 className="mt-7 text-3xl font-extrabold tracking-tight">
            Seller sign in
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-400">
            Sign in to manage your NOPTRIX seller business.
          </p>

          {(error || searchParams.get("status") === "pending") && (
            <div
              role="alert"
              className="mt-6 flex gap-3 rounded-xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-200"
            >
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <p>
                {error ||
                  "Your account is awaiting Owner verification. You can sign in after activation."}
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label
                htmlFor="seller-email"
                className="mb-2 block text-sm font-semibold text-slate-200"
              >
                Email address
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                <input
                  id="seller-email"
                  type="email"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  disabled={loading}
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setError("");
                  }}
                  placeholder="seller@example.com"
                  className="w-full rounded-xl border border-white/10 bg-slate-900/80 py-3.5 pl-12 pr-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20 disabled:opacity-60"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="seller-password"
                className="mb-2 block text-sm font-semibold text-slate-200"
              >
                Password
              </label>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                <input
                  id="seller-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  disabled={loading}
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setError("");
                  }}
                  placeholder="Enter your password"
                  className="w-full rounded-xl border border-white/10 bg-slate-900/80 py-3.5 pl-12 pr-12 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20 disabled:opacity-60"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 transition hover:text-white"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-400 px-4 py-3.5 font-bold text-slate-950 transition hover:bg-violet-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <LoaderCircle className="h-5 w-5 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign in to Seller Portal
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-7 border-t border-white/10 pt-6">
            <p className="text-center text-xs leading-5 text-slate-500">
              Seller accounts are created through approved invitations.
              Contact NOPTRIX support if you need assistance.
            </p>
          </div>
        </section>

        <p className="mt-6 text-center text-xs text-slate-600">
          © {new Date().getFullYear()} NOPTRIX. Seller access only.
        </p>
      </div>
    </main>
  );
}
