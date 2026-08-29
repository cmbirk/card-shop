import type Stripe from 'stripe';
import { getStripe, serviceClient, json, cancelPendingOrder } from './_lib/stripe.js';

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
    const { data: sold } = await db.from('cards').update({ status: 'sold', reserved_until: null, reserved_order: null }).eq('reserved_order', orderId).select('id');
    const n = sold?.length ?? 0;
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
