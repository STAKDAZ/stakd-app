"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Subcontractor = {
  id: string;
  name: string;
  description: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  is_archived: boolean;
  sort_order: number | null;
  tons_per_week: number | null;
  default_lead_time_days: number | null;
  logo_url: string | null;
};

type AssignmentJob = {
  job_number: string | null;
  job_name: string | null;
  projected_finish_date: string | null;
  pm_status: string | null;
  is_archived: boolean | null;
};

type AssignmentRow = {
  id: string;
  subcontractor_id: string;
  job_id: string;
  scope_name: string | null;
  scope_description: string | null;
  start_date: string | null;
  due_date: string | null;
  promised_finish_date: string | null;
  status: string;
  assigned_tons: number | null;
  completed_tons: number | null;
  jobs: AssignmentJob | AssignmentJob[] | null;
};

type OutsourcedJobRow = {
  id: string;
  job_number: string | null;
  job_name: string | null;
  projected_finish_date: string | null;
  fabrication_due_date: string | null;
  pm_status: string | null;
  is_archived: boolean | null;
  outsourced_to: string | null;
};

type DraftRow = {
  name: string;
  description: string;
  contact_name: string;
  email: string;
  phone: string;
  is_archived: boolean;
  sort_order: number;
  default_lead_time_days: string;
  logo_url: string;
};

type Draft = Record<string, DraftRow>;

type SubScheduleSummary = {
  activeAssignments: number;
  nextCompletion: string | null;
  lastCompletion: string | null;
  overdueCount: number;
  dueSoonCount: number;
};

function clampInt(n: number, fallback = 1000) {
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function fmtNum(v: number | null | undefined, digits = 0) {
  const n = Number(v ?? 0);
  return Number.isFinite(n)
    ? n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })
    : "0";
}

function toJob(obj: AssignmentRow["jobs"]): AssignmentJob | null {
  if (!obj) return null;
  return Array.isArray(obj) ? obj[0] ?? null : obj;
}

function normalizeDate(v: string | null | undefined) {
  return v || null;
}

function compareDateAsc(a: string | null, b: string | null) {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return new Date(a).getTime() - new Date(b).getTime();
}

function projectedComplete(a: AssignmentRow) {
  return normalizeDate(a.promised_finish_date) || normalizeDate(a.due_date) || normalizeDate(toJob(a.jobs)?.projected_finish_date);
}

function statusBadgeClass(status: string | null | undefined) {
  const s = (status || "").toLowerCase();
  if (s === "complete" || s === "closed" || s === "shipped") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (s === "on hold" || s === "qc hold") return "bg-red-50 text-red-700 border-red-200";
  if (s === "active" || s === "fabricating" || s === "at subcontractor") return "bg-sky-50 text-sky-700 border-sky-200";
  return "bg-zinc-50 text-zinc-700 border-zinc-200";
}

function scheduleHealthClass(summary: SubScheduleSummary) {
  if (summary.overdueCount > 0) return "bg-red-50 text-red-700 border-red-200";
  if (summary.dueSoonCount > 0) return "bg-amber-50 text-amber-700 border-amber-200";
  if (summary.activeAssignments > 0) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  return "bg-zinc-50 text-zinc-700 border-zinc-200";
}

function scheduleHealthLabel(summary: SubScheduleSummary) {
  if (summary.overdueCount > 0) return `${summary.overdueCount} overdue`;
  if (summary.dueSoonCount > 0) return `${summary.dueSoonCount} due soon`;
  if (summary.activeAssignments > 0) return "On schedule";
  return "No active jobs";
}

