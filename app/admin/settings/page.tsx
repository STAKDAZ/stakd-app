import Link from "next/link";

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-slate-50 p-4 lg:p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <div className="text-3xl font-semibold tracking-tight text-slate-950">Settings</div>
          <div className="mt-1 text-sm text-slate-500">
            Manage the setup information that feeds the STAKD app.
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Link
            href="/admin/settings/clients"
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-sky-300 hover:shadow-md"
          >
            <div className="text-lg font-semibold text-slate-950">Clients</div>
            <div className="mt-2 text-sm leading-6 text-slate-600">
              Add, edit, archive, and color-code customers used on the dashboard and job records.
            </div>
            <div className="mt-4 text-sm font-semibold text-sky-700">Open clients →</div>
          </Link>

          <Link
            href="/admin/settings/subcontractors"
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-sky-300 hover:shadow-md"
          >
            <div className="text-lg font-semibold text-slate-950">Subcontractors</div>
            <div className="mt-2 text-sm leading-6 text-slate-600">
              Manage subcontractor names, contact information, notes, and archived status.
            </div>
            <div className="mt-4 text-sm font-semibold text-sky-700">Open subcontractors →</div>
          </Link>
        </div>
      </div>
    </div>
  );
}
