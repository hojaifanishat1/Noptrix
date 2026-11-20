"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { sellerOpportunitiesApi } from "@/services/api/seller-opportunities.api";
import type { SellerOpportunity } from "@/features/seller-opportunities/seller-opportunity.types";

export default function SellerOpportunityDetailsPage() {
  const params = useParams<{ opportunityId: string }>();
  const router = useRouter();
  const id = params.opportunityId;
  const [item, setItem] = useState<SellerOpportunity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    try {
      setItem(await sellerOpportunitiesApi.getById(id));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load opportunity.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const act = async (action: "publish" | "pause" | "close" | "delete") => {
    if (!item || working) return;
    const messages = {
      publish: "Publish this opportunity?",
      pause: "Pause this opportunity? New applications will stop.",
      close: "Close this opportunity? It cannot be reopened.",
      delete: "Permanently delete this draft opportunity?",
    };
    if (!window.confirm(messages[action])) return;
    setWorking(true);
    setError("");
    try {
      if (action === "publish") await sellerOpportunitiesApi.publish(id);
      if (action === "pause") await sellerOpportunitiesApi.pause(id);
      if (action === "close") await sellerOpportunitiesApi.close(id);
      if (action === "delete") {
        await sellerOpportunitiesApi.delete(id);
        router.push("/admin/seller-opportunities");
        return;
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setWorking(false);
    }
  };

  if (loading) return <main className="p-8 text-sm text-gray-500">Loading opportunity...</main>;
  if (!item) return <main className="p-8 text-sm text-red-600">{error || "Opportunity not found."}</main>;

  return (
    <main className="min-h-full bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-5xl">
        <Link href="/admin/seller-opportunities" className="text-sm font-semibold text-gray-500 hover:text-gray-900">← Seller Opportunities</Link>
        <div className="mt-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{item.status}</span>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{item.visibility}</span>
              <span className="text-xs text-gray-500">{item.category}</span>
            </div>
            <h1 className="mt-3 text-2xl font-bold text-gray-950">{item.title}</h1>
            <p className="mt-1 text-sm text-gray-500">/{item.slug}</p>
          </div>
          <Link href={`/admin/seller-opportunities/${id}/edit`} className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700">Edit opportunity</Link>
        </div>

        {error && <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        <div className="mt-6 flex flex-wrap gap-2">
          {item.status === "DRAFT" && <button disabled={working} onClick={() => void act("publish")} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Publish</button>}
          {item.status === "PUBLISHED" && <button disabled={working} onClick={() => void act("pause")} className="rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Pause</button>}
          {(item.status === "PUBLISHED" || item.status === "PAUSED") && <button disabled={working} onClick={() => void act("close")} className="rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Close</button>}
          {item.status === "DRAFT" && <button disabled={working} onClick={() => void act("delete")} className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 disabled:opacity-50">Delete draft</button>}
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <section className="rounded-2xl border border-gray-200 bg-white p-5 md:col-span-2">
            <h2 className="font-bold text-gray-900">Summary</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-600">{item.summary}</p>
            <h2 className="mt-6 font-bold text-gray-900">Description</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-600">{item.description}</p>
          </section>
          <section className="rounded-2xl border border-gray-200 bg-white p-5">
            <h2 className="font-bold text-gray-900">Campaign settings</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-gray-500">Target sellers</dt><dd className="font-semibold">{item.targetSellerCount.toLocaleString()}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-gray-500">Deadline</dt><dd className="font-semibold">{item.applicationDeadline ? new Date(item.applicationDeadline).toLocaleDateString() : "No deadline"}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-gray-500">Visibility</dt><dd className="font-semibold">{item.visibility}</dd></div>
            </dl>
          </section>
          <section className="rounded-2xl border border-gray-200 bg-white p-5">
            <h2 className="font-bold text-gray-900">Eligibility</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-gray-600">
              {item.eligibility.map((value, index) => <li key={`${value}-${index}`}>{value}</li>)}
              {item.eligibility.length === 0 && <li>No eligibility requirements configured.</li>}
            </ul>
          </section>
          <section className="rounded-2xl border border-gray-200 bg-white p-5">
            <h2 className="font-bold text-gray-900">Required documents ({item.requiredDocuments.length})</h2>
            <ul className="mt-3 space-y-3 text-sm">
              {item.requiredDocuments.map((doc) => <li key={doc.key} className="border-b border-gray-100 pb-2"><p className="font-semibold">{doc.label}</p><p className="mt-1 text-xs text-gray-500">{doc.required ? "Required" : "Optional"} · Max {doc.maxSizeMB} MB · {doc.acceptedMimeTypes.join(", ")}</p></li>)}
              {item.requiredDocuments.length === 0 && <li className="text-gray-500">No documents required.</li>}
            </ul>
          </section>
          <section className="rounded-2xl border border-gray-200 bg-white p-5">
            <h2 className="font-bold text-gray-900">Application questions ({item.applicationForm.length})</h2>
            <ol className="mt-3 list-decimal space-y-3 pl-5 text-sm">
              {item.applicationForm.map((field) => <li key={field.key}><p className="font-semibold">{field.label}</p><p className="mt-1 text-xs text-gray-500">{field.type} · {field.required ? "Required" : "Optional"} · key: {field.key}</p>{field.options?.length ? <p className="mt-1 text-xs text-gray-500">Options: {field.options.join(", ")}</p> : null}</li>)}
              {item.applicationForm.length === 0 && <li className="text-gray-500">No additional questions.</li>}
            </ol>
          </section>
        </div>
      </div>
    </main>
  );
}
