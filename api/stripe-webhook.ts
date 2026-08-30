import type Stripe from 'stripe';
import { getStripe, serviceClient, json, cancelPendingOrder } from './_lib/stripe.js';
import { sendEmail } from './_lib/email.js';
import { SHOP_NAME } from '../shared/launch.js';

export const maxDuration = 30;

// Stripe → us. No JWT gate (Stripe isn't a user); the signature IS the auth. Marks orders paid
// and cards sold — the ONLY place `sold` is written. Idempotent: a replayed event finds the
// order already paid and no-ops.

export async function POST(req: Request): Promise<Response> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return json({ error: 'STRIPE_WEBHOOK_SECRET is not set' }, 500);
  const sig = req.headers.get('stripe-signature') ?? '';
  const raw = await req.text(); // raw body — signature is over the exact bytes
  let event: Stripe.Event;
  try {
    event = await getStripe().webhooks.constructEventAsync(raw, sig, secret);
  } catch (e) {
    return json({ error: `bad signature: ${(e as Error).message}` }, 400);
  }

  const db = serviceClient();
  const orderIdOf = (s: Stripe.Checkout.Session) => s.metadata?.order_id ?? s.client_reference_id ?? null;

  /**
   * Money is in: order paid, its reserved cards sold, consignment payouts created.
   * The pending→paid flip gates the sold-write; the payout section runs on RETRIES TOO
   * (idempotent upsert keyed card+order), so a crash mid-function can't silently
   * swallow a seller's payout. Emails go last, only on the first pass.
   */
  const markPaid = async (s: Stripe.Checkout.Session) => {
    const orderId = orderIdOf(s);
    if (!orderId) return;
    const { data } = await db
      .from('orders')
      .update({ status: 'paid', paid_at: new Date().toISOString(), stripe_payment_intent: typeof s.payment_intent === 'string' ? s.payment_intent : (s.payment_intent?.id ?? null), stripe_session_id: s.id })
      .eq('id', orderId)
      .eq('status', 'pending')
      .select('id, items');
    const flipped = !!(data && data.length);
    let items: { id: string; price: number }[];
    if (flipped) {
      items = ((data![0] as { items: { id: string; price: number }[] }).items ?? []);
      const { data: sold } = await db
        .from('cards')
        .update({ status: 'sold', reserved_until: null, reserved_order: null })
        .eq('reserved_order', orderId)
        .select('id');
      const n = sold?.length ?? 0;
      if (n !== items.length) console.error(`[stripe] order ${orderId} paid but only ${n}/${items.length} cards were still reserved — needs manual follow-up`);
      else console.log(`[stripe] order ${orderId} paid (${s.livemode ? 'LIVE' : 'test'})`);
    } else {
      // replay: only proceed (to re-attempt payouts) if the order really is paid
      const { data: existing } = await db.from('orders').select('status, items').eq('id', orderId).maybeSingle();
      if ((existing as { status: string } | null)?.status !== 'paid') return;
      items = ((existing as { items: { id: string; price: number }[] }).items ?? []);
    }

    // consignment payouts — batched, idempotent, reachable on retry
    const ids = items.map((i) => i.id);
    if (ids.length === 0) return;
    const { data: cardRows } = await db.from('cards').select('id, consignor_id, player_name, year').in('id', ids).not('consignor_id', 'is', null);
    const consigned = (cardRows ?? []) as { id: string; consignor_id: string; player_name: string; year: number }[];
    if (consigned.length === 0) return;
    const sellerIds = [...new Set(consigned.map((c) => c.consignor_id))];
    const [{ data: sellerRows }, { data: profRows }] = await Promise.all([
      db.from('sellers').select('user_id, split_pct, payout_handle, display_name').in('user_id', sellerIds),
      db.from('profiles').select('id, email').in('id', sellerIds),
    ]);
    const sellers = new Map((sellerRows ?? []).map((r) => [r.user_id as string, r as { split_pct: number; payout_handle: string | null; display_name: string | null }]));
    const emails = new Map((profRows ?? []).map((r) => [r.id as string, (r as { email: string | null }).email]));
    const priceOf = new Map(items.map((i) => [i.id, i.price]));
    const testMode = !s.livemode;
    const payoutRows = consigned.map((c) => {
      const seller = sellers.get(c.consignor_id);
      const split = seller?.split_pct ?? 85;
      const salePrice = priceOf.get(c.id) ?? 0;
      return {
        seller_id: c.consignor_id,
        seller_handle: seller?.payout_handle ?? seller?.display_name ?? null,
        card_id: c.id,
        order_id: orderId,
        sale_price: salePrice,
        split_pct: split,
        amount: Math.round((salePrice * split) / 100),
        test_mode: testMode,
        status: 'owed',
      };
    });
    await db.from('payouts').upsert(payoutRows as never[], { onConflict: 'card_id,order_id', ignoreDuplicates: true });
    await db.from('cards').update({ consign_status: 'sold' }).in('id', consigned.map((c) => c.id));
    if (flipped && !testMode) {
      for (const row of payoutRows) {
        const email = emails.get(row.seller_id);
        const card = consigned.find((c) => c.id === row.card_id)!;
        if (!email) continue;
        await sendEmail(
          email,
          `Your ${card.player_name} just sold at ${SHOP_NAME}!`,
          `Your ${card.year} ${card.player_name} sold for $${(row.sale_price / 100).toFixed(2)} — your cut is $${(row.amount / 100).toFixed(2)} (${row.split_pct}%).\nChris will send it your way soon; the ledger in My Consignments has the details.`,
        );
      }
    }
  };

  switch (event.type) {
    case 'checkout.session.completed': {
      const s = event.data.object;
      // delayed methods (bank debit etc.) complete with payment_status 'unpaid' — wait for async_payment_succeeded
      if (s.payment_status === 'paid') await markPaid(s);
      break;
    }
    case 'checkout.session.async_payment_succeeded':
      await markPaid(event.data.object);
      break;
    case 'checkout.session.async_payment_failed':
    case 'checkout.session.expired': {
      const orderId = orderIdOf(event.data.object);
      if (orderId) await cancelPendingOrder(orderId, 'expired');
      break;
    }
    default:
      break;
  }
  return json({ received: true });
}
