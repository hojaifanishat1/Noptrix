
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Search,
  Store,
  Users,
} from "lucide-react";

import { sellerOpportunitiesApi } from "@/services/api/seller-opportunities.api";
import type {
  SellerOpportunity,
  SellerOpportunityPagination,
} from "./seller-opportunity.types";

const PAGE_SIZE = 12;

const EMPTY_PAGINATION: SellerOpportunityPagination = {
  page: 1,
  limit: PAGE_SIZE,
  total: 0,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false,
};

function getErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (
      error as { response?: { data?: { message?: string } } }
    ).response;

    if (response?.data?.message) return response.data.message;
  }

  return error instanceof Error ? error.message : "Something went wrong.";
}

function formatDate(value?: string): string {
  if (!value) return "No deadline";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "No deadline"
    : date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
}

function OpportunityCard({
  opportunity,
}: {
  opportunity: SellerOpportunity;
}) {
  return (
    <article className="flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
          {opportunity.category}
        </span>

        <span className="text-xs text-gray-500">
          {opportunity.targetSellerCount.toLocaleString()} seller
          {opportunity.targetSellerCount === 1 ? "" : "s"} targeted
        </span>
      </div>

      <h2 className="text-xl font-bold text-gray-900">
        {opportunity.title}
      </h2>

      <p className="mt-3 flex-1 text-sm leading-6 text-gray-600">
        {opportunity.summary}
      </p>

      <div className="mt-6 space-y-3 border-t border-gray-100 pt-4">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <CalendarDays className="h-4 w-4" />
          <span>Application deadline: {formatDate(opportunity.applicationDeadline)}</span>
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Users className="h-4 w-4" />
          <span>{opportunity.eligibility.length} eligibility criteria</span>
        </div>
      </div>

      <Link
        href={`/become-a-seller/${encodeURIComponent(opportunity.slug)}`}
        className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gray-900 px-5 text-sm font-semibold text-white transition hover:bg-blue-700"
      >
        View opportunity
        <ArrowRight className="h-4 w-4" />
      </Link>
    </article>
  );
}

export default function PublicSellerOpportunitiesPage() {
  const [opportunities, setOpportunities] = useState<SellerOpportunity[]>([]);
  const [pagination, setPagination] =
    useState<SellerOpportunityPagination>(EMPTY_PAGINATION);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadOpportunities = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await sellerOpportunitiesApi.listPublic({
        page,
        limit: PAGE_SIZE,
        ...(search ? { search } : {}),
      });

      setOpportunities(result.opportunities ?? []);
      setPagination(result.pagination ?? EMPTY_PAGINATION);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
      setOpportunities([]);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    void loadOpportunities();
  }, [loadOpportunities]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setPage(1);
      setSearch(searchInput.trim());
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  return (
    <main className="min-h-screen bg-gray-50">
      <section className="bg-gray-950 px-4 py-16 text-white sm:px-6 lg:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold text-blue-200">
            <Store className="h-4 w-4" />
            NOPTRIX Seller Network
          </div>

          <h1 className="mt-6 max-w-3xl text-3xl font-bold tracking-tight sm:text-5xl">
            Grow your business with NOPTRIX
          </h1>

          <p className="mt-5 max-w-2xl text-base leading-7 text-gray-300">
            Explore seller opportunities, review eligibility requirements
            and apply to become part of our marketplace.
          </p>

          <a
            href="#opportunities"
            className="mt-8 inline-flex h-12 items-center gap-2 rounded-xl bg-blue-600 px-6 text-sm font-semibold text-white hover:bg-blue-500"
          >
            Explore opportunities
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </section>

      <section
        id="opportunities"
        className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:py-16"
      >
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-blue-700">
              Open opportunities
            </p>
            <h2 className="mt-2 text-2xl font-bold text-gray-900 sm:text-3xl">
              Find your opportunity
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              Discover current seller recruitment programs.
            </p>
          </div>

          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search opportunities..."
              className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>

        {error && (
          <div role="alert" className="mt-8 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
            <button
              type="button"
              onClick={() => void loadOpportunities()}
              className="ml-3 font-semibold underline"
            >
              Try again
            </button>
          </div>
        )}

        {loading ? (
          <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-72 animate-pulse rounded-2xl border border-gray-200 bg-white"
              />
            ))}
          </div>
        ) : opportunities.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
            <Store className="mx-auto h-10 w-10 text-gray-300" />
            <h3 className="mt-4 font-semibold text-gray-900">
              No opportunities found
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              {search
                ? "Try another search term."
                : "There are no open seller opportunities at the moment. Please check again later."}
            </p>
          </div>
        ) : (
          <>
            <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {opportunities.map((opportunity) => (
                <OpportunityCard
                  key={opportunity._id}
                  opportunity={opportunity}
                />
              ))}
            </div>

            <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-gray-200 pt-6 sm:flex-row">
              <p className="text-sm text-gray-500">
                Page {pagination.page} of {Math.max(1, pagination.totalPages)}
                {" · "}
                {pagination.total.toLocaleString()} opportunities
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!pagination.hasPreviousPage}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  className="h-10 rounded-lg border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>

                <button
                  type="button"
                  disabled={!pagination.hasNextPage}
                  onClick={() => setPage((current) => current + 1)}
                  className="h-10 rounded-lg border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
