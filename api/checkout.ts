import { requireUser } from './_lib/auth.js';
import { getStripe, serviceClient, json, publicOrigin, RESERVE_MINUTES, isTestKey, cancelPendingOrder } from './_lib/stripe.js';

export const maxDuration = 30;

interface CardRow {
  id: string;
  player_name: string;
  year: number;
  set_name: string;
  card_number: string;
  price: number;
  status: string;
}

/**
 * POST { ids } → { url } — creates a pending order, reserves the cards atomically, and opens a
 * hosted Stripe Checkout session priced from the DATABASE (never the client).
 */
export async function POST(req: Request): Promise<Response> {
  const auth = await requireUser(req);
  if (!auth.ok || !auth.userId) return json({ error: 'sign in to check out' }, 401);

  let ids: string[];
  try {
    const body = (await req.json()) as { ids?: unknown };
    ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === 'string').slice(0, 20) : [];
  } catch {
    return json({ error: 'bad request' }, 400);
  }
  if (ids.length === 0) return json({ error: 'nothing to ring up' }, 400);

  const db = serviceClient();
  // one live reservation set per customer: hitting Back from Stripe and trying again must work,
  // so abandon their earlier pending orders (expiring those Stripe sessions) before reserving
  const { data: stale } = await db.from('orders').select('id').eq('user_id', auth.userId).eq('status', 'pending');
  for (const o of (stale ?? []) as { id: string }[]) await cancelPendingOrder(o.id);

  const { data: rows, error } = await db.from('cards').select('id, player_name, year, set_name, card_number, price, status').in('id', ids);
  if (error) return json({ error: error.message }, 500);
  const cards = (rows ?? []) as CardRow[];
  const missing = ids.filter((id) => !cards.some((c) => c.id === id && (c.status === 'available' || c.status === 'reserved')));
  if (missing.length) return json({ error: 'some cards are gone', missing }, 409);

  const items = cards.map((c) => ({ id: c.id, playerName: c.player_name, year: c.year, setName: c.set_name, cardNumber: c.card_number, price: c.price }));
  const total = items.reduce((s, i) => s + i.price, 0);

  const { data: order, error: oErr } = await db
    .from('orders')
    .insert({ user_id: auth.userId, items, total, status: 'pending', test_mode: isTestKey() })
    .select('id')
    .single();
  if (oErr || !order) return json({ error: oErr?.message ?? 'could not open an order' }, 500);
  const orderId = (order as { id: string }).id;

  // atomic: only available (or lapsed-reserved) cards come back
  const { data: reserved, error: rErr } = await db.rpc('reserve_cards', { ids, order_id: orderId, ttl: `${RESERVE_MINUTES} minutes` });
  const got = new Set(((reserved ?? []) as string[]).map(String));
  const notReserved = ids.filter((id) => !got.has(id));
  if (rErr || notReserved.length) {
    await db.rpc('release_order', { order_id: orderId });
    await db.from('orders').delete().eq('id', orderId);
    return json({ error: rErr?.message ?? 'someone just grabbed one of those', missing: notReserved }, 409);
  }

  const origin = publicOrigin(req);
  try {
    const session = await getStripe().checkout.sessions.create({
      mode: 'payment',
      client_reference_id: orderId,
      metadata: { order_id: orderId },
      expires_at: Math.floor(Date.now() / 1000) + RESERVE_MINUTES * 60,
      line_items: items.map((i) => ({
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: i.price,
          product_data: { name: `${i.year} ${i.playerName}`, description: `${i.setName} ${i.cardNumber}`.trim(), metadata: { card_id: i.id } },
        },
      })),
      custom_text: {
        submit: { message: "Soft opening — GEM's register is in test mode. Nothing is charged and nothing ships. Thanks for trying it out!" },
      },
      success_url: `${origin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?checkout=cancel&order_id=${orderId}`,
    });
    await db.from('orders').update({ stripe_session_id: session.id }).eq('id', orderId);
    // the reservation must outlive the Stripe session, never the other way round
    if (session.expires_at) {
      await db.from('cards').update({ reserved_until: new Date(session.expires_at * 1000 + 5 * 60_000).toISOString() }).eq('reserved_order', orderId);
    }
    return json({ url: session.url, orderId });
  } catch (e) {
    await db.rpc('release_order', { order_id: orderId });
    await db.from('orders').update({ status: 'canceled' }).eq('id', orderId);
    console.error('[checkout]', e);
    return json({ error: 'the register jammed — try again in a moment' }, 502);
  }
}
