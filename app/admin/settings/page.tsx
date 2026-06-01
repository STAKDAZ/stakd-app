import Link from "next/link";
import { PrecastYardMark } from "@/components/precast-yard-mark";

const settingsLinks = [
  {
    href: "/admin/settings/users",
    title: "User Access",
    description: "Invite STAKD teammates, review pending invites, and revoke app access.",
    cta: "Open user access",
  },
  {
    href: "/admin/settings/notifications",
    title: "Notifications",
    description: "Choose which STAKD email addresses receive new job, won job, and billing-ready alerts.",
    cta: "Open notifications",
  },
  {
    href: "/admin/settings/clients",
    title: "Clients",
    description: "Add, edit, archive, and color-code customers used on the dashboard and job records.",
    cta: "Open clients",
  },
  {
    href: "/admin/settings/subcontractors",
    title: "Subcontractors",
    description: "Manage subcontractor names, contact information, notes, and archived status.",
    cta: "Open subcontractors",
  },
];

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-slate-50 p-4 lg:p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-3xl font-semibold tracking-tight text-slate-950">Settings</div>
            <div className="mt-1 text-sm text-slate-500">
              Manage the setup information that feeds the STAKD app.
            </div>
          </div>
          <PrecastYardMark />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {settingsLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm transition hover:border-cyan-300 hover:shadow-md"
            >
              <div className="text-lg font-semibold text-slate-950">{item.title}</div>
              <div className="mt-2 text-sm leading-6 text-slate-600">{item.description}</div>
              <div className="mt-4 text-sm font-semibold text-sky-700">{item.cta} -&gt;</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
