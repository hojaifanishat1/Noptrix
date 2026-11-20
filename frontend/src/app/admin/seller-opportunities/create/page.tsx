import SellerOpportunityForm from "@/features/seller-opportunities/seller-opportunity-form";

export default function CreateSellerOpportunityPage() {
  return (
    <main className="min-h-full bg-gray-50 p-4 md:p-8">
      <div className="mx-auto mb-7 max-w-5xl">
        <p className="text-sm font-medium text-gray-500">Seller Management</p>
        <h1 className="mt-2 text-2xl font-bold text-gray-950">Create Seller Opportunity</h1>
        <p className="mt-1 text-sm text-gray-500">Configure a seller recruitment campaign and its application requirements.</p>
      </div>
      <SellerOpportunityForm />
    </main>
  );
}
