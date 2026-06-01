import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export type AuthenticatedUser = {
  id: string;
  email: string;
};

function bearerToken(req: Request) {
  const auth = req.headers.get("authorization") || "";
  return auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
}

export async function getAuthenticatedUser(req: Request): Promise<AuthenticatedUser | null> {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }

  const token = bearerToken(req);
  if (!token) return null;

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await client.auth.getUser();
  if (error || !data.user?.email) return null;

  return {
    id: data.user.id,
    email: data.user.email.toLowerCase(),
  };
}

export async function requireInternalUser(req: Request) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return { user: null, response: Response.json({ error: "Missing or invalid auth token." }, { status: 401 }) };
  }

  if (!user.email.endsWith("@stakdaz.com")) {
    return { user: null, response: Response.json({ error: "Not authorized." }, { status: 403 }) };
  }

  return { user, response: null };
}
