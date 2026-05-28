// app/admin/logout/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function AdminLogoutPage() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      // Sign out (clears the Supabase session)
      await supabase.auth.signOut();

      // Send them somewhere real (pick what you want)
      router.replace("/login");
    })();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50">
      <div className="text-zinc-600">Signing you out…</div>
    </div>
  );
}
