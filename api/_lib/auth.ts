import { createClient } from '@supabase/supabase-js';

// Verifies the Supabase access token on incoming requests so anonymous users
// can't reach paid endpoints (e.g. the LLM shopkeeper). When Supabase isn't
// configured (local dev before setup), auth is skipped so nothing is bricked.

const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const configured = Boolean(URL && ANON);

/** Returns the authenticated user id, or null. Skips when Supabase is unconfigured. */
export async function requireUser(req: Request): Promise<{ ok: true; userId: string | null } | { ok: false }> {
  if (!configured) return { ok: true, userId: null }; // ungated fallback during setup
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return { ok: false };
  try {
    const client = createClient(URL!, ANON!, { auth: { persistSession: false } });
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) return { ok: false };
    return { ok: true, userId: data.user.id };
  } catch {
    return { ok: false };
  }
}
