"use client";

import Image from "next/image";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f4f3ef] text-neutral-950">
      <div className="mx-auto flex min-h-screen max-w-7xl items-center px-6 py-10">
        <section className="grid w-full overflow-hidden rounded-[2rem] border border-neutral-300 bg-white shadow-2xl lg:grid-cols-[0.95fr_1.05fr]">
          <div className="flex flex-col justify-between bg-neutral-950 p-8 text-white md:p-12">
            <div>
              <div className="inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/10 px-4 py-2">
                <Image
                  src="/stakd-logo.png"
                  alt="STAKD"
                  width={44}
                  height={44}
                  priority
                  className="rounded-sm bg-white"
                />
                <span className="text-sm font-semibold tracking-[0.26em] text-zinc-200">
                  STAKD INTERNAL
                </span>
              </div>

              <h1 className="mt-10 max-w-2xl text-5xl font-black tracking-tight md:text-7xl">
                Precast work, organized from bid to delivery.
              </h1>

              <p className="mt-6 max-w-xl text-lg leading-8 text-zinc-300">
                Manage estimates, casting work, project notes, outsourced crews,
                and active job visibility from one STAKD operations dashboard.
              </p>
            </div>

            <div className="mt-10 grid gap-3 text-sm text-zinc-300 sm:grid-cols-3 lg:grid-cols-1">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="font-bold text-white">Precast Concrete</div>
                <div className="mt-1">Forms, castings, production, and delivery tracking.</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="font-bold text-white">Project Control</div>
                <div className="mt-1">Jobs, milestones, files, scope, and notes.</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="font-bold text-white">Crew Support</div>
                <div className="mt-1">Track outsourced erection and field-support work.</div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center p-8 md:p-12">
            <div className="w-full max-w-xl">
              <div className="mb-8 flex justify-center">
                <Image
                  src="/stakd-logo.png"
                  alt="STAKD Logo"
                  width={300}
                  height={220}
                  priority
                  className="h-auto w-72"
                />
              </div>

              <div className="rounded-[1.5rem] border border-neutral-200 bg-neutral-50 p-6">
                <div className="text-sm font-bold uppercase tracking-[0.22em] text-neutral-500">
                  Operations Login
                </div>
                <h2 className="mt-3 text-3xl font-black tracking-tight">
                  STAKD Dashboard
                </h2>
                <p className="mt-3 text-neutral-600">
                  Authorized access for STAKD job management and production tracking.
                </p>

                <a
                  href="/admin/login"
                  className="mt-8 block rounded-2xl bg-neutral-950 px-8 py-4 text-center text-sm font-bold uppercase tracking-wide text-white transition hover:bg-neutral-800"
                >
                  Enter App
                </a>

                <div className="mt-4 rounded-2xl border border-neutral-200 bg-white px-5 py-4 text-center text-sm text-neutral-600">
                  Authorized user: <span className="font-semibold text-neutral-950">joe@stakdaz.com</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
