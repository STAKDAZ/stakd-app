"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type ClientRow = {
  id: string;
  name: string;
  is_archived: boolean;
  color_hex: string | null;
};

const DEFAULT_COLOR = "#64748B";

function normalizeHex(input: string): string | null {
  const t = (input ?? "").trim();
  if (!t) return null;

  const s = t.startsWith("#") ? t : `#${t}`;
  if (!/^#[0-9A-Fa-f]{6}$/.test(s)) return null;
  return s.toUpperCase();
}

export default function ClientsSettingsPage() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [newName, setNewName] = useState("");

  async function loadClients() {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase.rpc("admin_clients_list");
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setClients((data ?? []) as ClientRow[]);
    setLoading(false);
  }

  useEffect(() => {
    loadClients();
  }, []);

  const activeClients = useMemo(() => clients.filter((c) => !c.is_archived), [clients]);
  const archivedClients = useMemo(() => clients.filter((c) => c.is_archived), [clients]);

  async function addClient() {
    const name = newName.trim();
    if (!name) return;

    setError(null);
    setSavingId("new");

    const { error } = await supabase.rpc("admin_client_add", { p_name: name });

    if (error) {
      setError(error.message);
      setSavingId(null);
      return;
    }

    setNewName("");
    setSavingId(null);
    await loadClients();
  }

  async function updateClientName(id: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;

    setError(null);
    setSavingId(id);

    const { error } = await supabase.rpc("admin_client_update", {
      p_id: id,
      p_name: trimmed,
    });

    if (error) {
      setError(error.message);
      setSavingId(null);
      return;
    }

    setSavingId(null);
    await loadClients();
  }

  async function updateClientColor(id: string, colorHex: string | null) {
    setError(null);
    setSavingId(id);

    const { error } = await supabase.rpc("admin_client_set_color", {
      p_id: id,
      p_color_hex: colorHex,
    });

    if (error) {
      setError(error.message);
      setSavingId(null);
      return;
    }

    setSavingId(null);
    await loadClients();
  }

  async function setArchived(id: string, archived: boolean) {
    setError(null);
    setSavingId(id);

    const { error } = await supabase.rpc("admin_client_set_archived", {
      p_id: id,
      p_archived: archived,
    });

    if (error) {
      setError(error.message);
      setSavingId(null);
      return;
    }

    setSavingId(null);
    await loadClients();
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-4">
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="text-2xl font-semibold">Settings · Clients</div>
            <div className="text-sm text-zinc-600">
              Add and manage customers used in jobs. Set a color to control the dashboard “bubble”.
            </div>
          </div>

          <a
            href="/admin/dashboard"
            className="rounded-md border bg-white px-3 py-2 text-sm hover:bg-zinc-50"
          >
            Back to Dashboard
          </a>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mb-6 rounded-xl border bg-white p-4">
          <div className="mb-2 text-sm font-semibold">Add Client</div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              className="w-full rounded border px-3 py-2 text-sm"
              placeholder="Client name (e.g., Roxteel)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addClient();
              }}
            />
            <button
              className="rounded-md border bg-white px-3 py-2 text-sm hover:bg-zinc-50 disabled:opacity-50"
              onClick={addClient}
              disabled={savingId === "new"}
            >
              {savingId === "new" ? "Adding..." : "Add"}
            </button>
          </div>
        </div>

        <div className="rounded-xl border bg-white">
          <div className="border-b p-4 text-sm font-semibold">Active Clients</div>

          {loading ? (
            <div className="p-4 text-sm text-zinc-600">Loading…</div>
          ) : activeClients.length === 0 ? (
            <div className="p-4 text-sm text-zinc-600">No clients yet.</div>
          ) : (
            <div className="divide-y">
              {activeClients.map((c) => (
                <ClientRowItem
                  key={c.id}
                  client={c}
                  saving={savingId === c.id}
                  onSaveName={(name) => updateClientName(c.id, name)}
                  onSaveColor={(hex) => updateClientColor(c.id, hex)}
                  onArchive={() => setArchived(c.id, true)}
                />
              ))}
            </div>
          )}

          <div className="border-t bg-zinc-50 p-4 text-sm font-semibold">Archived</div>

          {archivedClients.length === 0 ? (
            <div className="p-4 text-sm text-zinc-600">None</div>
          ) : (
            <div className="divide-y">
              {archivedClients.map((c) => (
                <div key={c.id} className="flex items-center gap-3 p-4">
                  <div className="flex-1 text-sm text-zinc-700">{c.name}</div>
                  <button
                    className="rounded-md border bg-white px-3 py-2 text-xs hover:bg-zinc-50 disabled:opacity-50"
                    onClick={() => setArchived(c.id, false)}
                    disabled={savingId === c.id}
                  >
                    Unarchive
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 text-sm text-zinc-600">
          After setting colors here, go back to the dashboard — the Customer bubble will use the client color.
        </div>
      </div>
    </div>
  );
}

function ClientRowItem({
  client,
  saving,
  onSaveName,
  onSaveColor,
  onArchive,
}: {
  client: ClientRow;
  saving: boolean;
  onSaveName: (name: string) => void;
  onSaveColor: (colorHex: string | null) => void;
  onArchive: () => void;
}) {
  const [name, setName] = useState(client.name);

  const [color, setColor] = useState<string>(client.color_hex ?? DEFAULT_COLOR);
  const [hexInput, setHexInput] = useState<string>(client.color_hex ?? DEFAULT_COLOR);
  const [hexError, setHexError] = useState<string | null>(null);

  useEffect(() => setName(client.name), [client.name]);
  useEffect(() => {
    const next = client.color_hex ?? DEFAULT_COLOR;
    setColor(next);
    setHexInput(next);
    setHexError(null);
  }, [client.color_hex]);

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          className="w-full flex-1 rounded border px-3 py-2 text-sm"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <div className="flex items-center gap-2">
          <button
            className="rounded-md border bg-white px-3 py-2 text-xs hover:bg-zinc-50 disabled:opacity-50"
            onClick={() => onSaveName(name)}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Name"}
          </button>

          <button
            className="rounded-md border bg-white px-3 py-2 text-xs hover:bg-zinc-50 disabled:opacity-50"
            onClick={onArchive}
            disabled={saving}
          >
            Archive
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div
            className="h-8 w-8 rounded-md border"
            style={{ backgroundColor: color, borderColor: "rgba(0,0,0,0.2)" }}
          />
          <div className="text-sm font-medium text-zinc-700">Color</div>
        </div>

        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="color"
            className="h-10 w-14 cursor-pointer rounded border bg-white p-1"
            value={color}
            onChange={(e) => {
              const v = e.target.value.toUpperCase();
              setColor(v);
              setHexInput(v);
              setHexError(null);
            }}
          />

          <div className="flex flex-1 items-center gap-2">
            <input
              className="w-full rounded border px-3 py-2 text-sm"
              value={hexInput}
              placeholder="#2563EB"
              onChange={(e) => {
                setHexInput(e.target.value);
                setHexError(null);
              }}
              onBlur={() => {
                const normalized = normalizeHex(hexInput);
                if (!normalized) {
                  setHexError("Use a 6-digit hex like #2563EB");
                  return;
                }
                setColor(normalized);
                setHexInput(normalized);
              }}
            />

            <button
              className="rounded-md border bg-white px-3 py-2 text-xs hover:bg-zinc-50 disabled:opacity-50"
              disabled={saving}
              onClick={() => {
                const normalized = normalizeHex(hexInput);
                if (!normalized) {
                  setHexError("Use a 6-digit hex like #2563EB");
                  return;
                }
                onSaveColor(normalized);
              }}
            >
              {saving ? "Saving..." : "Save Color"}
            </button>

            <button
              className="rounded-md border bg-white px-3 py-2 text-xs hover:bg-zinc-50 disabled:opacity-50"
              disabled={saving}
              onClick={() => onSaveColor(null)}
              title="Reset to default"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {hexError && <div className="text-xs text-red-600">{hexError}</div>}
    </div>
  );
}
