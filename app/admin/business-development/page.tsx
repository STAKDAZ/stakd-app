"use client";

import { useEffect, useMemo, useState } from "react";

type Stage = "Lead" | "Contacted" | "Bid Invite" | "Quoted" | "Follow-up" | "Won" | "Lost";

type Opportunity = {
  id: string;
  company: string;
  contact: string;
  project: string;
  estimatedValue: string;
  stage: Stage;
  nextFollowUp: string;
  assignedTo: string;
  notes: string;
};

const stages: Stage[] = ["Lead", "Contacted", "Bid Invite", "Quoted", "Follow-up", "Won", "Lost"];
const storageKey = "ds:business-development-opportunities";

function usd(value: string) {
  const n = Number(String(value).replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(n)) return "$0";
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function makeOpportunity(): Opportunity {
  return {
    id: crypto.randomUUID(),
    company: "",
    contact: "",
    project: "",
    estimatedValue: "",
    stage: "Lead",
    nextFollowUp: "",
    assignedTo: "",
    notes: "",
  };
}

export default function BusinessDevelopmentPage() {
  const [rows, setRows] = useState<Opportunity[]>([]);
  const [filter, setFilter] = useState<Stage | "All">("All");
  const [query, setQuery] = useState("");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      setRows(raw ? JSON.parse(raw) : [makeOpportunity()]);
    } catch {
      setRows([makeOpportunity()]);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(rows));
  }, [rows]);

  function update(id: string, patch: Partial<Opportunity>) {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter !== "All" && row.stage !== filter) return false;
      if (!q) return true;
      return [row.company, row.contact, row.project, row.assignedTo, row.notes].some((v) => v.toLowerCase().includes(q));
    });
  }, [rows, filter, query]);

  const openRows = rows.filter((r) => !["Won", "Lost"].includes(r.stage));
  const dueFollowUps = openRows.filter((r) => r.nextFollowUp && r.nextFollowUp <= todayIso());
  const quotedPipeline = rows.filter((r) => ["Quoted", "Follow-up"].includes(r.stage)).reduce((sum, r) => sum + Number(r.estimatedValue.replace(/[^0-9.-]/g, "") || 0), 0);
  const wonValue = rows.filter((r) => r.stage === "Won").reduce((sum, r) => sum + Number(r.estimatedValue.replace(/[^0-9.-]/g, "") || 0), 0);

  return (
    <div className="min-h-screen bg-slate-50 px-5 py-6">
      <div className="mx-auto w-full max-w-[1800px] space-y-5">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Business Development</h1>
          <p className="mt-1 text-sm text-slate-500">Track prospects, bid invites, quoted pipeline, and follow-ups before they become jobs.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Open Opportunities</div><div className="mt-2 text-3xl font-semibold">{openRows.length}</div></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Follow-ups Due</div><div className="mt-2 text-3xl font-semibold">{dueFollowUps.length}</div></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Quoted Pipeline</div><div className="mt-2 text-3xl font-semibold">{usd(String(quotedPipeline))}</div></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Won Value</div><div className="mt-2 text-3xl font-semibold">{usd(String(wonValue))}</div></div>
        </div>

        <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">Pipeline</h2>
              <p className="text-sm text-slate-500">Simple CRM board for sales and relationship work.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search pipeline..." className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500" />
              <select value={filter} onChange={(e) => setFilter(e.target.value as Stage | "All")} className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500">
                <option value="All">All stages</option>
                {stages.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <button onClick={() => setRows((prev) => [makeOpportunity(), ...prev])} className="rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800">+ Add Opportunity</button>
            </div>
          </div>

          <div className="overflow-x-auto p-5">
            <table className="min-w-[1200px] w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr><th className="px-3 py-2">Company</th><th className="px-3 py-2">Contact</th><th className="px-3 py-2">Project</th><th className="px-3 py-2">Value</th><th className="px-3 py-2">Stage</th><th className="px-3 py-2">Next Follow-up</th><th className="px-3 py-2">Assigned</th><th className="px-3 py-2">Notes</th><th></th></tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filtered.map((row) => (
                  <tr key={row.id} className="align-top">
                    <td className="px-3 py-2"><input value={row.company} onChange={(e) => update(row.id, { company: e.target.value })} className="w-44 rounded-lg border border-slate-300 px-2 py-1" /></td>
                    <td className="px-3 py-2"><input value={row.contact} onChange={(e) => update(row.id, { contact: e.target.value })} className="w-44 rounded-lg border border-slate-300 px-2 py-1" /></td>
                    <td className="px-3 py-2"><input value={row.project} onChange={(e) => update(row.id, { project: e.target.value })} className="w-56 rounded-lg border border-slate-300 px-2 py-1" /></td>
                    <td className="px-3 py-2"><input value={row.estimatedValue} onChange={(e) => update(row.id, { estimatedValue: e.target.value })} placeholder="$" className="w-32 rounded-lg border border-slate-300 px-2 py-1" /></td>
                    <td className="px-3 py-2"><select value={row.stage} onChange={(e) => update(row.id, { stage: e.target.value as Stage })} className="w-36 rounded-lg border border-slate-300 px-2 py-1">{stages.map((s) => <option key={s}>{s}</option>)}</select></td>
                    <td className="px-3 py-2"><input type="date" value={row.nextFollowUp} onChange={(e) => update(row.id, { nextFollowUp: e.target.value })} className="w-40 rounded-lg border border-slate-300 px-2 py-1" /></td>
                    <td className="px-3 py-2"><input value={row.assignedTo} onChange={(e) => update(row.id, { assignedTo: e.target.value })} className="w-36 rounded-lg border border-slate-300 px-2 py-1" /></td>
                    <td className="px-3 py-2"><textarea value={row.notes} onChange={(e) => update(row.id, { notes: e.target.value })} rows={1} className="w-64 rounded-lg border border-slate-300 px-2 py-1" /></td>
                    <td className="px-3 py-2 text-right"><button onClick={() => setRows((prev) => prev.filter((r) => r.id !== row.id))} className="rounded-lg border border-red-300 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50">Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
