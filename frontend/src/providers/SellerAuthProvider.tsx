"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { sellerAuthApi } from "@/services/api/seller-auth.api";
import { sellerAuthStorage } from "@/lib/auth/seller-auth-storage";
import { useSellerAuthStore } from "@/stores/seller-auth.store";

export function SellerAuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();

  const seller = useSellerAuthStore((state) => state.seller);
  const isLoading = useSellerAuthStore((state) => state.isLoading);
  const setSeller = useSellerAuthStore((state) => state.setSeller);
  const setLoading = useSellerAuthStore((state) => state.setLoading);
  const clearSeller = useSellerAuthStore((state) => state.clearSeller);

  useEffect(() => {
    let mounted = true;

    async function restoreSession() {
      if (!sellerAuthStorage.getRefreshToken()) {
        if (mounted) {
          clearSeller();
          setLoading(false);
          router.replace("/seller/login");
        }
        return;
      }

      try {
        const profile = await sellerAuthApi.getMe();

        if (!mounted) return;

        if (profile.status !== "ACTIVE") {
          sellerAuthApi.clearSession();
          clearSeller();
          router.replace("/seller/login?status=pending");
          return;
        }

        setSeller(profile);
      } catch {
        if (!mounted) return;

        sellerAuthApi.clearSession();
        clearSeller();
        router.replace("/seller/login");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void restoreSession();

    return () => {
      mounted = false;
    };
  }, [clearSeller, router, setLoading, setSeller]);

  if (isLoading || !seller || seller.status !== "ACTIVE") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-cyan-400/20 border-t-cyan-400" />
          <p className="mt-4 text-sm text-slate-400">
            Verifying seller session...
          </p>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
