"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Job = {
  id: string;
  job_number: string | null;
  job_name: string | null;
  status: string | null;
  percent_complete: number | null;
  projected_finish_date: string | null;
  is_archived: boolean | null;
  client_id?: string | null;

  // links
  job_folder_url?: string | null;
  po_number?: string | null;
  po_url?: string | null;
  rfq_url?: string | null;
  shipping_tickets_url?: string | null;
};

function safeUrl(url: string | null | undefined) {
  const u = String(url ?? "").trim();
  if (!u) return "";
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  return `https://${u}`;
}

function formatDate(d: string | null | undefined) {
  const t = String(d ?? "").trim();
  if (!t) return "—";
  return t;
}

/**
 * Client-facing status translation.
 */
function clientStatus(dbStatus: string | null, percent: number | null) {
  const p = percent ?? null;
  if (p !== null && p >= 100) return "Completed";

  const s = (dbStatus ?? "").toLowerCase();
  if (s === "quoting") return "Quoting";
  if (s === "quoted") return "Waiting on Client";
  if (s === "won") return "In Progress";
  if (s === "lost") return "Lost";
  return dbStatus ?? "—";
}

function statusPillClass(label: string) {
  const s = label.toLowerCase();
  if (s === "in progress") {
    return "bg-emerald-50 text-emerald-800 border-emerald-200";
  }
  if (s === "completed") {
    return "bg-sky-50 text-sky-800 border-sky-200";
  }
  if (s === "waiting on client") {
    return "bg-sky-50 text-sky-800 border-sky-200";
  }
  if (s === "quoting") {
    return "bg-amber-50 text-amber-800 border-amber-200";
  }
  return "bg-zinc-50 text-zinc-800 border-zinc-200";
}

function ProgressBar({
  show,
  percent,
}: {
  show: boolean;
  percent: number | null;
}) {
  if (!show) return <span className="text-zinc-400">—</span>;

  const p = Math.max(0, Math.min(100, Number(percent ?? 0)));

  return (
    <div className="flex items-center justify-center gap-3">
      <div className="h-2 w-40 overflow-hidden rounded-full bg-zinc-100">
        <div
          className="h-full rounded-full bg-sky-300"
          style={{ width: `${p}%` }}
        />
      </div>
      <div className="w-10 text-right text-xs tabular-nums text-zinc-700">
        {p}%
      </div>
    </div>
  );
}

