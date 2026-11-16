"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
    ArrowRight,
    Eye,
    EyeOff,
    LockKeyhole,
    Mail,
    Truck,
    ShieldCheck,
    AlertCircle,
    LoaderCircle,
} from "lucide-react";

import { riderLogin } from "@/features/auth/auth-actions";

const CHALLENGE_STORAGE_KEY =
    "noptrix:rider-login-challenge";

export default function RiderLoginForm() {
    const router = useRouter();

        const [identifier, setIdentifier] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    async function handleSubmit(
        event: FormEvent<HTMLFormElement>,
    ) {
        event.preventDefault();

        setError("");
        setLoading(true);

        try {
                        const value = identifier.trim();

            if (!value) {
                throw new Error(
                    "Enter your registered email address or phone number.",
                );
            }

            const loginInput = value.includes("@")
                ? { email: value.toLowerCase(), password }
                : { phone: value, password };

            const challenge = await riderLogin(loginInput);

            if (!challenge.verificationRequired) {
                throw new Error(
                    "Rider login verification was not requested.",
                );
            }

            sessionStorage.setItem(
                CHALLENGE_STORAGE_KEY,
                JSON.stringify(challenge),
            );

            router.push("/rider/verify-otp");
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
            <div
                aria-hidden="true"
                className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-cyan-500/15 blur-3xl"
            />

            <div
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-40 -right-32 h-96 w-96 rounded-full bg-blue-600/20 blur-3xl"
            />

            <div className="relative z-10 w-full max-w-md">
                <Link
                    href="/"
                    className="mb-8 flex items-center justify-center gap-3"
                >
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/20">
                        <Truck className="h-6 w-6" />
                    </span>

                    <span>
                        <span className="block text-xl font-black tracking-[0.16em]">
                            NOPTRIX
                        </span>

                        <span className="block text-xs font-medium tracking-wider text-slate-400">
                            RIDER PORTAL
                        </span>
                    </span>
                </Link>

                <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-9">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-300 ring-1 ring-cyan-300/20">
                        <ShieldCheck className="h-7 w-7" />
                    </div>

                    <h1 className="mt-7 text-3xl font-extrabold tracking-tight">
                        Rider sign in
                    </h1>

                    <p className="mt-3 text-sm leading-6 text-slate-400">
                                                Sign in with the email address or phone number
                        linked to your NOPTRIX rider account. We will send
                        a verification code to your available contact method(s).
                    </p>

                    {error && (
                        <div
                            role="alert"
                            className="mt-6 flex gap-3 rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200"
                        >
                            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                            <p>{error}</p>
                        </div>
                    )}

                    <form
                        onSubmit={handleSubmit}
                        className="mt-8 space-y-5"
                    >
                        <div>
                            <label
                                                                htmlFor="rider-identifier"
                                className="mb-2 block text-sm font-semibold text-slate-200"
                            >
                                                                Email or phone number

                            </label>

                            <div className="relative">
                                <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />

                                <input
                                                                        id="rider-identifier"
                                    name="identifier"
                                    type="text"
                                    inputMode="text"
                                    autoComplete="username"
                                    autoCapitalize="none"
                                    autoCorrect="off"
                                    spellCheck={false}
                                    required
                                    disabled={loading}
                                                                        value={identifier}
                                    onChange={(event) => {
                                        setIdentifier(event.target.value);
                                        setError("");
                                    }}
                                                                        placeholder="Email address or +9665XXXXXXXX"
                                    className="w-full rounded-xl border border-white/10 bg-slate-900/80 py-3.5 pl-12 pr-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 disabled:opacity-60"
                                />
                            </div>
                        </div>

                        <div>
                            <label
                                htmlFor="rider-password"
                                className="mb-2 block text-sm font-semibold text-slate-200"
                            >
                                Password
                            </label>

                            <div className="relative">
                                <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />

                                <input
                                    id="rider-password"
                                    name="password"
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
                                    className="w-full rounded-xl border border-white/10 bg-slate-900/80 py-3.5 pl-12 pr-12 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 disabled:opacity-60"
                                />

                                <button
                                    type="button"
                                    aria-label={
                                        showPassword
                                            ? "Hide password"
                                            : "Show password"
                                    }
                                    onClick={() =>
                                        setShowPassword((visible) => !visible)
                                    }
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

                        <div className="flex justify-end">
                            <Link
                                href="/rider/forgot-password"
                                className="text-sm font-semibold text-cyan-300 transition hover:text-cyan-200"
                            >
                                Forgot password?
                            </Link>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-3.5 font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {loading ? (
                                <>
                                    <LoaderCircle className="h-5 w-5 animate-spin" />
                                    Sending verification code...
                                </>
                            ) : (
                                <>
                                    Continue
                                    <ArrowRight className="h-4 w-4" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-7 border-t border-white/10 pt-6">
                        <p className="text-center text-xs leading-5 text-slate-500">
                            Rider accounts are invitation-only.
                            Contact your NOPTRIX administrator if
                            you need account assistance.
                        </p>
                    </div>
                </section>

                <p className="mt-6 text-center text-xs text-slate-600">
                    © {new Date().getFullYear()} NOPTRIX. Rider access only.
                </p>
            </div>
        </main>
    );
}
