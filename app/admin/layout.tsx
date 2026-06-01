"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { PrecastYardMark } from "@/components/precast-yard-mark";

type NavItem = {
  href: string;
  label: string;
  description: string;
};

const mainNav: NavItem[] = [
  { href: "/admin/dashboard", label: "Dashboard", description: "Metrics, jobs, shop load" },
  { href: "/admin/estimating", label: "Estimating", description: "Takeoffs and pricing" },
  { href: "/admin/project-management", label: "PM Workspace", description: "Won jobs and releases" },
  { href: "/admin/business-development", label: "Business Development", description: "Leads and follow-ups" },
];

function NavLink({ href, label, description, active }: NavItem & { active: boolean }) {
  return (
    <Link
      href={href}
      className={`block rounded-xl px-4 py-3 transition ${
        active
          ? "bg-cyan-800 text-white shadow-sm"
          : "text-slate-700 hover:bg-cyan-50 hover:text-cyan-900"
      }`}
    >
      <div className="text-sm font-semibold leading-5">{label}</div>
      <div className={`mt-0.5 text-xs leading-5 ${active ? "text-cyan-50" : "text-slate-500"}`}>
        {description}
      </div>
    </Link>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const isPublicAdminRoute = pathname === "/admin/login" || pathname === "/admin/logout";
  const [loading, setLoading] = useState(!isPublicAdminRoute);

  useEffect(() => {
    if (isPublicAdminRoute) return;

    let alive = true;

    const run = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) console.error("getSession error:", error);
        if (!alive) return;

        if (!data.session) {
          router.replace(`/admin/login?next=${encodeURIComponent(pathname)}`);
          return;
        }

        setLoading(false);
      } catch (e) {
        console.error("getSession exception:", e);
        if (alive) setLoading(false);
      }
    };

    run();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace(`/admin/login?next=${encodeURIComponent(pathname)}`);
      }
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [router, pathname, isPublicAdminRoute]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm font-medium text-slate-600">
        Loading STAKD…
      </div>
    );
  }

  if (isPublicAdminRoute) return <>{children}</>;

  const settingsActive = pathname.startsWith("/admin/settings");

  return (
    <div className="flex min-h-screen w-full bg-[#f5f7f8] text-slate-900">
      <aside className="sticky top-0 h-screen w-[260px] shrink-0 border-r border-slate-200 bg-white/95">
        <div className="flex h-full flex-col p-4">
          <Link href="/admin/dashboard" className="mb-4 block rounded-2xl border border-cyan-100 bg-cyan-50 p-4">
            <div className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-900">STAKD</div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Ops App</div>
            <div className="mt-1 text-sm text-slate-600">Operations workspace</div>
          </Link>

          <nav className="grid gap-1">
            {mainNav.map((item) => (
              <NavLink key={item.href} {...item} active={pathname.startsWith(item.href)} />
            ))}
          </nav>

          <div className="mt-4">
            <NavLink
              href="/admin/settings"
              label="Settings"
              description="System settings"
              active={settingsActive}
            />
          </div>

          <div className="mt-auto pt-4">
            <div className="mb-4 border-t border-slate-200 pt-4">
              <PrecastYardMark />
            </div>
            <Link
              href="/admin/logout"
              className="block rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-700 transition hover:border-cyan-200 hover:bg-cyan-50"
            >
              Logout
            </Link>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-x-auto">{children}</main>
    </div>
  );
}
