"use client";

import Image from "next/image";
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

/* ================= TYPES ================= */

type Client = {
  id: string;
  name: string;
  color_hex: string | null;
  is_archived: boolean;
};

type Subcontractor = {
  id: string;
  name: string;
  description: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  is_archived: boolean;
};

type Metrics = {
  year: number;
  quoted_count: number;
  won_count: number;
  lost_count: number;
  win_rate: number;
  quoted_amount: number;
  won_amount: number;
  lost_amount: number;
};

type JobRow = {
  id: string;
  job_number: string;
  job_name: string | null;

  client_id: string | null;
  client_name: string | null;

  status: string | null;

  rfq_url: string | null;
  quoted_amount: number | null;

  percent_complete: number | null;
  projected_finish_date: string | null;

  qb_entered: boolean;
  billed: boolean;

  po_number: string | null;
  po_url: string | null;
  job_folder_url: string | null;
  shipping_tickets_url: string | null;

  outsourced_to: string | null;
  outsourced_name: string | null;
  outsourced_amount: number | null;

  is_archived: boolean;

  won_notified_at?: string | null;
  bill_ready_notified_at?: string | null;
};

/* ================= UTIL ================= */

const usd0 = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const num0 = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });

function money0(n: number) {
  return usd0.format(n);
}

function safeUrl(url: string) {
  const u = (url ?? "").trim();
  if (!u) return "";
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  return `https://${u}`;
}

