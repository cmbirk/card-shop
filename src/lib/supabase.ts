import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Browser Supabase client — uses the anon public key. This key is SAFE to ship
// to the browser; access is governed by Row Level Security, not by hiding it.
// Returns null when env isn't configured yet, so the app can fall back to the
// bundled mock inventory during setup.

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } }) : null;

export const supabaseConfigured = Boolean(supabase);
