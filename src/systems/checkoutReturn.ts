import { useNavStore } from '../stores/navStore';
import { useUIStore } from '../stores/uiStore';
import { useDialogueStore } from '../stores/dialogueStore';
import { useBasketStore } from '../stores/basketStore';
import { useAuthStore } from '../stores/authStore';
import { fetchOrder, cancelOrder } from '../api/checkout';
import { reloadInventory } from './inventory';
import { SHOP_NAME } from '@shared/launch';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Wait for the persisted session to be restored so the order fetch carries a bearer. */
async function authReady() {
  for (let i = 0; i < 40 && !useAuthStore.getState().ready; i++) await sleep(100);
}

/**
 * Stripe sends the customer back to `/?checkout=success&session_id=…` or `/?checkout=cancel&order_id=…`.
 * Put them at the counter, and either hand over the receipt (order row = truth; the webhook may land a
 * beat after the redirect, so poll briefly) or put the pile back.
 */
export async function resumeCheckout(): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  let kind = params.get('checkout');
  let sessionId = params.get('session_id');
  let orderId = params.get('order_id');
  // a refresh mid-resume (or a slow session restore) shouldn't lose the receipt: park the params
  try {
    if (kind) sessionStorage.setItem('gem.checkoutReturn', JSON.stringify({ kind, sessionId, orderId }));
    else {
      const saved = sessionStorage.getItem('gem.checkoutReturn');
      if (saved) ({ kind, sessionId, orderId } = JSON.parse(saved) as { kind: string; sessionId: string | null; orderId: string | null });
    }
  } catch {
    /* private mode */
  }
  if (!kind) return;
  history.replaceState(null, '', window.location.pathname);
  const done = () => {
    try {
      sessionStorage.removeItem('gem.checkoutReturn');
    } catch {
      /* private mode */
    }
  };
  await authReady();
  if (!useAuthStore.getState().session) return; // not signed in yet — params stay parked for the next load
  const nav = useNavStore.getState();
  const ui = useUIStore.getState();
  const dlg = useDialogueStore.getState();
  nav.goTo('counter');

  if (kind === 'success' && sessionId) {
    let order = null;
    for (let i = 0; i < 8; i++) {
      order = await fetchOrder({ sessionId });
      if (order?.status === 'paid') break;
      await sleep(1000);
    }
    if (order && (order.status === 'paid' || order.status === 'pending')) {
      useBasketStore.getState().clear();
      ui.completePurchase({
        items: order.items.map((i) => ({ id: i.id, name: `${i.playerName} ’${String(i.year).slice(2)} ${i.setName}`.trim(), price: i.price })),
        total: order.total,
        orderId: order.id,
        testMode: order.test_mode,
      });
      dlg.say(
        order.test_mode
          ? "Bagged and tagged — well, test-bagged. In real life these'd be sleeved and heading home with you. Thanks for trying the register!"
          : `Bagged and tagged. Thanks for shopping ${SHOP_NAME} — I'll get these sleeved and on their way.`,
      );
      await reloadInventory(); // sold cards leave the shelves
      done();
    } else {
      dlg.gesture$('shrug');
      dlg.say("Hm — the register hasn't confirmed that one yet. Your cards are still on hold; give it a minute and ask me again.");
      ui.setPhase('atCounter');
    }
    return;
  }

  if (kind === 'cancel') {
    if (orderId) await cancelOrder(orderId);
    dlg.gesture$('shrug');
    dlg.say("No worries — I'll keep 'em on hold a bit.");
    ui.setPhase('atCounter');
    await reloadInventory();
    done();
  }
}
