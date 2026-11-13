"use client";

import { useRouter } from "next/navigation";
import { LogOut, Store, ShieldCheck } from "lucide-react";

import { sellerAuthApi } from "@/services/api/seller-auth.api";
import { useSellerAuthStore } from "@/stores/seller-auth.store";

export default function SellerDashboardPage() {
  const router = useRouter();

  const seller = useSellerAuthStore((state) => state.seller);
  const clearSeller = useSellerAuthStore((state) => state.clearSeller);

  async function handleLogout() {
    try {
      await sellerAuthApi.logout();
    } finally {
      clearSeller();
      router.replace("/seller/login");
    }
  }

  if (!seller) return null;

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-400 text-slate-950">
              <Store className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-xl font-black tracking-wider">NOPTRIX</h1>
              <p className="text-xs text-slate-400">SELLER PANEL</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:border-red-400/40 hover:text-red-300"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </header>

        <section className="mt-10">
          <p className="text-sm font-medium text-violet-300">
            SELLER DASHBOARD
          </p>

          <h2 className="mt-2 text-3xl font-extrabold">
            Welcome, {seller.businessName}
          </h2>

          <p className="mt-3 text-sm text-slate-400">
            Manage your NOPTRIX seller business from here.
          </p>
        </section>

        <section className="mt-8 grid gap-5 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
            <p className="text-sm text-slate-400">Seller code</p>
            <p className="mt-2 text-xl font-bold">{seller.sellerCode}</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
            <p className="text-sm text-slate-400">Account status</p>
            <div className="mt-2 flex items-center gap-2 text-emerald-300">
              <ShieldCheck className="h-5 w-5" />
              <span className="font-bold">{seller.status}</span>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 sm:col-span-2">
            <p className="text-sm text-slate-400">Seller email</p>
            <p className="mt-2 font-semibold">{seller.email}</p>
          </div>
        </section>
      </div>
    </main>
  );
}
