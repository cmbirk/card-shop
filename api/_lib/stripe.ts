import Stripe from 'stripe';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Stripe + service-role Supabase, server-only. Keys never reach the browser.

let stripe: Stripe | null = null;
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
  return (stripe ??= new Stripe(key));
}

let supa: SupabaseClient | null = null;
export function serviceClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase service role is not configured');
  return (supa ??= createClient(url, key, { auth: { persistSession: false } }));
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Where Stripe sends the customer back. PUBLIC_ORIGIN wins; else the caller's origin. */
export function publicOrigin(req: Request): string {
  const isHttp = (v: string | null | undefined): v is string => !!v && /^https?:\/\//.test(v);
  const env = process.env.PUBLIC_ORIGIN;
  if (isHttp(env)) return env;
  const origin = req.headers.get('origin');
  if (isHttp(origin)) return origin;
  return new URL(req.url).origin;
}

export const RESERVE_MINUTES = 30;

/**
 * Cancel a pending order safely: expire its Stripe session FIRST (so it can't be paid after we
 * release the cards), then release + mark canceled. If Stripe says the session already completed,
 * leave the order alone — the webhook will mark it paid. Returns what happened.
 */
export async function cancelPendingOrder(orderId: string, status: 'canceled' | 'expired' = 'canceled'): Promise<'canceled' | 'completed' | 'noop'> {
  const db = serviceClient();
  const { data: order } = await db.from('orders').select('id, status, stripe_session_id').eq('id', orderId).maybeSingle();
  const o = order as { id: string; status: string; stripe_session_id: string | null } | null;
  if (!o || o.status !== 'pending') return 'noop';
  if (o.stripe_session_id) {
    try {
      const s = await getStripe().checkout.sessions.retrieve(o.stripe_session_id);
      if (s.status === 'complete') return 'completed';
      if (s.status === 'open') await getStripe().checkout.sessions.expire(o.stripe_session_id);
    } catch (e) {
      console.warn('[checkout] could not expire session', o.stripe_session_id, (e as Error).message);
    }
  }
  const { data } = await db.from('orders').update({ status }).eq('id', orderId).eq('status', 'pending').select('id');
  if (data && data.length) await db.rpc('release_order', { order_id: orderId });
  return 'canceled';
}
export const isTestKey = () => (process.env.STRIPE_SECRET_KEY || '').startsWith('sk_test_');
