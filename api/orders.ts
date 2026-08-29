import { requireUser } from './_lib/auth.js';
import { serviceClient, json, cancelPendingOrder } from './_lib/stripe.js';

/** GET ?session_id= | ?order_id= → the caller's order (for the receipt after Stripe sends them back). */
export async function GET(req: Request): Promise<Response> {
  const auth = await requireUser(req);
  if (!auth.ok || !auth.userId) return json({ error: 'sign in' }, 401);
  const url = new URL(req.url);
  const sessionId = url.searchParams.get('session_id');
  const orderId = url.searchParams.get('order_id');
  if (!sessionId && !orderId) return json({ error: 'session_id or order_id required' }, 400);
  const db = serviceClient();
  let q = db.from('orders').select('id, status, items, total, test_mode, created_at, paid_at').eq('user_id', auth.userId);
  q = sessionId ? q.eq('stripe_session_id', sessionId) : q.eq('id', orderId!);
  const { data, error } = await q.maybeSingle();
  if (error) return json({ error: error.message }, 500);
  if (!data) return json({ error: 'not found' }, 404);
  return json({ order: data });
}

/** POST { order_id, action: 'cancel' } — the customer backed out of Stripe; put the cards back. */
export async function POST(req: Request): Promise<Response> {
  const auth = await requireUser(req);
  if (!auth.ok || !auth.userId) return json({ error: 'sign in' }, 401);
  let body: { order_id?: string; action?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json({ error: 'bad request' }, 400);
  }
  if (body.action !== 'cancel' || !body.order_id) return json({ error: 'bad request' }, 400);
  const db = serviceClient();
  const { data: own } = await db.from('orders').select('id').eq('id', body.order_id).eq('user_id', auth.userId).maybeSingle();
  if (!own) return json({ ok: true, released: false }); // not yours / not found → silent no-op
  const result = await cancelPendingOrder(body.order_id); // expires the Stripe session first
  return json({ ok: true, released: result === 'canceled', completed: result === 'completed' });
}
