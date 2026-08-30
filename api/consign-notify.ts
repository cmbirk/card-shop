import { requireUser } from './_lib/auth.js';
import { serviceClient, json } from './_lib/stripe.js';
import { sendEmail } from './_lib/email.js';
import { SHOP_NAME, SHOP_DOMAIN } from '../shared/launch.js';

// Consignment notifications. The client fires this AFTER a successful write; the server
// re-reads the card and only mails when the stored state matches the claimed event, so a
// forged call can at worst re-announce the truth. `sold` is sent by the Stripe webhook.

type Event = 'submitted' | 'approved' | 'rejected' | 'received' | 'listed' | 'paid';
const EVENTS: Record<Event, { expect: string[]; toSeller: boolean }> = {
  submitted: { expect: ['submitted'], toSeller: false }, // → Chris
  approved: { expect: ['approved'], toSeller: true },
  rejected: { expect: ['rejected'], toSeller: true },
  received: { expect: ['received'], toSeller: true },
  listed: { expect: ['listed'], toSeller: true },
  paid: { expect: ['paid'], toSeller: true },
};

export async function POST(req: Request): Promise<Response> {
  const auth = await requireUser(req);
  if (!auth.ok || !auth.userId) return json({ error: 'sign in' }, 401);
  let body: { cardId?: string; event?: string; userId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json({ error: 'bad request' }, 400);
  }
  const db = serviceClient();

  // 'invited' is card-less: welcome a newly toggled seller with the next steps (admin-only,
  // and only if the sellers row actually exists — a forged call can't invent an invite)
  if (body.event === 'invited' && body.userId) {
    const { data: adminRow } = await db.from('admins').select('user_id').eq('user_id', auth.userId).maybeSingle();
    if (!adminRow) return json({ ok: true, sent: false });
    const { data: sellerRow } = await db.from('sellers').select('user_id, split_pct, display_name').eq('user_id', body.userId).maybeSingle();
    if (!sellerRow) return json({ ok: true, sent: false });
    const { data: prof } = await db.from('profiles').select('email').eq('id', body.userId).maybeSingle();
    const email = (prof as { email: string | null } | null)?.email;
    if (!email) return json({ ok: true, sent: false });
    const split = (sellerRow as { split_pct: number }).split_pct;
    const first = (sellerRow as { display_name: string | null }).display_name ?? 'there';
    const sent = await sendEmail(
      email,
      `You can now sell cards through ${SHOP_NAME}`,
      `Hey ${first} — Chris set you up as a consignment seller at ${SHOP_NAME}.

How it works:
1. Sign in at https://${SHOP_DOMAIN} and hit the "📦 My consignments" button (top right).
2. "+ Consign a card": fill in the card, add front/back photos, and set your asking price (Chris sets the final sticker).
3. Chris reviews it — you'll get an email when he approves, with the address to ship it to.
4. Once it arrives and checks out, it goes in the On Consignment case. When it sells, your cut (${split}% of the sale) shows in your earnings ledger and Chris pays you out.

While you're in there, add your return address (bottom of the panel) so cards can find their way back to you if needed. Questions? Just ask Chris in the shop — he knows the whole routine.`,
    );
    return json({ ok: true, sent });
  }

  const spec = EVENTS[body.event as Event];
  if (!spec || !body.cardId) return json({ error: 'bad request' }, 400);

  const { data: card } = await db
    .from('cards')
    .select('id, player_name, year, set_name, card_number, price, asking_price, consign_note, consignor_id, consign_status')
    .eq('id', body.cardId)
    .maybeSingle();
  const c = card as { id: string; player_name: string; year: number; set_name: string; card_number: string; price: number; asking_price: number | null; consign_note: string | null; consignor_id: string | null; consign_status: string | null } | null;
  if (!c || !c.consignor_id || !spec.expect.includes(c.consign_status ?? '')) return json({ ok: true, sent: false });

  // caller must be an admin, or (for `submitted`) the consignor themself
  const { data: adminRow } = await db.from('admins').select('user_id').eq('user_id', auth.userId).maybeSingle();
  const isAdmin = !!adminRow;
  if (!isAdmin && !(body.event === 'submitted' && auth.userId === c.consignor_id)) return json({ ok: true, sent: false });

  const name = `${c.year} ${c.player_name} ${c.set_name} ${c.card_number}`.trim();
  const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  let to: string[] = [];
  let subject = '';
  let text = '';
  if (spec.toSeller) {
    const { data: prof } = await db.from('profiles').select('email').eq('id', c.consignor_id).maybeSingle();
    const email = (prof as { email: string | null } | null)?.email;
    if (email) to = [email];
  } else {
    // → every admin, from the DB (no ADMIN_EMAIL env)
    const { data: adminRows } = await db.from('admins').select('user_id');
    const adminIds = (adminRows ?? []).map((a) => a.user_id as string);
    const { data: adminProfs } = await db.from('profiles').select('email').in('id', adminIds);
    to = (adminProfs ?? []).map((p) => (p as { email: string | null }).email).filter((e): e is string => !!e);
  }

  /** Where the seller ships an approved card: the approving admin's address, else any admin's. */
  const intakeAddress = async (): Promise<string> => {
    const { data: mine } = await db.from('profiles').select('ship_address').eq('id', auth.userId!).maybeSingle();
    const own = (mine as { ship_address: string | null } | null)?.ship_address;
    if (own?.trim()) return own;
    const { data: adminRows } = await db.from('admins').select('user_id').order('user_id');
    const adminIds = (adminRows ?? []).map((a) => a.user_id as string);
    const { data: profs } = await db.from('profiles').select('id, ship_address').in('id', adminIds).order('id');
    const any = (profs ?? []).map((p) => (p as { ship_address: string | null }).ship_address).find((a) => a?.trim());
    return any ?? 'Ask Chris for the shipping address.';
  };
  switch (body.event as Event) {
    case 'submitted':
      subject = `New consignment to review: ${name}`;
      text = `A seller submitted ${name} (asking ${c.asking_price != null ? dollars(c.asking_price) : '—'}).\n\nReview it in the Back Office → Consign tab.\nhttps://${SHOP_DOMAIN}`;
      break;
    case 'approved':
      subject = `${SHOP_NAME} approved your ${c.player_name} — time to ship it`;
      text = `Good news — Chris approved your ${name} and it's listed at ${dollars(c.price)} once it arrives.\n\nShip it to:\n${await intakeAddress()}\n\nPack it in a sleeve + toploader (naturally) inside a bubble mailer.`;
      break;
    case 'rejected':
      subject = `About your ${c.player_name} consignment`;
      text = `Chris passed on ${name} this time.${c.consign_note ? `\n\nHis note: "${c.consign_note}"` : ''}\n\nYou can edit and resubmit it from My Consignments on ${SHOP_DOMAIN}.`;
      break;
    case 'received':
      subject = `Your ${c.player_name} arrived safe at ${SHOP_NAME}`;
      text = `Chris has ${name} in hand — it'll hit the On Consignment case shortly.`;
      break;
    case 'listed':
      subject = `Your ${c.player_name} is on the shelf at ${SHOP_NAME}`;
      text = `${name} is now in the On Consignment case at ${dollars(c.price)}.\n\nCome visit it: https://${SHOP_DOMAIN}`;
      break;
    case 'paid':
      subject = `${SHOP_NAME} paid out your ${c.player_name}`;
      text = `Your cut for ${name} has been sent — check My Consignments for the details. Pleasure doing business!`;
      break;
  }
  let sent = false;
  for (const addr of to) sent = (await sendEmail(addr, subject, text)) || sent;
  return json({ ok: true, sent });
}
