import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireInternalUser } from "@/lib/supabase/server-auth";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function adminClient() {
  if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL.");
  if (!serviceRoleKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function cleanEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function isStakdEmail(email: string) {
  return email.endsWith("@stakdaz.com");
}

function isAccessAdmin(email: string) {
  const configured = (process.env.STAKD_ACCESS_ADMIN_EMAILS || "joe@stakdaz.com")
    .split(",")
    .map((value) => cleanEmail(value))
    .filter(Boolean);
  return configured.includes(cleanEmail(email));
}

async function requireAccessAdmin(req: Request) {
  const auth = await requireInternalUser(req);
  if (auth.response) return auth;

  if (!isAccessAdmin(auth.user.email)) {
    return {
      user: null,
      response: NextResponse.json(
        { error: "Only a STAKD access admin can manage user access." },
        { status: 403 }
      ),
    };
  }

  return auth;
}

export async function GET(req: Request) {
  try {
    const auth = await requireAccessAdmin(req);
    if (auth.response) return auth.response;

    const { data, error } = await adminClient().auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const users = data.users
      .filter((user) => isStakdEmail(cleanEmail(user.email)))
      .map((user) => ({
        id: user.id,
        email: cleanEmail(user.email),
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at ?? null,
        invited_at: user.invited_at ?? null,
        email_confirmed_at: user.email_confirmed_at ?? null,
        is_current_user: user.id === auth.user.id,
      }))
      .sort((a, b) => a.email.localeCompare(b.email));

    return NextResponse.json({ users });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load users.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireAccessAdmin(req);
    if (auth.response) return auth.response;

    const body = await req.json();
    const email = cleanEmail(body?.email);

    if (!isStakdEmail(email)) {
      return NextResponse.json(
        { error: "Enter a valid @stakdaz.com email address." },
        { status: 400 }
      );
    }

    const redirectTo = new URL("/reset-password", req.url).toString();
    const { data, error } = await adminClient().auth.admin.inviteUserByEmail(email, {
      redirectTo,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({
      ok: true,
      user: {
        id: data.user.id,
        email: cleanEmail(data.user.email),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not invite user.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const auth = await requireAccessAdmin(req);
    if (auth.response) return auth.response;

    const body = await req.json();
    const id = String(body?.id ?? "").trim();

    if (!id) {
      return NextResponse.json({ error: "User id is required." }, { status: 400 });
    }
    if (id === auth.user.id) {
      return NextResponse.json(
        { error: "You cannot revoke your own access while signed in." },
        { status: 400 }
      );
    }

    const { error } = await adminClient().auth.admin.deleteUser(id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not revoke access.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
