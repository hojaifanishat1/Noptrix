
"use client";

import {
    FormEvent,
    useEffect,
    useState,
    useSyncExternalStore,
} from "react";
import { isAxiosError } from "axios";
import Link from "next/link";
import {
    riderResendLoginCode,
    riderVerifyLogin,
} from "@/features/auth/auth-actions";

const RIDER_CHALLENGE_STORAGE_KEY =
    "noptrix:rider-login-challenge";

interface RiderLoginVerificationChallenge {
    verificationRequired: true;
    challengeId: string;
    email: string;
    phone: string;
    expiresAt: string;
    resendAvailableAt: string;
}

const subscribeToChallenge = (callback: () => void) => {
    window.addEventListener("storage", callback);

    return () => window.removeEventListener("storage", callback);
};

const getStoredChallenge = () =>
    sessionStorage.getItem(RIDER_CHALLENGE_STORAGE_KEY);

const parseChallenge = (
    serializedChallenge: string | null,
): RiderLoginVerificationChallenge | null => {
    if (!serializedChallenge) return null;

    try {
        const parsed = JSON.parse(
            serializedChallenge,
        ) as RiderLoginVerificationChallenge;

        if (
            parsed.verificationRequired === true &&
            typeof parsed.challengeId === "string" &&
            typeof parsed.email === "string" &&
            typeof parsed.phone === "string" &&
            typeof parsed.expiresAt === "string" &&
            typeof parsed.resendAvailableAt === "string"
        ) {
            return parsed;
        }
    } catch {
        return null;
    }

    return null;
};

const getErrorMessage = (error: unknown): string => {
    if (isAxiosError<{ message?: string }>(error)) {
        return (
            error.response?.data?.message ??
            error.message ??
            "Something went wrong."
        );
    }

    return error instanceof Error
        ? error.message
        : "Verification failed. Please try again.";
};

