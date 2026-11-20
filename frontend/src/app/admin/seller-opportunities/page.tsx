"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Plus, RefreshCw, Search } from "lucide-react";
import { sellerOpportunitiesApi } from "@/services/api/seller-opportunities.api";
import {
  SELLER_OPPORTUNITY_STATUSES,
  type SellerOpportunity,
  type SellerOpportunityStatus,
} from "@/features/seller-opportunities/seller-opportunity.types";

const PAGE_SIZE = 10;

export default function SellerOpportunitiesPage() {
  const [items, setItems] = useState<SellerOpportunity[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<SellerOpportunityStatus | "">("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await sellerOpportunitiesApi.list({
        page,
        limit: PAGE_SIZE,
        search: search || undefined,
        status: status || undefined,
      });
      setItems(result.opportunities);
      setTotal(result.pagination.total);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load seller opportunities.");
    } finally {
      setLoading(false);
    }
  }, [page, search, status]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setSearch(searchInput.trim());
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="min-h-full bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-[1500px]">
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Seller Management</p>
            <h1 className="mt-2 text-2xl font-bold text-gray-950">Seller Opportunities</h1>
            <p className="mt-1 text-sm text-gray-500">Create and manage seller recruitment campaigns.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
            </button>
            <Link href="/admin/seller-opportunities/create" className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white">
              <Plus className="h-4 w-4" /> Create Opportunity
            </Link>
          </div>
        </div>

        <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search opportunities..." className="w-full rounded-xl border border-gray-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-slate-400" />
          </div>
          <select value={status} onChange={(e) => { setStatus(e.target.value as SellerOpportunityStatus | ""); setPage(1); }} className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm">
            <option value="">All statuses</option>
            {Object.values(SELLER_OPPORTUNITY_STATUSES).map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </div>

        {error && <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <h2 className="font-bold text-gray-900">All opportunities</h2>
            <span className="text-xs text-gray-500">{total.toLocaleString()} total</span>
          </div>
          {loading ? (
            <div className="p-8 text-sm text-gray-500">Loading opportunities...</div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center">
              <h3 className="font-semibold text-gray-900">No opportunities found</h3>
              <p className="mt-2 text-sm text-gray-500">Create an opportunity or change your search filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-5 py-3">Opportunity</th>
                    <th className="px-5 py-3">Category</th>
                    <th className="px-5 py-3">Target</th>
                    <th className="px-5 py-3">Visibility</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Deadline</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((item) => (
                    <tr key={item._id} className="hover:bg-gray-50">
                      <td className="px-5 py-4">
                        <Link href={`/admin/seller-opportunities/${item._id}`} className="font-semibold text-gray-900 hover:underline">{item.title}</Link>
                        <p className="mt-1 text-xs text-gray-500">/{item.slug}</p>
                      </td>
                      <td className="px-5 py-4 text-gray-600">{item.category}</td>
                      <td className="px-5 py-4 text-gray-600">{item.targetSellerCount.toLocaleString()}</td>
                      <td className="px-5 py-4 text-gray-600">{item.visibility}</td>
                      <td className="px-5 py-4"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">{item.status}</span></td>
                      <td className="px-5 py-4 text-gray-600">{item.applicationDeadline ? new Date(item.applicationDeadline).toLocaleDateString() : "—"}</td>
                      <td className="px-5 py-4 text-right"><Link href={`/admin/seller-opportunities/${item._id}`} className="font-semibold text-slate-700 hover:underline">Manage →</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-gray-100 px-5 py-4">
            <p className="text-xs text-gray-500">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold disabled:opacity-40">Previous</button>
              <button type="button" disabled={page >= totalPages || loading} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold disabled:opacity-40">Next</button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
