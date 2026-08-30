import type Stripe from 'stripe';
import { getStripe, serviceClient, json, cancelPendingOrder } from './_lib/stripe.js';
import { sendEmail } from './_lib/email.js';
import { SHOP_NAME } from '../shared/launch.js';

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

  /** Money is in: order paid, its reserved cards sold. Idempotent on the pending guard. */
  const markPaid = async (s: Stripe.Checkout.Session) => {
    const orderId = orderIdOf(s);
    if (!orderId) return;
    const { data } = await db
      .from('orders')
      .update({ status: 'paid', paid_at: new Date().toISOString(), stripe_payment_intent: typeof s.payment_intent === 'string' ? s.payment_intent : (s.payment_intent?.id ?? null), stripe_session_id: s.id })
      .eq('id', orderId)
      .eq('status', 'pending')
      .select('id, items');
    if (!data || !data.length) return;
    const expected = ((data[0] as { items: unknown[] }).items ?? []).length;
    const { data: sold } = await db
      .from('cards')
      .update({ status: 'sold', reserved_until: null, reserved_order: null })
      .eq('reserved_order', orderId)
      .select('id, consignor_id, consign_status, player_name, year');
    const n = sold?.length ?? 0;
    // consigned cards: create the payout obligation + tell the seller
    const items = ((data[0] as { items: { id: string; price: number }[] }).items ?? []);
    const priceOf = new Map(items.map((i) => [i.id, i.price]));
    const consigned = ((sold ?? []) as { id: string; consignor_id: string | null; consign_status: string | null; player_name: string; year: number }[]).filter((c) => c.consignor_id);
    for (const c of consigned) {
      const { data: sellerRow } = await db.from('sellers').select('split_pct, payout_handle').eq('user_id', c.consignor_id!).maybeSingle();
      const { data: prof } = await db.from('profiles').select('email, display_name').eq('id', c.consignor_id!).maybeSingle();
      const split = (sellerRow as { split_pct: number } | null)?.split_pct ?? 85;
      const salePrice = priceOf.get(c.id) ?? 0;
      const testMode = !s.livemode;
      await db.from('payouts').upsert(
        {
          seller_id: c.consignor_id,
          seller_handle: (sellerRow as { payout_handle: string | null } | null)?.payout_handle ?? (prof as { display_name: string | null } | null)?.display_name ?? null,
          card_id: c.id,
          order_id: orderId,
          sale_price: salePrice,
          split_pct: split,
          amount: Math.round((salePrice * split) / 100),
          test_mode: testMode,
          status: 'owed',
        } as never,
        { onConflict: 'card_id,order_id', ignoreDuplicates: true },
      );
      await db.from('cards').update({ consign_status: 'sold' }).eq('id', c.id);
      const email = (prof as { email: string | null } | null)?.email;
      if (email && !testMode) {
        await sendEmail(
          email,
          `Your ${c.player_name} just sold at ${SHOP_NAME}!`,
          `Your ${c.year} ${c.player_name} sold for $${(salePrice / 100).toFixed(2)} — your cut is $${((salePrice * split) / 10000 * 100).toFixed(2)} (${split}%).\nChris will send it your way soon; the ledger in My Consignments has the details.`,
        );
      }
    }
    if (n !== expected) console.error(`[stripe] order ${orderId} paid but only ${n}/${expected} cards were still reserved — needs manual follow-up`);
    else console.log(`[stripe] order ${orderId} paid (${s.livemode ? 'LIVE' : 'test'})`);
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