export default function RiderLoginVerificationForm() {
    const serializedChallenge = useSyncExternalStore(
        subscribeToChallenge,
        getStoredChallenge,
        () => null,
    );

    const [updatedChallenge, setUpdatedChallenge] =
        useState<RiderLoginVerificationChallenge | null>(null);

    const [code, setCode] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [secondsLeft, setSecondsLeft] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);

    const challenge =
        updatedChallenge ?? parseChallenge(serializedChallenge);

    const resendTimestamp = challenge
        ? new Date(challenge.resendAvailableAt).getTime()
        : 0;

    const expiresTimestamp = challenge
        ? new Date(challenge.expiresAt).getTime()
        : 0;

    const isExpired =
        !Number.isFinite(expiresTimestamp) ||
        (currentTime > 0 && expiresTimestamp <= currentTime);

    useEffect(() => {
        if (!challenge) return;

        const updateCountdown = () => {
            const now = Date.now();

            setCurrentTime(now);

            setSecondsLeft(
                Math.max(
                    0,
                    Math.ceil((resendTimestamp - now) / 1000),
                ),
            );
        };

        updateCountdown();

        const interval = window.setInterval(
            updateCountdown,
            1000,
        );

        return () => window.clearInterval(interval);
    }, [resendTimestamp, challenge]);

    const saveChallenge = (
        nextChallenge: RiderLoginVerificationChallenge,
    ) => {
        sessionStorage.setItem(
            RIDER_CHALLENGE_STORAGE_KEY,
            JSON.stringify(nextChallenge),
        );

        setUpdatedChallenge(nextChallenge);
        setCode("");
        setError("");
    };

    const handleSubmit = async (
        event: FormEvent<HTMLFormElement>,
    ) => {
        event.preventDefault();

        if (!challenge) {
            setError(
                "Your verification session is missing. Please sign in again.",
            );
            return;
        }

        if (isExpired) {
            setError(
                "Your verification code has expired. Please sign in again.",
            );
            return;
        }

        if (!/^\d{6}$/.test(code)) {
            setError("Enter the complete six-digit verification code.");
            return;
        }

        setLoading(true);
        setError("");

        try {
            await riderVerifyLogin({
                challengeId: challenge.challengeId,
                code,
            });

            sessionStorage.removeItem(
                RIDER_CHALLENGE_STORAGE_KEY,
            );

            window.location.replace("/rider/dashboard");
        } catch (verificationError: unknown) {
            setError(getErrorMessage(verificationError));
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        if (
            !challenge ||
            loading ||
            secondsLeft > 0 ||
            isExpired
        ) {
            return;
        }

        setLoading(true);
        setError("");

        try {
            const nextChallenge = await riderResendLoginCode(
                challenge.challengeId,
            );

            saveChallenge(nextChallenge);
        } catch (resendError: unknown) {
            setError(getErrorMessage(resendError));
        } finally {
            setLoading(false);
        }
    };

    if (!challenge) {
        return (
            <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-5">
                <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-blue-200/40 blur-3xl" />
                <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-indigo-200/40 blur-3xl" />

                <section className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-200/60 sm:p-10">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.7"
                            className="h-8 w-8"
                        >
                            <circle cx="12" cy="12" r="9" />
                            <path d="M12 7v5m0 4h.01" />
                        </svg>
                    </div>

                    <h1 className="mt-6 text-2xl font-bold text-slate-900">
                        Verification unavailable
                    </h1>

                    <p className="mt-3 text-sm leading-6 text-slate-500">
                        No active Rider verification was found.
                        Return to the login page to start a new session.
                    </p>

                    <Link
                        href="/rider/login"
                        className="mt-7 inline-flex w-full items-center justify-center rounded-xl bg-blue-700 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-blue-800"
                    >
                        Return to Rider login
                    </Link>

                    <p className="mt-6 text-xs text-slate-400">
                        NOPTRIX · Rider Portal
                    </p>
                </section>
            </main>
        );
    }

    return (
        <main className="relative min-h-screen overflow-hidden bg-white text-slate-900">
            <div
                aria-hidden="true"
                className="pointer-events-none absolute -left-40 -top-40 h-[480px] w-[480px] rounded-full bg-blue-100/60 blur-3xl"
            />

            <div
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-48 -right-32 h-[520px] w-[520px] rounded-full bg-indigo-100/50 blur-3xl"
            />

            {/* Header */}
            <header className="relative z-10 border-b border-slate-100 bg-white/80 backdrop-blur-xl">
                <div className="mx-auto flex h-20 max-w-[1600px] items-center justify-between px-5 sm:px-8 lg:px-12">
                    <Link
                        href="/rider/login"
                        className="flex items-center gap-3"
                    >
                        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-700 text-lg font-black text-white shadow-lg shadow-blue-700/20">
                            N
                        </span>

                        <span>
                            <span className="block text-lg font-extrabold tracking-[0.12em]">
                                NOPTRIX
                            </span>
                            <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                                Rider Portal
                            </span>
                        </span>
                    </Link>

                    <div className="flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 sm:px-4">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        <span>Secure verification</span>
                    </div>
                </div>
            </header>

            <div className="relative z-10 mx-auto grid min-h-[calc(100vh-5rem)] max-w-[1600px] lg:grid-cols-2">
                {/* Branding */}
                <section className="hidden flex-col justify-center px-12 py-16 lg:flex xl:px-24">
                    <div className="mb-8 inline-flex w-fit items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            className="h-4 w-4"
                        >
                            <path d="M12 3 19 6v5c0 4.5-3 7.5-7 10-4-2.5-7-5.5-7-10V6l7-3Z" />
                            <path d="m9 12 2 2 4-4" />
                        </svg>
                        Rider identity protection
                    </div>

                    <h1 className="max-w-xl text-5xl font-extrabold leading-[1.12] tracking-tight text-slate-950 xl:text-6xl">
                        One more step.
                        <span className="mt-2 block text-blue-700">
                            Complete confidence.
                        </span>
                    </h1>

                    <p className="mt-7 max-w-lg text-lg leading-8 text-slate-500">
                        Verify your Rider account to securely access
                        your delivery assignments, earnings and rider tools.
                    </p>

                    <div className="mt-12 space-y-4">
                        <div className="flex items-start gap-4 rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-sm">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                                <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.8"
                                    className="h-5 w-5"
                                >
                                    <rect x="5" y="10" width="14" height="11" rx="2" />
                                    <path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" />
                                </svg>
                            </div>

                            <div>
                                <h2 className="font-bold text-slate-900">
                                    Dual-channel protection
                                </h2>
                                <p className="mt-1 text-sm leading-6 text-slate-500">
                                    Your sign-in code is delivered to both
                                    your registered email and phone.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4 rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-sm">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
                                <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.8"
                                    className="h-5 w-5"
                                >
                                    <circle cx="12" cy="12" r="9" />
                                    <path d="M12 7v5l3 2" />
                                </svg>
                            </div>

                            <div>
                                <h2 className="font-bold text-slate-900">
                                    Time-sensitive code
                                </h2>
                                <p className="mt-1 text-sm leading-6 text-slate-500">
                                    Use your latest six-digit code before
                                    it expires. Never share it.
                                </p>
                            </div>
                        </div>
                    </div>

                    <p className="mt-12 text-xs text-slate-400">
                        NOPTRIX · Secure Rider Management
                    </p>
                </section>

                {/* Verification panel */}
                <section className="flex items-center justify-center px-5 py-12 sm:px-8 lg:justify-end lg:px-12 xl:px-24">
                    <div className="w-full max-w-[480px]">
                        <div className="mb-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 lg:hidden">
                            <span className="h-px flex-1 bg-slate-200" />
                            Rider verification
                            <span className="h-px flex-1 bg-slate-200" />
                        </div>

                        <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-2xl shadow-slate-200/60 sm:p-9">
                            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 ring-1 ring-blue-100">
                                <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.7"
                                    className="h-7 w-7"
                                >
                                    <rect x="4" y="10" width="16" height="11" rx="2" />
                                    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                                    <circle cx="12" cy="15" r="1" />
                                    <path d="M12 16v2" />
                                </svg>
                            </div>

                            <div className="mt-7">
                                <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
                                    Rider access
                                </p>

                                <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
                                    Verify your sign-in
                                </h2>

                                <p className="mt-3 text-sm leading-6 text-slate-500">
                                    Enter the six-digit code sent to both
                                    your registered email and phone.
                                </p>
                            </div>

                            {/* Email */}
                            <div className="mt-7 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-slate-500 shadow-sm ring-1 ring-slate-200">
                                    <svg
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.7"
                                        className="h-5 w-5"
                                    >
                                        <rect x="3" y="5" width="18" height="14" rx="2" />
                                        <path d="m4 7 8 6 8-6" />
                                    </svg>
                                </div>

                                <div className="min-w-0">
                                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                        Verification email
                                    </p>
                                    <p className="mt-1 break-all text-sm font-semibold text-slate-800">
                                        {challenge.email}
                                    </p>
                                </div>
                            </div>

                            {/* Phone */}
                            <div className="mt-3 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-slate-500 shadow-sm ring-1 ring-slate-200">
                                    <svg
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.7"
                                        className="h-5 w-5"
                                    >
                                        <path d="M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
                                        <path d="M11 17h2" />
                                    </svg>
                                </div>

                                <div className="min-w-0">
                                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                        Verification phone
                                    </p>
                                    <p className="mt-1 break-all text-sm font-semibold text-slate-800">
                                        {challenge.phone}
                                    </p>
                                </div>
                            </div>

                            {/* OTP form */}
                            <form
                                onSubmit={handleSubmit}
                                className="mt-7 space-y-5"
                            >
                                <div>
                                    <div className="mb-3 flex items-center justify-between gap-3">
                                        <label
                                            htmlFor="rider-login-code"
                                            className="text-sm font-bold text-slate-800"
                                        >
                                            Verification code
                                        </label>

                                        <span className="text-xs font-medium text-slate-400">
                                            6 digits
                                        </span>
                                    </div>

                                    <input
                                        id="rider-login-code"
                                        name="code"
                                        type="text"
                                        inputMode="numeric"
                                        autoComplete="one-time-code"
                                        autoFocus
                                        value={code}
                                        onChange={(event) => {
                                            setCode(
                                                event.target.value
                                                    .replace(/\D/g, "")
                                                    .slice(0, 6),
                                            );

                                            if (error) setError("");
                                        }}
                                        required
                                        minLength={6}
                                        maxLength={6}
                                        pattern="[0-9]{6}"
                                        aria-invalid={Boolean(error)}
                                        placeholder="000000"
                                        className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-5 text-center font-mono text-3xl font-bold tracking-[0.45em] text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 sm:tracking-[0.6em]"
                                    />

                                    <p className="mt-3 text-xs leading-5 text-slate-400">
                                        Check your email inbox and SMS messages.
                                        Use the same code from either channel.
                                    </p>
                                </div>

                                {error && (
                                    <div
                                        role="alert"
                                        className="flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-sm leading-6 text-red-700"
                                    >
                                        <svg
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="1.8"
                                            className="mt-0.5 h-5 w-5 shrink-0"
                                        >
                                            <circle cx="12" cy="12" r="9" />
                                            <path d="M12 8v5m0 3h.01" />
                                        </svg>
                                        <span>{error}</span>
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={
                                        loading ||
                                        code.length !== 6 ||
                                        isExpired
                                    }
                                    className="group flex w-full items-center justify-center gap-3 rounded-xl bg-blue-700 px-5 py-4 text-sm font-bold text-white shadow-lg shadow-blue-700/20 transition duration-200 hover:-translate-y-0.5 hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                                >
                                    {loading ? (
                                        <>
                                            <svg
                                                className="h-5 w-5 animate-spin"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                            >
                                                <circle
                                                    className="opacity-25"
                                                    cx="12"
                                                    cy="12"
                                                    r="10"
                                                    stroke="currentColor"
                                                    strokeWidth="4"
                                                />
                                                <path
                                                    fill="currentColor"
                                                    d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z"
                                                />
                                            </svg>
                                            Verifying securely...
                                        </>
                                    ) : (
                                        <>
                                            Verify and sign in
                                            <svg
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                className="h-5 w-5 transition-transform group-hover:translate-x-1"
                                            >
                                                <path d="M5 12h14m-6-6 6 6-6 6" />
                                            </svg>
                                        </>
                                    )}
                                </button>
                            </form>

                            {/* Resend */}
                            <div className="mt-6 flex flex-col gap-4 border-t border-slate-100 pt-6">
                                <div className="text-center">
                                    <p className="text-sm text-slate-500">
                                        Didn&apos;t receive the code?
                                    </p>

                                    <button
                                        type="button"
                                        onClick={handleResend}
                                        disabled={
                                            loading ||
                                            secondsLeft > 0 ||
                                            isExpired
                                        }
                                        className="mt-2 inline-flex items-center justify-center gap-2 text-sm font-bold text-blue-700 transition hover:text-blue-900 disabled:cursor-not-allowed disabled:text-slate-400"
                                    >
                                        {loading ? (
                                            "Please wait..."
                                        ) : secondsLeft > 0 ? (
                                            `Resend available in ${Math.floor(secondsLeft / 60)
                                                .toString()
                                                .padStart(2, "0")}:${(secondsLeft % 60)
                                                .toString()
                                                .padStart(2, "0")}`
                                        ) : isExpired ? (
                                            "Code expired — sign in again"
                                        ) : (
                                            "Resend verification code"
                                        )}
                                    </button>
                                </div>

                                <Link
                                    href="/rider/login"
                                    onClick={() => {
                                        sessionStorage.removeItem(
                                            RIDER_CHALLENGE_STORAGE_KEY,
                                        );
                                    }}
                                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                                >
                                    Back to login
                                </Link>
                            </div>

                            {/* Security notice */}
                            <div className="mt-6 flex items-start gap-3 rounded-xl bg-slate-50 p-4">
                                <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.7"
                                    className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600"
                                >
                                    <path d="M12 3 19 6v5c0 4.5-3 7.5-7 10-4-2.5-7-5.5-7-10V6l7-3Z" />
                                    <path d="m9 12 2 2 4-4" />
                                </svg>

                                <p className="text-xs leading-5 text-slate-500">
                                    <span className="font-bold text-slate-700">
                                        Security tip:
                                    </span>{" "}
                                    Never share your verification code with
                                    anyone, including someone claiming to be
                                    NOPTRIX support.
                                </p>
                            </div>
                        </div>

                        <p className="mt-6 text-center text-xs leading-5 text-slate-400">
                            Protected by NOPTRIX security systems.
                            <br />
                            Authorized Rider access only.
                        </p>
                    </div>
                </section>
            </div>
        </main>
    );
}
