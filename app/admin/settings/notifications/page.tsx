"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type EventKey = "job_created" | "job_won" | "job_completed";

type NotificationRow = {
  event_key: EventKey;
  recipients: string[];
};

const events: Array<{ key: EventKey; title: string; description: string; defaults: string[] }> = [
  {
    key: "job_created",
    title: "New job created",
    description: "Sent after a job is added from the dashboard.",
    defaults: ["joe@stakdaz.com", "pm@stakdaz.com"],
  },
  {
    key: "job_won",
    title: "New job won",
    description: "Sent when a job status changes to Won.",
    defaults: ["accounting@stakdaz.com", "joe@stakdaz.com", "pm@stakdaz.com"],
  },
  {
    key: "job_completed",
    title: "Job completed / ready to bill",
    description: "Sent when a job reaches 100% complete.",
    defaults: ["accounting@stakdaz.com", "joe@stakdaz.com", "pm@stakdaz.com"],
  },
];

function parseEmails(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\n,; ]+/)
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

function validateStakdEmails(value: string) {
  const emails = parseEmails(value);
  const invalid = emails.filter((email) => !/^[^@\s]+@stakdaz\.com$/i.test(email));
  return { emails, invalid };
}

const quickRecipients = ["joe@stakdaz.com", "accounting@stakdaz.com", "pm@stakdaz.com"];

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export default function NotificationSettingsPage() {
  const [values, setValues] = useState<Record<EventKey, string[]>>({
    job_created: events[0].defaults,
    job_won: events[1].defaults,
    job_completed: events[2].defaults,
  });
  const [drafts, setDrafts] = useState<Record<EventKey, string>>({
    job_created: "",
    job_won: "",
    job_completed: "",
  });
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<EventKey | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("notification_settings")
        .select("event_key, recipients")
        .in("event_key", events.map((event) => event.key));

      if (!alive) return;

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      const next = { ...values };
      for (const row of (data ?? []) as NotificationRow[]) {
        next[row.event_key] = Array.isArray(row.recipients) ? row.recipients.map(normalizeEmail).filter(Boolean) : [];
      }
      setValues(next);
      setLoading(false);
    }

    load();

    return () => {
      alive = false;
    };
  }, []);

  const validation = useMemo(() => {
    return events.reduce<Record<EventKey, { emails: string[]; invalid: string[] }>>((acc, event) => {
      acc[event.key] = validateStakdEmails((values[event.key] || []).join("\n"));
      return acc;
    }, {} as Record<EventKey, { emails: string[]; invalid: string[] }>);
  }, [values]);

  function addRecipient(eventKey: EventKey, emailValue = drafts[eventKey]) {
    const email = normalizeEmail(emailValue);
    setMessage(null);
    setError(null);

    if (!email) return;

    if (!/^[^@\s]+@stakdaz\.com$/i.test(email)) {
      setError("Only @stakdaz.com addresses are allowed.");
      return;
    }

    setValues((prev) => ({
      ...prev,
      [eventKey]: Array.from(new Set([...(prev[eventKey] || []), email])),
    }));
    setDrafts((prev) => ({ ...prev, [eventKey]: "" }));
  }

  function removeRecipient(eventKey: EventKey, email: string) {
    setMessage(null);
    setError(null);
    setValues((prev) => ({
      ...prev,
      [eventKey]: (prev[eventKey] || []).filter((recipient) => recipient !== email),
    }));
  }

  async function save(eventKey: EventKey) {
    const draftEmail = normalizeEmail(drafts[eventKey]);
    const emailsToSave = Array.from(new Set([...(values[eventKey] || []), draftEmail].filter(Boolean)));
    const parsed = validateStakdEmails(emailsToSave.join("\n"));
    setMessage(null);
    setError(null);

    if (!parsed.emails.length) {
      setError("Add at least one @stakdaz.com email address.");
      return;
    }

    if (parsed.invalid.length) {
      setError(`Only @stakdaz.com addresses are allowed: ${parsed.invalid.join(", ")}`);
      return;
    }

    setSavingKey(eventKey);
    const { error } = await supabase.from("notification_settings").upsert(
      {
        event_key: eventKey,
        recipients: parsed.emails,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "event_key" }
    );
    setSavingKey(null);

    if (error) {
      setError(error.message);
      return;
    }

    setValues((prev) => ({ ...prev, [eventKey]: parsed.emails }));
    setDrafts((prev) => ({ ...prev, [eventKey]: "" }));
    setMessage("Notification settings saved.");
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 lg:p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <div className="text-3xl font-semibold tracking-tight text-slate-950">Notifications</div>
          <div className="mt-1 text-sm text-slate-500">
            Choose which STAKD addresses receive operational email alerts.
          </div>
        </div>

        {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        {message && <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{message}</div>}

        <div className="grid gap-4">
          {events.map((event) => {
            const parsed = validation[event.key];
            return (
              <section key={event.key} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="text-lg font-semibold text-slate-950">{event.title}</div>
                    <div className="mt-1 text-sm text-slate-500">{event.description}</div>
                  </div>
                  <button
                    onClick={() => save(event.key)}
                    disabled={loading || savingKey === event.key}
                    className="rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-800 disabled:opacity-50"
                  >
                    {savingKey === event.key ? "Saving..." : "Save"}
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  {parsed.emails.map((email) => (
                    <span
                      key={email}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-slate-700"
                    >
                      {email}
                      <button
                        type="button"
                        onClick={() => removeRecipient(event.key, email)}
                        className="rounded-full px-1 text-slate-500 hover:bg-slate-200 hover:text-slate-900"
                        aria-label={`Remove ${email}`}
                      >
                        x
                      </button>
                    </span>
                  ))}
                  {!parsed.emails.length && <span className="text-sm text-slate-500">No recipients selected.</span>}
                </div>

                {parsed.invalid.length > 0 && (
                  <div className="mt-3 text-xs font-medium text-red-700">
                    Invalid: {parsed.invalid.join(", ")}
                  </div>
                )}

                <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
                  <input
                    value={drafts[event.key]}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [event.key]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addRecipient(event.key);
                      }
                    }}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                    placeholder="name@stakdaz.com"
                  />
                  <button
                    type="button"
                    onClick={() => addRecipient(event.key)}
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
                  >
                    Add recipient
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {quickRecipients.map((email) => {
                    const selected = parsed.emails.includes(email);
                    return (
                      <button
                        key={email}
                        type="button"
                        onClick={() => (selected ? removeRecipient(event.key, email) : addRecipient(event.key, email))}
                        className={`rounded-full border px-3 py-1.5 transition ${
                          selected
                            ? "border-sky-200 bg-sky-50 text-sky-800"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {selected ? "Selected " : "Add "}
                        {email}
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
