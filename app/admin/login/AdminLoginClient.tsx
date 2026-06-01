"use client";

import { useEffect, useState, type FormEvent, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

type FlashMsg = { type: "error" | "success"; text: string };

export default function AdminLoginClient({ next }: { next: string }) {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState<FlashMsg | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!alive) return;
      if (data.session) router.replace(next);
    })();

    return () => {
      alive = false;
    };
  }, [router, next]);

  async function signIn(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: pw,
    });

    setLoading(false);

    if (error) {
      setMsg({ type: "error", text: error.message });
      return;
    }

    const signedEmail = data.session?.user.email?.toLowerCase() ?? "";
    if (!signedEmail.endsWith("@stakdaz.com")) {
      await supabase.auth.signOut();
      setMsg({
        type: "error",
        text: "Only authorized @stakdaz.com users can access this STAKD app.",
      });
      return;
    }

    router.replace(next);
  }

  async function sendReset(e: MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    setMsg(null);

    const trimmed = email.trim();
    if (!trimmed) {
      setMsg({
        type: "error",
        text: "Enter your email first, then click Forgot password.",
      });
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setLoading(false);

    if (error) {
      setMsg({ type: "error", text: error.message });
      return;
    }

    setMsg({
      type: "success",
      text: "Reset email sent. Open the newest email link right away.",
    });
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <Image src="/stakd-logo.png" alt="STAKD" width={40} height={40} />
          <div>
            <div className="text-lg font-semibold">STAKD Admin</div>
            <div className="text-xs text-zinc-500">Authorized access only</div>
          </div>
        </div>

        {msg && (
          <div
            className={`mt-4 rounded-md border p-3 text-sm ${
              msg.type === "error"
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-green-200 bg-green-50 text-green-800"
            }`}
          >
            {msg.text}
          </div>
        )}

        <form onSubmit={signIn} className="mt-5 space-y-3">
          <div>
            <div className="mb-1 text-xs font-medium text-zinc-600">Email</div>
            <input
              className="w-full rounded-md border px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@stakdaz.com"
              autoComplete="email"
            />
          </div>

          <div>
            <div className="mb-1 text-xs font-medium text-zinc-600">
              Password
            </div>
            <input
              type="password"
              className="w-full rounded-md border px-3 py-2"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          <button
            disabled={loading}
            className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>

          <button
            type="button"
            onClick={sendReset}
            disabled={loading}
            className="w-full rounded-md border px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:opacity-50"
          >
            Forgot password
          </button>

          <Link
            href="/"
            className="block text-center text-xs text-zinc-500 hover:underline"
          >
            Back to home
          </Link>
        </form>
      </div>
    </div>
  );
}
