import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

// Who's visited. `profiles` is maintained by DB triggers on auth.users; admins may read all
// rows (RLS). Admin membership is the `admins` table — admins may insert/delete (RLS).

export interface Visitor {
  id: string;
  isSeller: boolean;
  splitPct: number | null;
  invitedAt: string | null;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  provider: string | null;
  firstSeen: string;
  lastSeen: string;
  visits: number;
  isAdmin: boolean;
}

export async function listUsers(): Promise<Visitor[]> {
  if (!supabase) return [];
  const [{ data: profiles, error }, { data: admins, error: aErr }, { data: sellers, error: sErr }] = await Promise.all([
    supabase.from('profiles').select('*').order('last_seen', { ascending: false }),
    supabase.from('admins').select('user_id'),
    supabase.from('sellers').select('user_id, split_pct'),
  ]);
  if (error) throw error;
  if (aErr) throw aErr;
  if (sErr) throw sErr;
  const adminIds = new Set((admins ?? []).map((a) => a.user_id as string));
  const sellerSplit = new Map((sellers ?? []).map((s) => [s.user_id as string, s.split_pct as number]));
  type Row = { id: string; email: string | null; display_name: string | null; avatar_url: string | null; provider: string | null; first_seen: string; last_seen: string; visits: number };
  return ((profiles ?? []) as Row[]).map((p) => ({
    id: p.id,
    email: p.email,
    displayName: p.display_name,
    avatarUrl: p.avatar_url,
    provider: p.provider,
    firstSeen: p.first_seen,
    lastSeen: p.last_seen,
    visits: p.visits,
    isAdmin: adminIds.has(p.id),
    isSeller: sellerSplit.has(p.id),
    splitPct: sellerSplit.get(p.id) ?? null,
    invitedAt: (p as { invited_at?: string | null }).invited_at ?? null,
  }));
}

/** Grant or revoke admin. You can't demote yourself (so the shop always has one admin left). */
export async function setAdmin(userId: string, on: boolean): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  const me = useAuthStore.getState().user?.id;
  if (!on && userId === me) throw new Error("You can't remove your own admin access.");
  const { error } = on
    ? await supabase.from('admins').insert({ user_id: userId } as never)
    : await supabase.from('admins').delete().eq('user_id', userId);
  if (error) throw error;
}

/** Invite (or retire) a consignment seller. The split is the SELLER'S keep, in percent. */
export async function setSeller(userId: string, on: boolean, splitPct = 85, displayName?: string): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = on
    ? await supabase
        .from('sellers')
        .upsert({ user_id: userId, split_pct: splitPct, invited_by: useAuthStore.getState().user?.id, display_name: displayName ?? null } as never, { onConflict: 'user_id' })
    : await supabase.from('sellers').delete().eq('user_id', userId);
  if (error) throw error;
}

export async function setSellerSplit(userId: string, splitPct: number): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase.from('sellers').update({ split_pct: splitPct } as never).eq('user_id', userId);
  if (error) throw error;
}
