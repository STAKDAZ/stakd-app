"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase/client";
import { PrecastYardMark } from "@/components/precast-yard-mark";

type AccessUser = {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  invited_at: string | null;
  email_confirmed_at: string | null;
  is_current_user: boolean;
};

function fmtDate(value: string | null) {
  if (!value) return "Not yet";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export default function UserAccessPage() {
  const [users, setUsers] = useState<AccessUser[]>([]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const request = useCallback(async (path: string, init?: RequestInit) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Your login session expired. Please sign in again.");

    const res = await fetch(path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(init?.headers ?? {}),
      },
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new Error(json?.error || "Request failed.");
    return json;
  }, []);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const json = await request("/api/admin/users");
      setUsers(json.users ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load users.");
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  async function invite(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await request("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setEmail("");
      setNotice("Invite sent. They can use the email link to choose a password.");
      await loadUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send invite.");
    } finally {
      setSaving(false);
    }
  }

  async function revoke(user: AccessUser) {
    if (
      !window.confirm(
        `Revoke access for ${user.email}?\n\nThey will no longer be able to sign in to the STAKD app.`
      )
    ) {
      return;
    }

    setError(null);
    setNotice(null);
    try {
      await request("/api/admin/users", {
        method: "DELETE",
        body: JSON.stringify({ id: user.id }),
      });
      setNotice(`${user.email} no longer has access.`);
      await loadUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not revoke access.");
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 lg:p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-3xl font-semibold tracking-tight text-slate-950">
              User Access
            </div>
            <div className="mt-1 text-sm text-slate-500">
              Invite STAKD teammates and remove access when needed.
            </div>
          </div>
          <PrecastYardMark compact />
        </div>

        {error ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}
        {notice ? (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            {notice}
          </div>
        ) : null}

        <section className="border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-lg font-semibold text-slate-950">Invite teammate</div>
          <div className="mt-1 text-sm text-slate-600">
            Access is limited to company email addresses ending in @stakdaz.com.
          </div>
          <form onSubmit={invite} className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@stakdaz.com"
              className="min-w-0 flex-1 border border-slate-300 bg-white px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={saving}
              className="bg-cyan-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-900 disabled:opacity-60"
            >
              {saving ? "Sending..." : "Send invite"}
            </button>
          </form>
        </section>

        <section className="mt-5 overflow-hidden border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="text-lg font-semibold text-slate-950">People with access</div>
            <div className="mt-1 text-sm text-slate-600">
              Invited users set their password from the email link.
            </div>
          </div>

          {loading ? (
            <div className="px-5 py-6 text-sm text-slate-500">Loading access list...</div>
          ) : users.length === 0 ? (
            <div className="px-5 py-6 text-sm text-slate-500">No users found.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900">{user.email}</span>
                      {user.is_current_user ? (
                        <span className="border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[11px] font-semibold text-cyan-800">
                          You
                        </span>
                      ) : null}
                      <span
                        className={`border px-2 py-0.5 text-[11px] font-semibold ${
                          user.email_confirmed_at
                            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                            : "border-amber-200 bg-amber-50 text-amber-800"
                        }`}
                      >
                        {user.email_confirmed_at ? "Active" : "Invite pending"}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Invited {fmtDate(user.invited_at || user.created_at)} / Last sign-in{" "}
                      {fmtDate(user.last_sign_in_at)}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={user.is_current_user}
                    onClick={() => revoke(user)}
                    className="border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Revoke access
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
