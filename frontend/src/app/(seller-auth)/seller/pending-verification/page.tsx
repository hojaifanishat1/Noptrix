import Link from "next/link";
import { Clock3, ShieldCheck, Store } from "lucide-react";

export default function SellerPendingVerificationPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 text-white">
      <section className="w-full max-w-lg rounded-3xl border border-white/10 bg-white/[0.06] p-8 text-center shadow-2xl backdrop-blur-xl sm:p-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-400/10 text-amber-300 ring-1 ring-amber-300/20">
          <Clock3 className="h-8 w-8" />
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 text-sm font-bold tracking-[0.15em] text-slate-300">
          <Store className="h-4 w-4" />
          NOPTRIX SELLER
        </div>

        <h1 className="mt-5 text-3xl font-extrabold">
          Account created!
        </h1>

        <p className="mt-4 text-sm leading-7 text-slate-400">
          Your Seller account has been created successfully. It is currently
          waiting for Owner verification and activation.
        </p>

        <div className="mt-7 rounded-2xl border border-amber-300/15 bg-amber-300/5 p-5 text-left">
          <div className="flex items-center gap-3 text-amber-200">
            <ShieldCheck className="h-5 w-5" />
            <span className="font-semibold">Verification pending</span>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            You can sign in to the Seller Portal after your account has been
            activated by the NOPTRIX Owner.
          </p>
        </div>

        <Link
          href="/seller/login"
          className="mt-7 inline-flex w-full items-center justify-center rounded-xl bg-violet-400 px-4 py-3.5 font-bold text-slate-950 transition hover:bg-violet-300"
        >
          Go to Seller login
        </Link>
      </section>
    </main>
  );
}