export default function PortalPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  // Concern modal state
  const [concernOpen, setConcernOpen] = useState(false);
  const [concernJob, setConcernJob] = useState<Job | null>(null);
  const [concernText, setConcernText] = useState("");
  const [sendingConcern, setSendingConcern] = useState(false);
  const [concernMsg, setConcernMsg] = useState<string | null>(null);

  const isInternal = useMemo(() => {
    const e = (sessionEmail || "").toLowerCase();
    return e.endsWith("@stakdaz.com");
  }, [sessionEmail]);

  const userDomain = useMemo(() => {
    const e = (sessionEmail || "").toLowerCase().trim();
    const at = e.indexOf("@");
    if (at < 0) return null;
    return e.slice(at + 1);
  }, [sessionEmail]);

  const logoSrc = useMemo(() => {
    if (isInternal) return "/stakd-logo.png";

    const d = (userDomain || "").toLowerCase();
    const map: Record<string, string> = {
      "roxteel.com": "/client-logos/roxteel.png",
      "blucor.com": "/client-logos/blucor.png",
    };

    return map[d] || "/stakd-logo.png";
  }, [isInternal, userDomain]);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        const email = data.session?.user?.email ?? null;
        if (!email) {
          router.replace("/login");
          return;
        }

        if (!alive) return;
        setSessionEmail(email);

        const { data: rows, error: qErr } = await supabase
          .from("jobs")
          .select(
            "id, job_number, job_name, status, percent_complete, projected_finish_date, is_archived, client_id, job_folder_url, po_number, po_url, rfq_url, shipping_tickets_url"
          )
          .eq("is_archived", false)
          .neq("status", "Lost")
          .order("job_number", { ascending: true });

        if (qErr) throw qErr;
        if (!alive) return;

        setJobs((rows as Job[]) || []);
      } catch (e: any) {
        console.error(e);
        if (!alive) return;
        setError(e?.message ?? "Failed to load jobs.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return jobs;

    return jobs.filter((j) => {
      const a = (j.job_number ?? "").toLowerCase();
      const b = (j.job_name ?? "").toLowerCase();
      const c = (j.status ?? "").toLowerCase();
      const d = (j.po_number ?? "").toLowerCase();

      return (
        a.includes(needle) ||
        b.includes(needle) ||
        c.includes(needle) ||
        d.includes(needle)
      );
    });
  }, [jobs, q]);

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  function openConcern(job: Job) {
    setConcernMsg(null);
    setConcernText("");
    setConcernJob(job);
    setConcernOpen(true);
  }

  async function submitConcern() {
    if (!concernJob) return;

    const body = concernText.trim();
    if (!body) {
      setConcernMsg("Please type your concern before sending.");
      return;
    }

    try {
      setSendingConcern(true);
      setConcernMsg(null);

      const res = await fetch("/api/concern", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromEmail: sessionEmail,
          job: {
            id: concernJob.id,
            job_number: concernJob.job_number,
            job_name: concernJob.job_name,
            po_number: concernJob.po_number,
          },
          message: body,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error || "Failed to send concern.");
      }

      setConcernMsg("Sent. Joe will follow up soon.");
      setTimeout(() => {
        setConcernOpen(false);
        setConcernJob(null);
        setConcernText("");
        setConcernMsg(null);
      }, 900);
    } catch (e: any) {
      setConcernMsg(e?.message ?? "Failed to send concern.");
    } finally {
      setSendingConcern(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white p-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between gap-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border bg-white shadow-md">
              <img
                src={logoSrc}
                alt="Client logo"
                className="max-h-[80%] max-w-[80%] object-contain"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = "/stakd-logo.png";
                }}
              />
            </div>

            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold">Client Portal</h1>
                <span className="rounded-full border bg-sky-50 px-3 py-1 text-xs text-sky-800">
                  Jobs visible to your company
                </span>
              </div>

              <div className="mt-2 flex items-center gap-2 text-xs text-zinc-600">
                <span className="inline-block h-2 w-2 rounded-full bg-sky-400" />
                <span>
                  Signed in as{" "}
                  <span className="font-medium text-zinc-800">
                    {sessionEmail ?? "—"}
                  </span>{" "}
                  {isInternal ? "(internal)" : "(client)"}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={signOut}
            className="rounded-full border bg-white px-5 py-2 text-sm hover:bg-zinc-50"
          >
            Logout
          </button>
        </div>

        <div className="mt-6 rounded-2xl border bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold">Jobs</div>
              <div className="text-xs text-zinc-600">
                Status is translated for clients. Lost & archived jobs are
                hidden.
              </div>
            </div>

            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search job #, name, status, PO…"
              className="w-full rounded-lg border px-4 py-2 text-sm sm:w-[420px]"
            />
          </div>

          {error && (
            <div className="m-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {loading ? (
            <div className="p-5 text-sm text-zinc-600">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-5 text-sm text-zinc-600">
              No jobs found.
              <div className="mt-2 text-xs text-zinc-500">
                Jobs are visible based on your company email domain.
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 text-zinc-600">
                  <tr className="border-b">
                    <th className="px-4 py-3 text-left">Job #</th>
                    <th className="px-4 py-3 text-left">Job Name</th>
                    <th className="px-4 py-3 text-center">Job Link</th>
                    <th className="px-4 py-3 text-center">RFQ Link</th>
                    <th className="px-4 py-3 text-center">Shipping Tickets</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-center">% Complete</th>
                    <th className="px-4 py-3 text-center">
                      Estimated Completion Date
                    </th>
                    <th className="px-4 py-3 text-center">PO #</th>
                    <th className="px-4 py-3 text-center">PO Link</th>
                    <th className="px-4 py-3 text-center">Concern</th>
                  </tr>
                </thead>

                <tbody>
                  {filtered.map((j) => {
                    const displayStatus = clientStatus(
                      j.status,
                      j.percent_complete
                    );
                    const showBar = displayStatus === "In Progress";

                    const jobLink = safeUrl(j.job_folder_url);
                    const rfqLink = safeUrl(j.rfq_url);
                    const shippingLink = safeUrl(j.shipping_tickets_url);
                    const poLink = safeUrl(j.po_url);

                    return (
                      <tr key={j.id} className="border-b last:border-b-0">
                        <td className="px-4 py-3 text-left font-medium text-zinc-900">
                          {j.job_number ?? "—"}
                        </td>

                        <td className="px-4 py-3 text-left">
                          {j.job_name ?? "—"}
                        </td>

                        <td className="px-4 py-3 text-center">
                          {jobLink ? (
                            <a
                              href={jobLink}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center justify-center rounded-full border bg-white px-3 py-1 text-xs hover:bg-zinc-50"
                            >
                              Open
                            </a>
                          ) : (
                            <span className="text-xs text-zinc-400">No link</span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-center">
                          {rfqLink ? (
                            <a
                              href={rfqLink}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center justify-center rounded-full border bg-white px-3 py-1 text-xs hover:bg-zinc-50"
                            >
                              Open
                            </a>
                          ) : (
                            <span className="text-xs text-zinc-400">—</span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-center">
                          {shippingLink ? (
                            <a
                              href={shippingLink}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center justify-center rounded-full border bg-white px-3 py-1 text-xs hover:bg-zinc-50"
                            >
                              Open
                            </a>
                          ) : (
                            <span className="text-xs text-zinc-400">—</span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs ${statusPillClass(
                              displayStatus
                            )}`}
                          >
                            {displayStatus}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-center">
                          <ProgressBar
                            show={showBar}
                            percent={j.percent_complete}
                          />
                        </td>

                        <td className="px-4 py-3 text-center text-zinc-700">
                          {formatDate(j.projected_finish_date)}
                        </td>

                        <td className="px-4 py-3 text-center text-zinc-700">
                          {j.po_number ? j.po_number : "—"}
                        </td>

                        <td className="px-4 py-3 text-center">
                          {poLink && j.po_number ? (
                            <a
                              href={poLink}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center justify-center rounded-full border bg-white px-3 py-1 text-xs hover:bg-zinc-50"
                            >
                              Open
                            </a>
                          ) : (
                            <span className="text-xs text-zinc-400">—</span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => openConcern(j)}
                            className="inline-flex items-center justify-center rounded-full border bg-white px-3 py-1 text-xs hover:bg-zinc-50"
                          >
                            Report
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="px-5 py-3 text-xs text-zinc-500">
                Jobs are visible based on your company email domain.
              </div>
            </div>
          )}
        </div>
      </div>

      {concernOpen && concernJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-2xl border bg-white shadow-lg">
            <div className="flex items-center justify-between border-b p-4">
              <div>
                <div className="text-sm font-semibold">Job Concern</div>
                <div className="text-xs text-zinc-600">
                  {concernJob.job_number ?? "—"} —{" "}
                  {concernJob.job_name ?? "—"}
                </div>
              </div>

              <button
                onClick={() => {
                  if (sendingConcern) return;
                  setConcernOpen(false);
                  setConcernJob(null);
                  setConcernText("");
                  setConcernMsg(null);
                }}
                className="rounded-full border px-3 py-1 text-xs hover:bg-zinc-50"
              >
                Close
              </button>
            </div>

            <div className="p-4">
              <label className="mb-2 block text-xs font-medium text-zinc-700">
                Describe your concern (this will email Joe)
              </label>

              <textarea
                className="min-h-[140px] w-full rounded-xl border p-3 text-sm"
                placeholder="Type your message here…"
                value={concernText}
                onChange={(e) => setConcernText(e.target.value)}
              />

              {concernMsg && (
                <div className="mt-3 rounded-lg border bg-zinc-50 p-3 text-sm text-zinc-800">
                  {concernMsg}
                </div>
              )}

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  onClick={() => {
                    if (sendingConcern) return;
                    setConcernOpen(false);
                    setConcernJob(null);
                    setConcernText("");
                    setConcernMsg(null);
                  }}
                  className="rounded-full border bg-white px-4 py-2 text-sm hover:bg-zinc-50"
                  disabled={sendingConcern}
                >
                  Cancel
                </button>

                <button
                  onClick={submitConcern}
                  className="rounded-full border bg-sky-600 px-4 py-2 text-sm text-white hover:bg-sky-700 disabled:opacity-60"
                  disabled={sendingConcern}
                >
                  {sendingConcern ? "Sending…" : "Send to Joe"}
                </button>
              </div>

              <div className="mt-3 text-xs text-zinc-500">
                This sends an email to{" "}
                <span className="font-medium">joe@stakdaz.com</span>.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
