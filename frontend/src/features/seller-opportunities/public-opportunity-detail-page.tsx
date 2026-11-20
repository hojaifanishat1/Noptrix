
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  FileText,
  Loader2,
  Store,
  Users,
} from "lucide-react";

import { sellerOpportunitiesApi } from "@/services/api/seller-opportunities.api";
import type { SellerOpportunity } from "./seller-opportunity.types";

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
        month: "long",
        year: "numeric",
      });
}

export default function PublicSellerOpportunityDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [opportunity, setOpportunity] = useState<SellerOpportunity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const result = await sellerOpportunitiesApi.getPublicBySlug(slug);

        if (active) setOpportunity(result);
      } catch (requestError) {
        if (active) {
          setError(getErrorMessage(requestError));
          setOpportunity(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    if (slug) void load();

    return () => {
      active = false;
    };
  }, [slug]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading opportunity...
        </div>
      </main>
    );
  }

  if (!opportunity) {
    return (
      <main className="min-h-screen bg-gray-50 px-4 py-16">
        <div className="mx-auto max-w-2xl rounded-2xl border border-gray-200 bg-white p-8 text-center">
          <Store className="mx-auto h-10 w-10 text-gray-300" />
          <h1 className="mt-4 text-xl font-bold text-gray-900">
            Opportunity not found
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            {error || "This opportunity may no longer be available."}
          </p>
          <Link
            href="/become-a-seller"
            className="mt-6 inline-flex h-11 items-center rounded-xl bg-gray-900 px-5 text-sm font-semibold text-white"
          >
            Browse opportunities
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/become-a-seller"
          className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-blue-700"
        >
          <ArrowLeft className="h-4 w-4" />
          All opportunities
        </Link>

        <article className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <header className="bg-gray-950 px-6 py-10 text-white sm:px-10">
            <span className="inline-flex rounded-full bg-blue-500/15 px-3 py-1 text-xs font-semibold text-blue-200">
              {opportunity.category}
            </span>

            <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
              {opportunity.title}
            </h1>

            <p className="mt-4 max-w-3xl text-sm leading-7 text-gray-300">
              {opportunity.summary}
            </p>

            <div className="mt-7 flex flex-wrap gap-5 text-sm text-gray-300">
              <span className="inline-flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                Deadline: {formatDate(opportunity.applicationDeadline)}
              </span>

              <span className="inline-flex items-center gap-2">
                <Users className="h-4 w-4" />
                Target: {opportunity.targetSellerCount.toLocaleString()} sellers
              </span>
            </div>
          </header>

          <div className="space-y-10 p-6 sm:p-10">
            <section>
              <h2 className="text-lg font-bold text-gray-900">
                About this opportunity
              </h2>
              <div className="mt-4 whitespace-pre-wrap text-sm leading-7 text-gray-600">
                {opportunity.description}
              </div>
            </section>

            {opportunity.eligibility.length > 0 && (
              <section>
                <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
                  <CheckCircle2 className="h-5 w-5 text-blue-600" />
                  Eligibility requirements
                </h2>

                <ul className="mt-4 space-y-3">
                  {opportunity.eligibility.map((item, index) => (
                    <li key={`${index}-${item}`} className="flex gap-3 text-sm leading-6 text-gray-600">
                      <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-green-600" />
                      {item}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {opportunity.requiredDocuments.length > 0 && (
              <section>
                <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
                  <FileText className="h-5 w-5 text-blue-600" />
                  Required documents
                </h2>

                <div className="mt-4 divide-y divide-gray-100 rounded-xl border border-gray-200">
                  {opportunity.requiredDocuments.map((document) => (
                    <div
                      key={document.key}
                      className="flex flex-col justify-between gap-2 p-4 sm:flex-row sm:items-center"
                    >
                      <div>
                        <p className="text-sm font-semibold text-gray-800">
                          {document.label}
                          {document.required && (
                            <span className="ml-2 text-xs text-red-600">
                              Required
                            </span>
                          )}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          Maximum file size: {document.maxSizeMB} MB
                        </p>
                      </div>

                      <p className="text-xs text-gray-500">
                        {document.acceptedMimeTypes.length
                          ? document.acceptedMimeTypes.join(", ")
                          : "Accepted file types: not specified"}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {opportunity.applicationForm.length > 0 && (
              <section>
                <h2 className="text-lg font-bold text-gray-900">
                  Application information
                </h2>
                <p className="mt-2 text-sm text-gray-500">
                  This opportunity includes {opportunity.applicationForm.length} additional application field
                  {opportunity.applicationForm.length === 1 ? "" : "s"}.
                </p>
              </section>
            )}

            <section className="rounded-2xl border border-blue-100 bg-blue-50 p-5 sm:p-6">
              <h2 className="text-lg font-bold text-gray-900">
                Interested in joining NOPTRIX?
              </h2>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                Sign in with your customer account to submit your seller application.
              </p>

              <Link
                href={`/seller-application?opportunitySlug=${encodeURIComponent(opportunity.slug)}`}
                className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Apply for this opportunity
                <ArrowLeft className="h-4 w-4 rotate-180" />
              </Link>
            </section>
          </div>
        </article>
      </div>
    </main>
  );
}
