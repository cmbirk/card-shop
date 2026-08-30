import { requireUser } from './_lib/auth.js';
import { serviceClient, json, publicOrigin } from './_lib/stripe.js';
import { sendEmail } from './_lib/email.js';
import { SHOP_NAME, SHOP_FULL_NAME, SHOP_DOMAIN } from '../shared/launch.js';

export const maxDuration = 15;

// Invite someone who has never visited to sell through the shop. Creates the account up
// front (email_confirm: true, so Google sign-in on the same address links to the same user),
// attaches the sellers row, stamps profiles.invited_at, and emails a walk-right-in link.
// If the email already has an account, this degrades to today's toggle flow. Admin-only,
// SELLER invites only (admins are promoted after they've visited — never cold-invited),
// capped per day, no free-text fields (the display name is length-capped).

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DAILY_CAP = 10;

export async function POST(req: Request): Promise<Response> {
  const auth = await requireUser(req);
  if (!auth.ok || !auth.userId) return json({ error: 'sign in' }, 401);
  const db = serviceClient();
  const { data: adminRow } = await db.from('admins').select('user_id').eq('user_id', auth.userId).maybeSingle();
  if (!adminRow) return json({ error: 'not allowed' }, 403);

  let body: { email?: string; displayName?: string; splitPct?: number };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json({ error: 'bad request' }, 400);
  }
  const email = String(body.email ?? '').trim().toLowerCase();
  const displayName = String(body.displayName ?? '').trim().slice(0, 40);
  const splitPct = Math.max(0, Math.min(100, Math.round(Number(body.splitPct ?? 85) || 85)));
  if (!EMAIL_RE.test(email)) return json({ error: 'that does not look like an email address' }, 400);
  if (!displayName) return json({ error: 'a display name is required (what Chris calls them)' }, 400);

  const { count } = await db.from('profiles').select('id', { count: 'exact', head: true }).gte('invited_at', new Date(Date.now() - 86_400_000).toISOString());
  if ((count ?? 0) >= DAILY_CAP) return json({ error: `easy there — ${DAILY_CAP} invites per day is the cap` }, 429);

  // existing account? degrade to the toggle flow (attach seller role; no new account)
  const { data: existingProf } = await db.from('profiles').select('id').eq('email', email).maybeSingle();
  let userId = (existingProf as { id: string } | null)?.id ?? null;
  const existing = !!userId;

  const authHeaders = {
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
    'Content-Type': 'application/json',
  };
  const supaUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!;

  if (!userId) {
    const res = await fetch(`${supaUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ email, email_confirm: true, user_metadata: { full_name: displayName } }),
    });
    const created = (await res.json()) as { id?: string; user?: { id: string }; msg?: string; message?: string };
    userId = created.id ?? created.user?.id ?? null;
    if (!res.ok || !userId) return json({ error: created.msg ?? created.message ?? 'could not create the account' }, 502);
  }

  await db.from('sellers').upsert({ user_id: userId, split_pct: splitPct, display_name: displayName, invited_by: auth.userId } as never, { onConflict: 'user_id' });
  if (!existing) await db.from('profiles').update({ invited_at: new Date().toISOString(), display_name: displayName }).eq('id', userId);

  // a walk-right-in link (magic link → lands signed in at the front door)
  let link: string | null = null;
  try {
    const res = await fetch(`${supaUrl}/auth/v1/admin/generate_link`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ type: 'magiclink', email, redirect_to: `${publicOrigin(req)}/?invited=1` }),
    });
    const out = (await res.json()) as { action_link?: string };
    link = out.action_link ?? null;
  } catch {
    /* link is a convenience; the account works without it */
  }

  const text = `Chris here, from ${SHOP_FULL_NAME}.\n\nI set you up to sell cards through the shop — welcome aboard. This link walks you right in the front door, already signed in:\n\n${link ?? `https://${SHOP_DOMAIN}`}\n\n(If it's been a while and the link's gone stale, no problem: go to https://${SHOP_DOMAIN} and sign in with this email address.)\n\nOnce you're inside: the "📦 My consignments" button at the top right is your side of the counter — add a card with photos and your asking price, and I'll take it from there. You keep ${splitPct}% of every sale.\n\nSee you in the shop,\nChris`;
  const sent = await sendEmail(email, `${SHOP_NAME}: come sell some cards with me`, text);
  return json({ ok: true, existing, sent, link });
}
