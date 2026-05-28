"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

function getHashParams() {
  if (typeof window === "undefined") return new URLSearchParams();
  const hash = window.location.hash?.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash || "";
  return new URLSearchParams(hash);
}

function getQueryParam(name: string) {
  if (typeof window === "undefined") return null;
  const sp = new URLSearchParams(window.location.search);
  return sp.get(name);
}

export default function ResetPasswordClient() {
  const router = useRouter();

  const [status, setStatus] = useState<
    "exchanging" | "ready" | "saving" | "saved" | "error"
  >("exchanging");
  const [message, setMessage] = useState<string>("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setStatus("exchanging");
        setMessage("");

        const hashParams = getHashParams();

        // If Supabase returned an error in the hash, show it
        const hashErr =
          hashParams.get("error_description") || hashParams.get("error");
        const hashErrCode = hashParams.get("error_code");

        if (hashErr) {
          setStatus("error");
          setMessage(
            decodeURIComponent(hashErr) +
              (hashErrCode ? ` (code: ${hashErrCode})` : "")
          );
          return;
        }

        // Newer flow: /reset-password?code=...
        const code = getQueryParam("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;

          if (!cancelled) setStatus("ready");
          return;
        }

        // Older flow: #access_token=...&refresh_token=...
        const access_token = hashParams.get("access_token");
        const refresh_token = hashParams.get("refresh_token");

        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });
          if (error) throw error;

          // Clean the URL so refresh doesn't re-run the token flow
          window.history.replaceState({}, document.title, "/reset-password");

          if (!cancelled) setStatus("ready");
          return;
        }

        setStatus("error");
        setMessage(
          "Missing reset token. Please request a new password reset email and open the newest link right away."
        );
      } catch (e: any) {
        setStatus("error");
        setMessage(e?.message || "Could not start password reset session.");
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, []);

  async function onSave(e: FormEvent) {
    e.preventDefault();

    if (password.length < 8) {
      setMessage("Password must be at least 8 characters.");
      return;
    }
    if (password !== password2) {
      setMessage("Passwords do not match.");
      return;
    }

    setStatus("saving");
    setMessage("");

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setStatus("ready");
      setMessage(error.message);
      return;
    }

    setStatus("saved");
    setMessage("Password updated. Redirecting to login...");

    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow">
        <h1 className="text-2xl font-semibold">Reset password</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Use the link from your email to set a new password.
        </p>

        {message ? (
          <div
            className={`mt-4 rounded-lg p-3 text-sm ${
              status === "error"
                ? "bg-red-50 text-red-700"
                : "bg-zinc-50 text-zinc-700"
            }`}
          >
            {message}
          </div>
        ) : null}

        {status === "exchanging" ? (
          <div className="mt-6 text-sm text-zinc-600">
            Validating reset link…
          </div>
        ) : null}

        {(status === "ready" || status === "saving" || status === "saved") && (
          <form onSubmit={onSave} className="mt-6 space-y-3">
            <div>
              <label className="block text-sm font-medium text-zinc-800">
                New password
              </label>
              <input
                type="password"
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-800">
                Confirm new password
              </label>
              <input
                type="password"
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={status === "saving"}
              className="w-full rounded-lg bg-black px-4 py-2 text-white disabled:opacity-60"
            >
              {status === "saving" ? "Saving…" : "Update password"}
            </button>
          </form>
        )}

        {status === "error" && (
          <div className="mt-6">
            <a className="text-sm underline" href="/login">
              Back to login
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
