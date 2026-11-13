"use client";

import {
    useEffect,
    useState,
} from "react";

import Link from "next/link";

import {
    customerAuthApi,
} from "@/services/api/customer-auth.api";

import type {
    AuthUser,
} from "@/types/auth";

export default function AccountPage() {
    const [user, setUser] =
        useState<AuthUser | null>(null);

    const [loading, setLoading] =
        useState(true);

    const [error, setError] =
        useState("");

    useEffect(() => {
        const loadCustomer =
            async () => {
                try {
                    const customer =
                        await customerAuthApi.getMe();

                    setUser(customer);
                } catch (error) {
                    setError(
                        error instanceof Error
                            ? error.message
                            : "Unable to load your account.",
                    );
                } finally {
                    setLoading(false);
                }
            };

        void loadCustomer();
    }, []);

    if (loading) {
        return (
            <main className="flex min-h-screen items-center justify-center px-4">
                <p className="text-gray-600">
                    Loading your account...
                </p>
            </main>
        );
    }

    if (error) {
        return (
            <main className="flex min-h-screen items-center justify-center px-4">
                <div className="text-center">
                    <h1 className="text-2xl font-bold">
                        Unable to load account
                    </h1>

                    <p className="mt-3 text-sm text-red-600">
                        {error}
                    </p>

                    <Link
                        href="/customer/login"
                        className="mt-6 inline-block font-medium underline"
                    >
                        Back to login
                    </Link>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen px-4 py-12">
            <div className="mx-auto max-w-3xl">
                <h1 className="text-3xl font-bold">
                    My Account
                </h1>

                <div className="mt-8 rounded-xl border p-6">
                    <h2 className="text-xl font-semibold">
                        {user?.name ?? "Customer"}
                    </h2>

                    <div className="mt-4 space-y-2 text-sm">
                        <p>
                            <span className="font-medium">
                                Email:
                            </span>{" "}
                            {user?.email}
                        </p>

                        {user?.phone && (
                            <p>
                                <span className="font-medium">
                                    Phone:
                                </span>{" "}
                                {user.phone}
                            </p>
                        )}

                        <p>
                            <span className="font-medium">
                                Account:
                            </span>{" "}
                            {user?.accountType}
                        </p>
                    </div>
                </div>


                <section className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-6">
                    <div className="flex items-start gap-4">
                        <div className="rounded-full bg-white p-3 text-blue-700">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                            >
                                <path d="M3 21h18" />
                                <path d="M5 21V7l8-4v18" />
                                <path d="M19 21V11l-6-4" />
                                <path d="M9 9v.01M9 12v.01M9 15v.01M9 18v.01" />
                            </svg>
                        </div>
                        <div className="min-w-0 flex-1">
                            <h2 className="text-xl font-semibold">
                                Become a Seller
                            </h2>
                            <p className="mt-2 text-sm text-gray-600">
                                Apply to sell your products on NOPTRIX and track your application status.
                            </p>
                            <Link
                                href="/seller-application"
                                className="mt-4 inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
                            >
                                Apply to Become a Seller
                            </Link>
                        </div>
                    </div>
                </section>

                <section className="mt-6 rounded-xl border p-6">
                    <div className="flex items-start gap-4">
                        <div className="rounded-full bg-blue-100 p-3 text-blue-700">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                            >
                                <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z" />
                            </svg>
                        </div>

                        <div className="min-w-0 flex-1">
                            <h2 className="text-xl font-semibold">
                                Need help?
                            </h2>

                            <p className="mt-2 text-sm text-gray-600">
                                Contact the NOPTRIX support team about your
                                orders, payments, delivery, or account.
                            </p>

                            <Link
                                href="/account/support"
                                className="mt-4 inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
                            >
                                Open Live Chat
                            </Link>
                        </div>
                    </div>
                </section>

                <div className="mt-6">
                    <Link
                        href="/"
                        className="font-medium underline"
                    >
                        Continue shopping
                    </Link>
                </div>
            </div>
        </main>
    );
}
