// Shared helpers for C.M Edge Functions (Deno runtime on Supabase).
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

/** Prefers Supabase's new API keys (JSON dictionary, e.g. {"default": "sb_..."});
 *  falls back to the legacy JWT keys, which Supabase marks as deprecated. */
function apiKey(newVar: string, legacyVar: string): string {
  const raw = Deno.env.get(newVar);
  if (raw) {
    try {
      const dict = JSON.parse(raw) as Record<string, string>;
      const key = dict.default ?? Object.values(dict)[0];
      if (key) return key;
    } catch { /* not JSON — ignore */ }
  }
  const legacy = Deno.env.get(legacyVar);
  if (!legacy) throw new Error(`Missing ${newVar} / ${legacyVar}`);
  return legacy;
}

/** Returns the signed-in user, a client acting AS that user (RLS applies),
 *  and a service client (bypasses RLS — used only after checks). */
export async function getContext(req: Request): Promise<
  { user: { id: string }; userClient: SupabaseClient; admin: SupabaseClient } | Response
> {
  const auth = req.headers.get("Authorization");
  if (!auth) return json({ error: "נדרשת התחברות" }, 401);
  const url = Deno.env.get("SUPABASE_URL")!;
  const userClient = createClient(url, apiKey("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) return json({ error: "ההתחברות פגה — התחבר/י מחדש" }, 401);
  const admin = createClient(url, apiKey("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });
  return { user: { id: data.user.id }, userClient, admin };
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Postgres RAISE messages are already user-facing Hebrew; pass them through. */
export function dbError(e: { message?: string } | null): string {
  return (e?.message ?? "שגיאה לא צפויה").replace(/^.*?ERROR:\s*/, "");
}
