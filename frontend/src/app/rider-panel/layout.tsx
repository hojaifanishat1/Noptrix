"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { riderAuthApi, type RiderProfile } from "@/services/api/rider-auth.api";
import {
  Bike,
  Bell,
  ChevronRight,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Settings,
  ShieldCheck,
  Truck,
  UserRound,
  Wallet,
} from "lucide-react";

import { logout } from "@/features/auth/auth-actions";
import { ROUTES } from "@/constants/routes";
import { useAuthStore } from "@/stores/auth.store";

const groups = [
  {
    title: "WORKSPACE",
    items: [
      { label: "Dashboard", href: ROUTES.RIDER_PANEL, icon: LayoutDashboard },
      { label: "Deliveries", href: ROUTES.RIDER_DELIVERIES, icon: Truck },
      { label: "Orders", href: ROUTES.RIDER_ORDERS, icon: ClipboardList },
      { label: "Earnings", href: ROUTES.RIDER_EARNINGS, icon: Wallet },
    ],
  },
  {
    title: "COMMUNICATION",
    items: [
      { label: "Messages", href: ROUTES.RIDER_MESSAGES, icon: MessageSquare },
      { label: "Notifications", href: ROUTES.RIDER_NOTIFICATIONS, icon: Bell },
    ],
  },
  {
    title: "MY ACCOUNT",
    items: [
      { label: "Verification", href: "/rider-panel/verification", icon: ShieldCheck },
      { label: "Profile", href: ROUTES.RIDER_PROFILE, icon: UserRound },
      { label: "Settings", href: ROUTES.RIDER_SETTINGS, icon: Settings },
    ],
  },
];

const allItems = groups.flatMap((group) => group.items);

function isActive(pathname: string, href: string) {
  if (href === ROUTES.RIDER_PANEL) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function RiderPanelLayout({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const isLoading = useAuthStore((state) => state.isLoading);

  const [riderProfile, setRiderProfile] = useState<RiderProfile | null>(null);

  useEffect(() => {
    if (!user || user.accountType !== "RIDER") return;

    let mounted = true;

    riderAuthApi.getMe()
      .then((profile) => {
        if (mounted) setRiderProfile(profile);
      })
      .catch(() => {
        // Use the auth-store avatar as fallback.
      });

    return () => {
      mounted = false;
    };
  }, [user]);

  const avatarUrl = riderProfile?.avatarUrl || user?.avatarUrl;


  useEffect(() => {
    if (!isLoading && (!user || user.accountType !== "RIDER")) {
      router.replace("/rider/login");
    }
  }, [user, isLoading, router]);

  const handleLogout = async () => {
    await logout();
    router.replace("/rider/login");
  };

  const activeItem = allItems.find((item) =>
    isActive(pathname, item.href),
  );

  const displayName = user?.name || user?.email || "Rider";
  const initials = displayName
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  if (isLoading || !user || user.accountType !== "RIDER") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
          <span className="text-sm font-medium text-slate-600">
            Preparing your rider workspace...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 md:flex">
      {/* Sidebar */}
      <aside className="flex w-full shrink-0 flex-col border-b border-slate-200 bg-white md:sticky md:top-0 md:h-screen md:w-[260px] md:border-r md:border-b-0">
        <div className="flex items-center gap-3 px-5 py-5 md:px-6 md:py-7">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
            <Bike className="h-6 w-6" />
          </div>
          <div>
            <p className="text-lg font-black tracking-[0.12em] text-slate-950">
              NOPTRIX
            </p>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
              Rider workspace
            </p>
          </div>
        </div>

        <div className="hidden px-4 pb-5 md:block">
          <div className="rounded-2xl bg-gradient-to-br from-slate-950 to-slate-800 p-4 text-white">
            <p className="text-xs font-bold tracking-wider text-slate-400">
              YOUR DELIVERY HUB
            </p>
            <p className="mt-3 text-sm font-semibold">
              Welcome to NOPTRIX
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              Manage deliveries, earnings and your rider account.
            </p>
          </div>
        </div>

        <nav
          aria-label="Rider navigation"
          className="flex gap-1 overflow-x-auto px-3 pb-3 md:block md:flex-1 md:space-y-6 md:overflow-y-auto md:px-4 md:py-2"
        >
          {groups.map((group) => (
            <div key={group.title} className="shrink-0">
              <p className="hidden px-3 pb-2 text-[10px] font-bold tracking-[0.16em] text-slate-400 md:block">
                {group.title}
              </p>

              <div className="flex gap-1 md:block md:space-y-1">
                {group.items.map((item) => {
                  const active = isActive(pathname, item.href);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`group flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all md:w-full md:px-3.5 md:py-3 ${
                        active
                          ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                      }`}
                    >
                      <Icon
                        className={`h-[18px] w-[18px] shrink-0 ${
                          active
                            ? "text-white"
                            : "text-slate-400 group-hover:text-slate-700"
                        }`}
                      />
                      <span>{item.label}</span>
                      {active && (
                        <ChevronRight className="ml-auto hidden h-4 w-4 md:block" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="hidden border-t border-slate-100 p-4 md:block">
          <div className="mb-3 flex items-center gap-3 rounded-xl bg-slate-50 p-3">
            <Link
              href={ROUTES.RIDER_PROFILE}
              aria-label="Open rider profile"
              title="View profile"
              className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-100 text-sm font-bold text-blue-700 ring-2 ring-white transition hover:ring-blue-300"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="Rider profile" className="h-full w-full object-cover" />
              ) : (
                initials || "R"
              )}
            </Link>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-900">
                {displayName}
              </p>
              <p className="text-xs text-slate-500">Rider account</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
          >
            <LogOut className="h-[18px] w-[18px]" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
          <div className="flex min-h-[76px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-9">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
                <span>Rider workspace</span>
                <ChevronRight className="h-3 w-3" />
                <span className="truncate text-slate-500">
                  {activeItem?.label || "Dashboard"}
                </span>
              </div>
              <h1 className="mt-1 truncate text-xl font-bold text-slate-950">
                {activeItem?.label || "Dashboard"}
              </h1>
            </div>

            <div className="flex shrink-0 items-center gap-3">
              <Link
                href={ROUTES.RIDER_NOTIFICATIONS}
                aria-label="Notifications"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50"
              >
                <Bell className="h-[18px] w-[18px]" />
              </Link>

              <div className="hidden h-9 w-px bg-slate-200 sm:block" />

              <div className="flex items-center gap-2.5">
                <Link
                  href={ROUTES.RIDER_PROFILE}
                  aria-label="Open rider profile"
                  title="View profile"
                  className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-950 text-sm font-bold text-white ring-2 ring-transparent transition hover:ring-blue-300"
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Rider profile" className="h-full w-full object-cover" />
                  ) : (
                    initials || "R"
                  )}
                </Link>
                <div className="hidden sm:block">
                  <p className="max-w-[150px] truncate text-sm font-bold text-slate-900">
                    {displayName}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Rider account
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                aria-label="Sign out"
                className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 md:hidden"
              >
                <LogOut className="h-[18px] w-[18px]" />
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-9">
          {children}
        </main>
      </div>
    </div>
  );
}