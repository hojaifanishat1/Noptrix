"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import SellerOpportunityForm from "@/features/seller-opportunities/seller-opportunity-form";
import { sellerOpportunitiesApi } from "@/services/api/seller-opportunities.api";
import type { SellerOpportunity } from "@/features/seller-opportunities/seller-opportunity.types";

export default function EditSellerOpportunityPage() {
  const params = useParams<{ opportunityId: string }>();
  const router = useRouter();
  const id = params.opportunityId;
  const [item, setItem] = useState<SellerOpportunity | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    sellerOpportunitiesApi.getById(id)
      .then((result) => { if (active) setItem(result); })
      .catch((err: unknown) => { if (active) setError(err instanceof Error ? err.message : "Unable to load opportunity."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  if (loading) return <main className="p-8 text-sm text-gray-500">Loading opportunity...</main>;
  if (error || !item) return (
    <main className="p-8">
      <div role="alert" className="max-w-2xl rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error || "Opportunity not found."}</div>
      <button type="button" onClick={() => router.push("/admin/seller-opportunities")} className="mt-4 text-sm font-semibold">Back to opportunities</button>
    </main>
  );

  return (
    <main className="min-h-full bg-gray-50 p-4 md:p-8">
      <div className="mx-auto mb-7 max-w-5xl">
        <p className="text-sm text-gray-500">Seller Management</p>
        <h1 className="mt-2 text-2xl font-bold text-gray-950">Edit Seller Opportunity</h1>
        <p className="mt-1 text-sm text-gray-500">{item.title}</p>
      </div>
      <SellerOpportunityForm key={item._id} opportunity={item} />
    </main>
  );
}