function parseMoneyLoose(raw: string): number | null {
  const t = (raw ?? "").trim();
  if (!t) return null;
  const n = Number(t.replace(/[$, ]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function formatMoneyLoose(n: number | null): string {
  if (n === null || n === undefined) return "";
  return num0.format(Number(n));
}

function hexToRgba(hex: string, alpha: number) {
  const h = (hex || "").replace("#", "").trim();
  if (![3, 6].includes(h.length)) return `rgba(0,0,0,${alpha})`;

  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;

  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);

  if ([r, g, b].some((v) => Number.isNaN(v))) return `rgba(0,0,0,${alpha})`;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const STATUS_OPTIONS = ["Quoting", "Quoted", "Won", "Lost"] as const;

/* ================= PAGE ================= */

export default function AdminDashboard() {
  const currentYear = new Date().getFullYear();

  const [clientId, setClientId] = useState<string>("all");
  const [includeArchived, setIncludeArchived] = useState<boolean>(false);

  const [clients, setClients] = useState<Client[]>([]);
  const [subs, setSubs] = useState<Subcontractor[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [metricJobs, setMetricJobs] = useState<JobRow[]>([]);
  const [q, setQ] = useState("");

  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [addingJob, setAddingJob] = useState(false);
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [draft, setDraft] = useState<Record<string, string>>({});
  const draftKey = (jobId: string, field: string) => `${jobId}:${field}`;

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    job_name: "",
    client_id: "none",
    status: "Quoting",
    rfq_url: "",
    quoted_amount: "",
    percent_complete: "0",
    projected_finish_date: "",
    po_number: "",
    po_url: "",
    job_folder_url: "",
    outsourced_to: "none",
    outsourced_amount: "",
  });

  const activeClientsForDropdown = useMemo(
    () => clients.filter((c) => !c.is_archived),
    [clients]
  );

  const clientColorMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of clients) {
      if (c.color_hex) m.set(c.id, c.color_hex);
    }
    return m;
  }, [clients]);

  /* ================= LOADERS ================= */

  async function loadClients() {
    const { data, error } = await supabase.rpc("admin_clients_list");
    if (error) return setError(error.message);
    setClients((data ?? []) as Client[]);
  }

  async function loadSubcontractors() {
    const { data, error } = await supabase.rpc("admin_subcontractors_list", {
      p_include_archived: false,
    });
    if (error) return setError(error.message);
    setSubs((data ?? []) as Subcontractor[]);
  }

  async function loadMetrics(selectedClient: string) {
    setLoadingMetrics(true);
    setError(null);

    // Metrics are based on all jobs/customer, including archived.
    // This keeps lost archived jobs counting against the win rate.
    const { data, error } = await supabase.rpc("admin_jobs_list", {
      p_year: null,
      p_client_id: selectedClient === "all" ? null : selectedClient,
      p_include_archived: true,
    });

    if (error) {
      setError(error.message);
      setMetricJobs([]);
    } else {
      setMetricJobs((data ?? []) as JobRow[]);
    }

    setLoadingMetrics(false);
  }

  async function loadJobs(
    selectedClient: string,
    incArchived: boolean
  ) {
    setLoadingJobs(true);
    setError(null);

    const { data, error } = await supabase.rpc("admin_jobs_list", {
      p_year: null,
      p_client_id: selectedClient === "all" ? null : selectedClient,
      p_include_archived: incArchived,
    });

    if (error) setError(error.message);
    else setJobs((data ?? []) as JobRow[]);

    setLoadingJobs(false);
  }

  /* ================= EFFECTS ================= */

  useEffect(() => {
    loadClients();
    loadSubcontractors();
  }, []);

  useEffect(() => {
    loadMetrics(clientId);
    loadJobs(clientId, includeArchived);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, includeArchived]);

  /* ================= FILTER ================= */

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return jobs;

    return jobs.filter((j) => {
      return (
        (j.job_number ?? "").toLowerCase().includes(needle) ||
        (j.job_name ?? "").toLowerCase().includes(needle) ||
        (j.client_name ?? "").toLowerCase().includes(needle) ||
        (j.status ?? "").toLowerCase().includes(needle) ||
        (j.po_number ?? "").toLowerCase().includes(needle) ||
        (j.outsourced_name ?? "").toLowerCase().includes(needle)
      );
    });
  }, [jobs, q]);

  const realMetrics = useMemo(() => {
    const rows = metricJobs;
    const wonRows = rows.filter((j) => (j.status ?? "").toLowerCase() === "won");
    const lostRows = rows.filter((j) => (j.status ?? "").toLowerCase() === "lost");
    const decidedCount = wonRows.length + lostRows.length;

    const sumQuoted = rows.reduce((sum, j) => sum + Number(j.quoted_amount ?? 0), 0);
    const sumWon = wonRows.reduce((sum, j) => sum + Number(j.quoted_amount ?? 0), 0);
    const sumLost = lostRows.reduce((sum, j) => sum + Number(j.quoted_amount ?? 0), 0);

    return {
      winRate: decidedCount ? Math.round((wonRows.length / decidedCount) * 1000) / 10 : 0,
      wonAmount: sumWon,
      quotedAmount: sumQuoted,
      lostAmount: sumLost,
    };
  }, [metricJobs]);

  /* ================= EMAIL HELPER ================= */

  async function notifyAccounting(type: "created" | "won" | "completed", jobRef: { jobId?: string; jobNumber?: string }) {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) {
      console.error("Accounting notification skipped: no active Supabase session.");
      return;
    }

    const res = await fetch("/api/accounting/notify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ type, job_id: jobRef.jobId, job_number: jobRef.jobNumber }),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const message = json?.error || `Accounting notification failed (${res.status}).`;
      console.error("Accounting notification failed:", message, json);
      setNotice(`Job saved, but email was not sent: ${message}`);
      return;
    }

    await loadJobs(clientId, includeArchived);
  }

  async function runDriveAction(body: Record<string, unknown>) {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;

    if (!token) {
      setNotice("Google Drive action skipped because your session needs to be refreshed.");
      return null;
    }

    const res = await fetch("/api/admin/job-drive", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const json = await res.json().catch(() => null);

    if (!res.ok || json?.ok === false) {
      const message =
        json?.code === "drive_not_configured"
          ? "Job saved. Google Drive folders are not connected yet."
          : json?.error || "Google Drive action could not be completed.";
      setNotice(message);
      return null;
    }

    return json;
  }

  async function moveDriveForJob(job: JobRow, target: "current" | "lost" | "completed" | "archived") {
    if (!job.job_folder_url) return;

    const result = await runDriveAction({
      action: "move",
      folderUrl: job.job_folder_url,
      target,
    });

    if (result?.folderUrl && result.folderUrl !== job.job_folder_url) {
      await supabase.rpc("admin_job_patch", {
        p_id: job.id,
        p_patch: { job_folder_url: result.folderUrl },
      });
    }
  }

  async function deleteJob(job: JobRow) {
    const label = `${job.job_number} ${job.job_name ?? ""}`.trim();
    const ok =
      typeof window === "undefined"
        ? false
        : window.confirm(
            `Delete ${label} permanently?\n\nThis removes the job from STAKD. If it has a Drive folder link, the app will also try to move that folder to Google Drive trash.`
          );

    if (!ok) return;

    setError(null);
    setNotice(null);
    setDeletingJobId(job.id);

    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;

      if (!token) {
        setError("Your session expired. Please log out and sign back in, then try deleting again.");
        return;
      }

      const res = await fetch("/api/admin/jobs/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id: job.id }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || json?.ok === false) {
        setError(json?.error || `Could not delete ${label}.`);
        await loadJobs(clientId, includeArchived);
        return;
      }

      setJobs((prev) => prev.filter((row) => row.id !== job.id));
      await loadMetrics(clientId);
      if (json?.warning) {
        setNotice(json.warning);
      } else {
        setNotice(`${label} was deleted.`);
      }
    } finally {
      setDeletingJobId(null);
    }
  }

  /* ================= UPDATE ================= */

  async function patchJob(id: string, patch: Partial<JobRow>) {
    setError(null);
    setNotice(null);

    const prevJob = jobs.find((j) => j.id === id);
    const nextJob: JobRow | undefined = prevJob
      ? ({ ...prevJob, ...patch } as JobRow)
      : undefined;

    setJobs((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

    const payload: any = { ...patch };
    if (Object.prototype.hasOwnProperty.call(patch, "projected_finish_date")) {
      payload.fabrication_due_date = patch.projected_finish_date || null;
    }
    delete payload.client_name;
    delete payload.outsourced_name;

    for (const k of Object.keys(payload)) {
      if (payload[k] === undefined) delete payload[k];
    }

    const { error } = await supabase.rpc("admin_job_patch", {
      p_id: id,
      p_patch: payload,
    });

    if (error) {
      console.log("PATCH JOB ERROR:", { id, payload, error });
      setError(error.message);
      await loadJobs(clientId, includeArchived);
      return;
    }

    if (prevJob && nextJob) {
      const prevStatus = (prevJob.status ?? "").toLowerCase();
      const newStatus = (nextJob.status ?? "").toLowerCase();

      if (prevStatus !== "won" && newStatus === "won") {
        await moveDriveForJob(nextJob, "current");
        await notifyAccounting("won", { jobId: id });
      }

      if (prevStatus !== "lost" && newStatus === "lost") {
        await moveDriveForJob(nextJob, "lost");
        await supabase.rpc("admin_job_patch", {
          p_id: id,
          p_patch: { is_archived: true },
        });
        setJobs((prev) =>
          prev.map((r) => (r.id === id ? { ...r, is_archived: true } : r))
        );
        if (!includeArchived) {
          setJobs((prev) => prev.filter((r) => r.id !== id));
        }
      }

      const prevPc = Number(prevJob.percent_complete ?? 0);
      const newPc = Number(nextJob.percent_complete ?? 0);

      if (prevPc < 100 && newPc >= 100) {
        await moveDriveForJob(nextJob, "completed");
        await notifyAccounting("completed", { jobId: id });
      }

      if (!prevJob.is_archived && !!nextJob.billed) {
        await moveDriveForJob(nextJob, "completed");
        await supabase.rpc("admin_job_patch", {
          p_id: id,
          p_patch: { is_archived: true },
        });

        setJobs((prev) =>
          prev.map((r) => (r.id === id ? { ...r, is_archived: true } : r))
        );

        if (!includeArchived) {
          setJobs((prev) => prev.filter((r) => r.id !== id));
        }
      }
    }

    if (patch.is_archived === true && includeArchived === false) {
      setJobs((prev) => prev.filter((r) => r.id !== id));
    }
  }

  /* ================= ADD JOB ================= */

  function pad4(n: number) {
    return String(n).padStart(4, "0");
  }

  function yearPrefix(y: number) {
    return String(y).slice(2);
  }

  function openAddJob() {
    setError(null);

    const defaultClient =
      clientId !== "all" ? clientId : activeClientsForDropdown[0]?.id ?? "none";

    setForm({
      job_name: "",
      client_id: defaultClient || "none",
      status: "Quoting",
      rfq_url: "",
      quoted_amount: "",
      percent_complete: "0",
      projected_finish_date: "",
      po_number: "",
      po_url: "",
      job_folder_url: "",
      outsourced_to: "none",
      outsourced_amount: "",
    });

    setShowAdd(true);
  }

  async function submitAddJob() {
    try {
      setAddingJob(true);
      setError(null);
      setNotice(null);

      const prefix = yearPrefix(currentYear);

      const nums = jobs
        .map((j) => j.job_number)
        .filter((jn) => jn && jn.startsWith(prefix + "-"))
        .map((jn) => Number(jn.split("-")[1]))
        .filter((n) => Number.isFinite(n));

      const next = (nums.length ? Math.max(...nums) : 0) + 1;
      const nextJobNumber = `${prefix}-${pad4(next)}`;

      const quotedAmt = parseMoneyLoose(form.quoted_amount);
      const pc = Math.max(0, Math.min(100, Number(form.percent_complete || "0")));
      const outAmt = parseMoneyLoose(form.outsourced_amount);

      const p_client_id =
        form.client_id === "none" ? null : (form.client_id as any);
      const p_outsourced_to =
        form.outsourced_to === "none" ? null : (form.outsourced_to as any);

      const { error } = await supabase.rpc("admin_add_job", {
        p_job_number: nextJobNumber,
        p_job_name: form.job_name || "NEW JOB",
        p_client_id,
        p_status: form.status,

        p_rfq_url: form.rfq_url ? safeUrl(form.rfq_url) : null,
        p_quoted_amount: quotedAmt,

        p_percent_complete: pc,
        p_projected_finish_date: form.projected_finish_date
          ? form.projected_finish_date
          : null,

        p_po_number: form.po_number || null,
        p_po_url: form.po_url ? safeUrl(form.po_url) : null,
        p_job_folder_url: form.job_folder_url
          ? safeUrl(form.job_folder_url)
          : null,

        p_outsourced_to,
        p_outsourced_amount: outAmt,
      });

      if (error) {
        setError(error.message);
        return;
      }

      await notifyAccounting("created", { jobNumber: nextJobNumber });

      const driveJson = await runDriveAction({
        action: "provision",
        jobNumber: nextJobNumber,
        jobName: form.job_name || "NEW JOB",
      });

      if (driveJson?.rootFolderUrl) {
        await supabase.rpc("admin_job_patch_by_job_number", {
          p_job_number: nextJobNumber,
          p_patch: {
            job_folder_url: driveJson.rootFolderUrl,
          },
        });
      }

      setShowAdd(false);
      await loadJobs(clientId, includeArchived);
      await loadMetrics(clientId);
    } finally {
      setAddingJob(false);
    }
  }

  /* ================= UI HELPERS ================= */

  function rowBg(status: string | null) {
    const s = (status ?? "").toLowerCase();
    if (s === "won") return "bg-emerald-50";
    if (s === "lost") return "bg-rose-50";
    if (s === "quoted") return "bg-sky-50";
    if (s === "quoting") return "bg-amber-50";
    return "bg-white";
  }

  function clientBubbleStyle(client_id: string | null) {
    if (!client_id) return {};
    const hex = clientColorMap.get(client_id);
    if (!hex) return {};
    return {
      backgroundColor: hexToRgba(hex, 0.18),
      borderColor: hexToRgba(hex, 0.6),
    } as React.CSSProperties;
  }

  /* ================= UI ================= */

  return (
    <div className="min-h-screen bg-slate-50 p-4 lg:p-6">
      <div className="w-full min-w-[1180px]">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Image src="/stakd-logo.png" alt="STAKD" width={40} height={40} />
            <div>
              <div className="text-2xl font-semibold">STAKD Dashboard</div>
              <div className="text-sm text-zinc-500">Internal job tracking</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="min-w-[220px] rounded-md border bg-white px-3 py-2 text-sm"
            >
              <option value="all">All customers</option>
              {activeClientsForDropdown.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={includeArchived}
                onChange={(e) => setIncludeArchived(e.target.checked)}
              />
              Include archived
            </label>

          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <KpiCard
            title="Win Rate"
            value={loadingMetrics ? "—" : `${realMetrics.winRate}%`}
          />
          <KpiCard
            title="Won Amount"
            value={loadingMetrics ? "—" : money0(realMetrics.wonAmount)}
          />
          <KpiCard
            title="Quoted Amount"
            value={loadingMetrics ? "—" : money0(realMetrics.quotedAmount)}
          />
          <KpiCard
            title="Lost Amount"
            value={loadingMetrics ? "—" : money0(realMetrics.lostAmount)}
          />
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        {notice && (
          <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm font-medium text-sky-800">
            {notice}
          </div>
        )}

        <div className="mt-8 rounded-xl border bg-white">
          <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-base font-semibold">Jobs</div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <button
                onClick={openAddJob}
                className="rounded-md border bg-white px-3 py-2 text-sm hover:bg-zinc-50"
              >
                + Add Job
              </button>

              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search jobs..."
                className="w-full rounded-md border px-3 py-2 text-sm sm:w-96"
              />
            </div>
          </div>

          {loadingJobs ? (
            <div className="p-4 text-sm text-zinc-600">Loading jobs…</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50">
                  <tr>
                    <Th>Job #</Th>
                    <Th>Job Name</Th>
                    <Th className="text-center">Customer</Th>
                    <Th className="text-center">Status</Th>
                    <Th className="text-center">RFQ</Th>
                    <Th className="text-right">Quoted $</Th>
                    <Th className="text-center">% Complete</Th>
                    <Th className="text-center whitespace-normal leading-4">
                      Estimated
                      <br />
                      Completion Date
                    </Th>
                    <Th>PO #</Th>
                    <Th className="text-center">Outsourced To</Th>
                    <Th className="text-right">Outsourced $</Th>
                    <Th className="text-center">QB</Th>
                    <Th className="text-center">Billed</Th>
                    <Th className="text-center">Archive</Th>
                    <Th className="text-center">Delete</Th>
                  </tr>
                </thead>

                <tbody>
                  {filtered.map((j) => (
                    <tr
                      key={j.id}
                      className={`border-b ${rowBg(j.status)} ${
                        j.billed ? "line-through text-zinc-400" : ""
                      }`}
                    >
                      <Td>{j.job_number}</Td>

                      <Td>
                        <div className="flex items-center gap-2 flex-wrap">
                          <input
                            className="min-w-[220px] flex-1 rounded border px-2 py-1"
                            value={j.job_name ?? ""}
                            onChange={(e) =>
                              patchJob(j.id, { job_name: e.target.value })
                            }
                          />

                          <button
                            className="rounded-md border px-2 py-1 text-xs hover:bg-zinc-50"
                            onClick={() => {
                              const url = prompt(
                                "Paste the job folder link:",
                                j.job_folder_url ?? ""
                              );

                              if (url !== null) {
                                patchJob(j.id, {
                                  job_folder_url: url ? safeUrl(url) : null,
                                });
                              }
                            }}
                          >
                            Link
                          </button>

                          {j.job_folder_url ? (
                            <a
                              href={safeUrl(j.job_folder_url)}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-md border px-2 py-1 text-xs hover:bg-zinc-50"
                            >
                              Open
                            </a>
                          ) : null}

                          <button
                            className="rounded-md border px-2 py-1 text-xs hover:bg-zinc-50"
                            onClick={() => {
                              const url = prompt(
                                "Paste the Shipping Tickets folder link:",
                                j.shipping_tickets_url ?? ""
                              );

                              if (url !== null) {
                                patchJob(j.id, {
                                  shipping_tickets_url: url
                                    ? safeUrl(url)
                                    : null,
                                });
                              }
                            }}
                          >
                            Shipping
                          </button>

                          {j.shipping_tickets_url ? (
                            <a
                              href={safeUrl(j.shipping_tickets_url)}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-md border px-2 py-1 text-xs hover:bg-zinc-50"
                            >
                              Open
                            </a>
                          ) : null}
                        </div>
                      </Td>

                      <Td className="text-center">
                        <div
                          className="inline-flex items-center gap-2 rounded-md border px-2 py-1"
                          style={clientBubbleStyle(j.client_id)}
                        >
                          <select
                            className="min-w-[180px] rounded border bg-white px-2 py-1"
                            value={j.client_id ?? "none"}
                            onChange={(e) =>
                              patchJob(j.id, {
                                client_id:
                                  e.target.value === "none"
                                    ? null
                                    : (e.target.value as any),
                              })
                            }
                          >
                            <option value="none">—</option>
                            {activeClientsForDropdown.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </Td>

                      <Td className="text-center">
                        <select
                          className="w-28 rounded border bg-white px-2 py-1"
                          value={j.status ?? "Quoting"}
                          onChange={(e) =>
                            patchJob(j.id, { status: e.target.value })
                          }
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </Td>

                      <Td className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            className="text-lg"
                            title="Add or edit RFQ"
                            onClick={() => {
                              const url = prompt(
                                "Paste the RFQ PDF link:",
                                j.rfq_url ?? ""
                              );
                              if (url !== null)
                                patchJob(j.id, {
                                  rfq_url: url ? safeUrl(url) : null,
                                });
                            }}
                          >
                            {j.rfq_url ? "🟢" : "🔴"}
                          </button>

                          {j.rfq_url ? (
                            <a
                              href={safeUrl(j.rfq_url)}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs underline"
                            >
                              Open
                            </a>
                          ) : (
                            <span className="text-xs text-zinc-400">—</span>
                          )}
                        </div>
                      </Td>

                      <Td className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-zinc-500">$</span>
                          <input
                            type="text"
                            className="w-28 rounded border px-2 py-1 text-right"
                            value={
                              draft[draftKey(j.id, "quoted_amount")] ??
                              formatMoneyLoose(j.quoted_amount)
                            }
                            onFocus={() => {
                              const k = draftKey(j.id, "quoted_amount");
                              setDraft((d) => ({
                                ...d,
                                [k]:
                                  d[k] ??
                                  (j.quoted_amount == null
                                    ? ""
                                    : String(j.quoted_amount)),
                              }));
                            }}
                            onChange={(e) =>
                              setDraft((d) => ({
                                ...d,
                                [draftKey(j.id, "quoted_amount")]:
                                  e.target.value,
                              }))
                            }
                            onBlur={() => {
                              const k = draftKey(j.id, "quoted_amount");
                              const val = parseMoneyLoose(draft[k] ?? "");
                              patchJob(j.id, { quoted_amount: val as any });
                              setDraft((d) => {
                                const x = { ...d };
                                delete x[k];
                                return x;
                              });
                            }}
                          />
                        </div>
                      </Td>

                      <Td className="text-center">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={10}
                          className="w-20 rounded border px-2 py-1 text-right"
                          value={j.percent_complete ?? 0}
                          onChange={(e) =>
                            patchJob(j.id, {
                              percent_complete: Math.max(
                                0,
                                Math.min(100, Number(e.target.value))
                              ),
                            })
                          }
                        />
                      </Td>

                      <Td className="text-center">
                        <input
                          type="date"
                          className="rounded border px-2 py-1"
                          value={j.projected_finish_date ?? ""}
                          onChange={(e) =>
                            patchJob(j.id, {
                              projected_finish_date: e.target.value,
                            })
                          }
                        />
                      </Td>

                      <Td>
                        <div className="flex items-center gap-2">
                          <input
                            className="w-28 rounded border px-2 py-1"
                            value={j.po_number ?? ""}
                            onChange={(e) =>
                              patchJob(j.id, { po_number: e.target.value })
                            }
                          />
                          <button
                            className="rounded-md border px-2 py-1 text-xs hover:bg-zinc-50"
                            onClick={() => {
                              const url = prompt(
                                "Paste the PO PDF link:",
                                j.po_url ?? ""
                              );
                              if (url !== null)
                                patchJob(j.id, {
                                  po_url: url ? safeUrl(url) : null,
                                });
                            }}
                          >
                            Link
                          </button>
                          {j.po_url && j.po_number ? (
                            <a
                              href={safeUrl(j.po_url)}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs underline"
                            >
                              Open
                            </a>
                          ) : null}
                        </div>
                      </Td>

                      <Td className="text-center">
                        <select
                          className="w-44 rounded border bg-white px-2 py-1"
                          value={j.outsourced_to ?? "none"}
                          onChange={(e) => {
                            const nextValue =
                              e.target.value === "none" ? null : e.target.value;

                            if (typeof window !== "undefined") {
                              if (nextValue) {
                                window.localStorage.setItem(
                                  "ds:selectedSubcontractorId",
                                  nextValue
                                );
                              } else {
                                window.localStorage.removeItem(
                                  "ds:selectedSubcontractorId"
                                );
                              }
                            }

                            patchJob(j.id, {
                              outsourced_to: nextValue,
                            });
                          }}
                        >
                          <option value="none">—</option>
                          {subs.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </Td>

                      <Td className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-zinc-500">$</span>
                          <input
                            type="text"
                            className="w-28 rounded border px-2 py-1 text-right"
                            value={
                              draft[draftKey(j.id, "outsourced_amount")] ??
                              formatMoneyLoose(j.outsourced_amount)
                            }
                            onFocus={() => {
                              const k = draftKey(j.id, "outsourced_amount");
                              setDraft((d) => ({
                                ...d,
                                [k]:
                                  d[k] ??
                                  (j.outsourced_amount == null
                                    ? ""
                                    : String(j.outsourced_amount)),
                              }));
                            }}
                            onChange={(e) =>
                              setDraft((d) => ({
                                ...d,
                                [draftKey(j.id, "outsourced_amount")]:
                                  e.target.value,
                              }))
                            }
                            onBlur={() => {
                              const k = draftKey(j.id, "outsourced_amount");
                              const val = parseMoneyLoose(draft[k] ?? "");
                              patchJob(j.id, { outsourced_amount: val as any });
                              setDraft((d) => {
                                const x = { ...d };
                                delete x[k];
                                return x;
                              });
                            }}
                          />
                        </div>
                      </Td>

                      <Td className="text-center">
                        <input
                          type="checkbox"
                          checked={j.qb_entered}
                          onChange={(e) =>
                            patchJob(j.id, { qb_entered: e.target.checked })
                          }
                        />
                      </Td>

                      <Td className="text-center">
                        <input
                          type="checkbox"
                          checked={j.billed}
                          onChange={(e) =>
                            patchJob(j.id, { billed: e.target.checked })
                          }
                        />
                      </Td>

                      <Td className="text-center">
                        <button
                          className="rounded-md border px-3 py-1 text-xs hover:bg-zinc-50"
                          onClick={() => patchJob(j.id, { is_archived: true })}
                          disabled={j.is_archived}
                        >
                          {j.is_archived ? "Archived" : "Archive"}
                        </button>
                      </Td>

                      <Td className="text-center">
                        <button
                          className="rounded-md border border-red-200 bg-white px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                          onClick={() => deleteJob(j)}
                          disabled={deletingJobId === j.id}
                          title="Permanently delete this job"
                        >
                          {deletingJobId === j.id ? "Deleting..." : "Delete"}
                        </button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {showAdd && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-2xl rounded-xl bg-white p-4 shadow-lg">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-lg font-semibold">Add Job</div>
                <button
                  className="rounded-md border px-2 py-1 text-sm hover:bg-zinc-50"
                  onClick={() => setShowAdd(false)}
                  disabled={addingJob}
                >
                  Close
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Job Name">
                  <input
                    className="w-full rounded border px-2 py-1"
                    value={form.job_name}
                    onChange={(e) =>
                      setForm({ ...form, job_name: e.target.value })
                    }
                  />
                </Field>

                <Field label="Client">
                  <select
                    className="w-full rounded border bg-white px-2 py-1"
                    value={form.client_id}
                    onChange={(e) =>
                      setForm({ ...form, client_id: e.target.value })
                    }
                  >
                    <option value="none">— Select —</option>
                    {activeClientsForDropdown.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Status">
                  <select
                    className="w-full rounded border bg-white px-2 py-1"
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="RFQ Link (optional)">
                  <input
                    className="w-full rounded border px-2 py-1"
                    placeholder="Paste Google Drive RFQ PDF link"
                    value={form.rfq_url}
                    onChange={(e) => setForm({ ...form, rfq_url: e.target.value })}
                  />
                </Field>

                <Field label="Quoted $ (optional)">
                  <input
                    className="w-full rounded border px-2 py-1"
                    placeholder="e.g. 12,500"
                    value={form.quoted_amount}
                    onChange={(e) =>
                      setForm({ ...form, quoted_amount: e.target.value })
                    }
                  />
                </Field>

                <Field label="% Complete (0–100, step 10)">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={10}
                    className="w-full rounded border px-2 py-1"
                    value={form.percent_complete}
                    onChange={(e) =>
                      setForm({ ...form, percent_complete: e.target.value })
                    }
                  />
                </Field>

                <Field label="Estimated Completion Date">
                  <input
                    type="date"
                    className="w-full rounded border px-2 py-1"
                    value={form.projected_finish_date}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        projected_finish_date: e.target.value,
                      })
                    }
                  />
                </Field>

                <Field label="PO # (optional)">
                  <input
                    className="w-full rounded border px-2 py-1"
                    value={form.po_number}
                    onChange={(e) =>
                      setForm({ ...form, po_number: e.target.value })
                    }
                  />
                </Field>

                <Field label="PO Link (optional)">
                  <input
                    className="w-full rounded border px-2 py-1"
                    placeholder="Paste Google Drive link"
                    value={form.po_url}
                    onChange={(e) => setForm({ ...form, po_url: e.target.value })}
                  />
                </Field>

                <Field label="Job Folder Link (optional)">
                  <input
                    className="w-full rounded border px-2 py-1"
                    placeholder="Paste job folder link"
                    value={form.job_folder_url}
                    onChange={(e) =>
                      setForm({ ...form, job_folder_url: e.target.value })
                    }
                  />
                </Field>

                <Field label="Outsourced To (optional)">
                  <select
                    className="w-full rounded border bg-white px-2 py-1"
                    value={form.outsourced_to}
                    onChange={(e) =>
                      setForm({ ...form, outsourced_to: e.target.value })
                    }
                  >
                    <option value="none">—</option>
                    {subs.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Outsourced $ (optional)">
                  <input
                    className="w-full rounded border px-2 py-1"
                    placeholder="e.g. 4,500"
                    value={form.outsourced_amount}
                    onChange={(e) =>
                      setForm({ ...form, outsourced_amount: e.target.value })
                    }
                  />
                </Field>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  className="rounded-md border px-3 py-2 text-sm hover:bg-zinc-50"
                  onClick={() => setShowAdd(false)}
                  disabled={addingJob}
                >
                  Cancel
                </button>
                <button
                  className="rounded-md border bg-white px-3 py-2 text-sm hover:bg-zinc-50 disabled:opacity-50"
                  onClick={submitAddJob}
                  disabled={addingJob}
                >
                  {addingJob ? "Adding..." : "Create Job"}
                </button>
              </div>

              <div className="mt-3 text-xs text-zinc-500">
                If you get an RPC error about{" "}
                <span className="font-medium">p_rfq_url</span>, we need to update
                the SQL function{" "}
                <span className="font-medium">admin_add_job</span>.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ================= COMPONENTS ================= */

function KpiCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border bg-white p-6">
      <div className="text-sm text-zinc-500">{title}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <th className={`px-3 py-2 text-left ${className}`}>{children}</th>;
}

function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-3 py-2 align-middle ${className}`}>{children}</td>;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-medium text-zinc-600">{label}</div>
      {children}
    </label>
  );
}