export default function SubcontractorsPage() {
  const searchParams = useSearchParams();
  const subRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [selectedSubId, setSelectedSubId] = useState<string>("");
  const [rows, setRows] = useState<Subcontractor[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [draft, setDraft] = useState<Draft>({});
  const [savingIds, setSavingIds] = useState<Record<string, boolean>>({});
  const [deletingIds, setDeletingIds] = useState<Record<string, boolean>>({});

  async function load() {
    setLoading(true);
    setError(null);

    const [{ data, error }, { data: assignmentData, error: assignmentErr }, { data: outsourcedJobData, error: outsourcedJobErr }] = await Promise.all([
      supabase
        .from("subcontractors")
        .select("id,name,description,contact_name,email,phone,is_archived,sort_order,tons_per_week,default_lead_time_days,logo_url")
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("name", { ascending: true }),
      supabase
        .from("subcontractor_assignments")
        .select(
          "id,subcontractor_id,job_id,scope_name,scope_description,start_date,due_date,promised_finish_date,status,assigned_tons,completed_tons,jobs(job_number,job_name,projected_finish_date,pm_status,is_archived)"
        )
        .order("promised_finish_date", { ascending: true, nullsFirst: false })
        .order("due_date", { ascending: true, nullsFirst: false }),
      supabase
        .from("jobs")
        .select("id,job_number,job_name,projected_finish_date,fabrication_due_date,pm_status,is_archived,outsourced_to")
        .eq("is_archived", false)
        .not("outsourced_to", "is", null),
    ]);

    if (error || assignmentErr || outsourcedJobErr) {
      setError(error?.message || assignmentErr?.message || outsourcedJobErr?.message || "Failed to load subcontractors.");
      setRows([]);
      setAssignments([]);
      setLoading(false);
      return;
    }

    const cleanAssignments = ((assignmentData || []) as AssignmentRow[]).filter((a) => {
      const job = toJob(a.jobs);
      return !job?.is_archived;
    });

    const assignmentKeys = new Set(cleanAssignments.map((a) => a.subcontractor_id + ":" + a.job_id));
    const outsourcedAssignments = ((outsourcedJobData || []) as OutsourcedJobRow[])
      .filter((job) => job.outsourced_to && !assignmentKeys.has(job.outsourced_to + ":" + job.id))
      .map((job) => ({
        id: "job-" + job.id,
        subcontractor_id: job.outsourced_to as string,
        job_id: job.id,
        scope_name: "Dashboard assignment",
        scope_description: null,
        start_date: null,
        due_date: job.fabrication_due_date || job.projected_finish_date,
        promised_finish_date: job.fabrication_due_date || job.projected_finish_date,
        status: job.pm_status || "Active",
        assigned_tons: null,
        completed_tons: null,
        jobs: {
          job_number: job.job_number,
          job_name: job.job_name,
          projected_finish_date: job.fabrication_due_date || job.projected_finish_date,
          pm_status: job.pm_status,
          is_archived: job.is_archived,
        },
      })) as AssignmentRow[];

    setRows((data || []) as Subcontractor[]);
    setAssignments([...cleanAssignments, ...outsourcedAssignments]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const fromQuery = searchParams.get("selected");
    if (fromQuery) {
      setSelectedSubId(fromQuery);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("ds:selectedSubcontractorId", fromQuery);
      }
      return;
    }

    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem("ds:selectedSubcontractorId") || "";
      if (stored) setSelectedSubId(stored);
    }
  }, [searchParams]);

  useEffect(() => {
    setDraft((prev) => {
      const next: Draft = { ...prev };
      for (const r of rows) {
        if (!next[r.id]) {
          next[r.id] = {
            name: r.name || "",
            description: r.description || "",
            contact_name: r.contact_name || "",
            email: r.email || "",
            phone: r.phone || "",
            is_archived: !!r.is_archived,
            sort_order: clampInt(r.sort_order ?? 1000),
            default_lead_time_days: r.default_lead_time_days == null ? "" : String(r.default_lead_time_days),
            logo_url: r.logo_url || "",
          };
        }
      }
      for (const id of Object.keys(next)) {
        if (!rows.some((r) => r.id === id)) delete next[id];
      }
      return next;
    });
  }, [rows]);

  const assignmentsBySub = useMemo(() => {
    const map: Record<string, AssignmentRow[]> = {};
    for (const item of assignments) {
      if (!map[item.subcontractor_id]) map[item.subcontractor_id] = [];
      map[item.subcontractor_id].push(item);
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => compareDateAsc(projectedComplete(a), projectedComplete(b)));
    }
    return map;
  }, [assignments]);

  const summaryBySub = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const soon = new Date(today);
    soon.setDate(soon.getDate() + 7);

    const map: Record<string, SubScheduleSummary> = {};

    for (const row of rows) {
      const subAssignments = (assignmentsBySub[row.id] || []).filter((a) => (a.status || "Active") !== "Cancelled");
      const completionDates = subAssignments.map(projectedComplete).filter(Boolean) as string[];
      const overdueCount = subAssignments.filter((a) => {
        const d = projectedComplete(a);
        return !!d && new Date(d).getTime() < today.getTime() && (a.status || "").toLowerCase() !== "complete";
      }).length;
      const dueSoonCount = subAssignments.filter((a) => {
        const d = projectedComplete(a);
        if (!d) return false;
        const t = new Date(d).getTime();
        return t >= today.getTime() && t <= soon.getTime() && (a.status || "").toLowerCase() !== "complete";
      }).length;

      map[row.id] = {
        activeAssignments: subAssignments.filter((a) => (a.status || "").toLowerCase() !== "complete").length,
        nextCompletion: completionDates.length ? completionDates.slice().sort(compareDateAsc)[0] : null,
        lastCompletion: completionDates.length ? completionDates.slice().sort(compareDateAsc).at(-1) || null : null,
        overdueCount,
        dueSoonCount,
      };
    }

    return map;
  }, [rows, assignmentsBySub]);

  const selectedSubName = useMemo(
    () => rows.find((r) => r.id === selectedSubId)?.name || "",
    [rows, selectedSubId]
  );

  const visibleRows = useMemo(() => {
    if (!selectedSubId) return rows;

    const selectedRow = rows.find((r) => r.id === selectedSubId);
    if (!selectedRow) return rows;

    return [selectedRow, ...rows.filter((r) => r.id !== selectedSubId)];
  }, [rows, selectedSubId]);

  useEffect(() => {
    if (!selectedSubId) return;
    if (!rows.some((r) => r.id === selectedSubId)) return;

    const el = subRefs.current[selectedSubId];
    if (!el) return;

    const timer = window.setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);

    return () => window.clearTimeout(timer);
  }, [selectedSubId, rows]);

  const dirtyIds = useMemo(() => {
    const dirty = new Set<string>();
    for (const r of rows) {
      const d = draft[r.id];
      if (!d) continue;
      const isDirty =
        (r.name || "") !== d.name ||
        (r.description || "") !== d.description ||
        (r.contact_name || "") !== d.contact_name ||
        (r.email || "") !== d.email ||
        (r.phone || "") !== d.phone ||
        !!r.is_archived !== !!d.is_archived ||
        clampInt(r.sort_order ?? 1000) !== clampInt(d.sort_order ?? 1000) ||
        String(r.default_lead_time_days ?? "") !== d.default_lead_time_days ||
        (r.logo_url || "") !== d.logo_url;
      if (isDirty) dirty.add(r.id);
    }
    return dirty;
  }, [rows, draft]);

  async function add() {
    const name = newName.trim();
    if (!name) return;
    setError(null);
    const maxOrder = Math.max(0, ...rows.map((r) => clampInt(r.sort_order ?? 0)));
    const { error } = await supabase.from("subcontractors").insert({
      name,
      description: "",
      is_archived: false,
      sort_order: maxOrder + 10,
    });
    if (error) {
      setError(error.message);
      return;
    }
    setNewName("");
    await load();
  }

  function setDraftField(id: string, field: keyof DraftRow, value: string | boolean | number) {
    setDraft((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  async function saveOne(id: string) {
    const d = draft[id];
    if (!d) return;
    setSavingIds((p) => ({ ...p, [id]: true }));
    setError(null);

    const payload = {
      name: d.name.trim(),
      description: d.description.trim() || null,
      contact_name: d.contact_name.trim() || null,
      email: d.email.trim() || null,
      phone: d.phone.trim() || null,
      is_archived: !!d.is_archived,
      sort_order: clampInt(Number(d.sort_order), 1000),
      default_lead_time_days: d.default_lead_time_days.trim() === "" ? null : clampInt(Number(d.default_lead_time_days), 0),
      logo_url: d.logo_url.trim() || null,
    };

    const { error } = await supabase.from("subcontractors").update(payload).eq("id", id);
    setSavingIds((p) => ({ ...p, [id]: false }));
    if (error) {
      setError(error.message);
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...payload } : r)));
    await load();
  }

  async function deleteOne(id: string) {
    const row = rows.find((r) => r.id === id);
    const ok = confirm(`Delete subcontractor "${row?.name || ""}"?`);
    if (!ok) return;

    setDeletingIds((p) => ({ ...p, [id]: true }));
    setError(null);
    const { error } = await supabase.from("subcontractors").delete().eq("id", id);
    setDeletingIds((p) => ({ ...p, [id]: false }));
    if (error) {
      setError(error.message);
      return;
    }
    await load();
  }

  const activeSubs = rows.filter((r) => (summaryBySub[r.id]?.activeAssignments || 0) > 0 && !r.is_archived).length;
  const activeAssignedJobs = assignments.filter((a) => (a.status || "").toLowerCase() !== "complete").length;
  const dueSoonCount = Object.values(summaryBySub).reduce((sum, s) => sum + s.dueSoonCount, 0);
  const overdueCount = Object.values(summaryBySub).reduce((sum, s) => sum + s.overdueCount, 0);

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-8">
      <div className="mx-auto max-w-[1700px] space-y-6">
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">Subcontractors</h1>
          <p className="mt-2 max-w-4xl text-sm text-zinc-600">
            This page now focuses on job durations instead of tonnage. Each subcontractor shows its current jobs, projected completion dates, and which jobs are due soon or overdue.
          </p>
          {selectedSubId && selectedSubName ? (
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
              <span className="font-semibold">Selected from dashboard:</span>
              <span>{selectedSubName}</span>
              <button
                onClick={() => {
                  setSelectedSubId("");
                  if (typeof window !== "undefined") {
                    window.localStorage.removeItem("ds:selectedSubcontractorId");
                  }
                }}
                className="rounded-lg border border-sky-300 bg-white px-3 py-1.5 text-xs font-medium text-sky-800 hover:bg-sky-100"
              >
                Clear selection
              </button>
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"><div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Active Subs</div><div className="mt-2 text-3xl font-semibold text-zinc-900">{fmtNum(activeSubs)}</div></div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"><div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Current Assigned Jobs</div><div className="mt-2 text-3xl font-semibold text-zinc-900">{fmtNum(activeAssignedJobs)}</div></div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"><div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Due Within 7 Days</div><div className="mt-2 text-3xl font-semibold text-zinc-900">{fmtNum(dueSoonCount)}</div></div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"><div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Overdue Assignments</div><div className="mt-2 text-3xl font-semibold text-zinc-900">{fmtNum(overdueCount)}</div></div>
        </div>

        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <h2 className="text-xl font-semibold text-zinc-900">Add Subcontractor</h2>
            <div className="flex w-full max-w-xl gap-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && add()}
                placeholder="New subcontractor name"
                className="flex-1 rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-sky-500"
              />
              <button onClick={add} className="rounded-xl bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800">Add</button>
            </div>
          </div>
          {error ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
          {loading ? (
            <div className="py-10 text-sm text-zinc-500">Loading subcontractors…</div>
          ) : (
            <div className="space-y-4">
              {visibleRows.map((row) => {
                const d = draft[row.id];
                const subAssignments = assignmentsBySub[row.id] || [];
                const summary = summaryBySub[row.id] || {
                  activeAssignments: 0,
                  nextCompletion: null,
                  lastCompletion: null,
                  overdueCount: 0,
                  dueSoonCount: 0,
                };

                return (
                  <div
                    key={row.id}
                    ref={(el) => {
                      subRefs.current[row.id] = el;
                    }}
                    className={`rounded-2xl border p-5 ${
                      row.id === selectedSubId
                        ? "border-sky-400 bg-sky-50/40 shadow-sm"
                        : "border-zinc-200"
                    }`}
                  >
                    <div className="grid gap-5 xl:grid-cols-[1.2fr_1.4fr]">
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        <div>
                          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">Name</label>
                          <input value={d?.name || ""} onChange={(e) => setDraftField(row.id, "name", e.target.value)} className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm" />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">Contact</label>
                          <input value={d?.contact_name || ""} onChange={(e) => setDraftField(row.id, "contact_name", e.target.value)} className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm" />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">Phone</label>
                          <input value={d?.phone || ""} onChange={(e) => setDraftField(row.id, "phone", e.target.value)} className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm" />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">Email</label>
                          <input value={d?.email || ""} onChange={(e) => setDraftField(row.id, "email", e.target.value)} className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm" />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">Logo URL</label>
                          <input value={d?.logo_url || ""} onChange={(e) => setDraftField(row.id, "logo_url", e.target.value)} placeholder="https://..." className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm" />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">Default Lead Time Days</label>
                          <input value={d?.default_lead_time_days || ""} onChange={(e) => setDraftField(row.id, "default_lead_time_days", e.target.value)} className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm" />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">Sort Order</label>
                          <input value={String(d?.sort_order ?? "")} onChange={(e) => setDraftField(row.id, "sort_order", Number(e.target.value || 0))} className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm" />
                        </div>
                        <div className="md:col-span-2 xl:col-span-3">
                          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">Description / Notes</label>
                          <textarea value={d?.description || ""} onChange={(e) => setDraftField(row.id, "description", e.target.value)} rows={2} className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm" />
                        </div>
                        <div className="md:col-span-2 xl:col-span-3 flex items-center gap-2">
                          <label className="flex items-center gap-2 rounded-xl border border-zinc-300 px-3 py-2 text-sm">
                            <input type="checkbox" checked={!!d?.is_archived} onChange={(e) => setDraftField(row.id, "is_archived", e.target.checked)} />
                            Archived
                          </label>
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${scheduleHealthClass(summary)}`}>
                            {scheduleHealthLabel(summary)}
                          </span>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-zinc-900">Current Jobs & Projected Completion</div>
                            <div className="mt-1 text-xs text-zinc-500">Based on subcontractor assignments and job due dates</div>
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                          <div className="rounded-xl border border-zinc-200 bg-white p-3"><div className="text-zinc-500">Current Jobs</div><div className="mt-1 text-lg font-semibold text-zinc-900">{fmtNum(summary.activeAssignments)}</div></div>
                          <div className="rounded-xl border border-zinc-200 bg-white p-3"><div className="text-zinc-500">Next Complete</div><div className="mt-1 text-lg font-semibold text-zinc-900">{summary.nextCompletion || "—"}</div></div>
                          <div className="rounded-xl border border-zinc-200 bg-white p-3"><div className="text-zinc-500">Last Complete</div><div className="mt-1 text-lg font-semibold text-zinc-900">{summary.lastCompletion || "—"}</div></div>
                          <div className="rounded-xl border border-zinc-200 bg-white p-3"><div className="text-zinc-500">Overdue</div><div className="mt-1 text-lg font-semibold text-zinc-900">{fmtNum(summary.overdueCount)}</div></div>
                        </div>

                        <div className="mt-4 overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
                          <table className="min-w-full text-sm">
                            <thead className="bg-zinc-50 text-left text-zinc-500">
                              <tr>
                                <th className="px-3 py-2 font-semibold">Job</th>
                                <th className="px-3 py-2 font-semibold">Scope</th>
                                <th className="px-3 py-2 font-semibold">Start</th>
                                <th className="px-3 py-2 font-semibold">Projected Complete</th>
                                <th className="px-3 py-2 font-semibold">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {subAssignments.length === 0 ? (
                                <tr>
                                  <td colSpan={5} className="px-3 py-6 text-center text-zinc-500">No current jobs assigned.</td>
                                </tr>
                              ) : (
                                subAssignments.map((assignment) => {
                                  const job = toJob(assignment.jobs);
                                  const completeDate = projectedComplete(assignment);
                                  return (
                                    <tr key={assignment.id} className="border-t border-zinc-100 align-top">
                                      <td className="px-3 py-3">
                                        <div className="font-medium text-zinc-900">{job?.job_number || "—"}</div>
                                        <div className="text-zinc-500">{job?.job_name || "Unnamed job"}</div>
                                      </td>
                                      <td className="px-3 py-3 text-zinc-700">{assignment.scope_name || assignment.scope_description || "—"}</td>
                                      <td className="px-3 py-3 text-zinc-700">{assignment.start_date || "—"}</td>
                                      <td className="px-3 py-3 text-zinc-700">{completeDate || "—"}</td>
                                      <td className="px-3 py-3">
                                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(assignment.status || job?.pm_status)}`}>
                                          {assignment.status || job?.pm_status || "—"}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        onClick={() => saveOne(row.id)}
                        disabled={!dirtyIds.has(row.id) || !!savingIds[row.id]}
                        className="rounded-xl bg-sky-700 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {savingIds[row.id] ? "Saving..." : "Save"}
                      </button>
                      <button
                        onClick={() => deleteOne(row.id)}
                        disabled={!!deletingIds[row.id]}
                        className="rounded-xl border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {deletingIds[row.id] ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
