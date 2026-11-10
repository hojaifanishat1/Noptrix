"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { logout } from "@/features/auth/auth-actions";
import { useAuthStore } from "@/stores/auth.store";
import { ROUTES } from "@/constants/routes";

const navigation = [
  { label: "Dashboard", href: ROUTES.RIDER_PANEL },
  { label: "Orders", href: ROUTES.RIDER_ORDERS },
  { label: "Deliveries", href: ROUTES.RIDER_DELIVERIES },
  { label: "Earnings", href: ROUTES.RIDER_EARNINGS },
  { label: "Notifications", href: ROUTES.RIDER_NOTIFICATIONS },
  { label: "Profile", href: ROUTES.RIDER_PROFILE },
  { label: "Settings", href: ROUTES.RIDER_SETTINGS },
];

export default function RiderPanelLayout({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const user = useAuthStore((state) => state.user);
  const isLoading = useAuthStore((state) => state.isLoading);

  useEffect(() => {
    if (isLoading) return;

    if (!user || user.accountType !== "RIDER") {
      router.replace("/rider/login");
    }
  }, [user, isLoading, router]);

  const handleLogout = async () => {
    await logout();
    router.replace("/rider/login");
  };

  if (
    isLoading ||
    !user ||
    user.accountType !== "RIDER"
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <p className="text-sm text-slate-500">
          Checking rider session...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 md:flex">
      <aside className="w-full shrink-0 bg-slate-950 text-white md:min-h-screen md:w-64">
        <div className="border-b border-white/10 px-6 py-6">
          <h1 className="text-xl font-bold">NOPTRIX</h1>
          <p className="mt-1 text-xs text-slate-400">
            Rider Portal
          </p>
        </div>

        <nav className="flex gap-2 overflow-x-auto p-3 md:block md:space-y-1">
          {navigation.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== ROUTES.RIDER_PANEL &&
                pathname.startsWith(`${item.href}/`));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block shrink-0 rounded-lg px-4 py-3 text-sm font-medium transition ${
                  active
                    ? "bg-white text-slate-950"
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-4 md:mt-6">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full rounded-lg border border-white/20 px-4 py-3 text-left text-sm text-slate-200 hover:bg-white/10"
          >
            Sign out
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 md:px-8">
          <div>
            <p className="text-xs text-slate-500">Rider account</p>
            <p className="font-semibold text-slate-900">
              {user.name || user.email}
            </p>
          </div>

          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            RIDER
          </span>
        </header>

        <main className="p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
