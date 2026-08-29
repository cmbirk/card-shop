import { useBasketStore, basketTotalCents, formatCents } from '../stores/basketStore';
import { useUIStore } from '../stores/uiStore';
import { inventoryById } from '../systems/inventory';
import { sfx } from '../systems/sfx';
import { SOFT_OPENING } from '@shared/launch';
import { useDialogueStore } from '../stores/dialogueStore';
import { startCheckout, CheckoutConflict } from '../api/checkout';

/** Chris takes the pile to the register: reserve + open Stripe, or explain what went wrong. */
async function ringItUp(items: string[]) {
  const ui = useUIStore.getState();
  const dlg = useDialogueStore.getState();
  sfx.checkout();
  dlg.gesture$('nod');
  dlg.say('Let me run that up front — one sec.');
  ui.setPhase('paying');
  try {
    const { url } = await startCheckout(items);
    window.location.assign(url);
  } catch (e) {
    if (e instanceof CheckoutConflict) {
      const names = e.missing.map((id) => inventoryById.get(id)?.playerName ?? 'one of those').join(', ');
      e.missing.forEach((id) => useBasketStore.getState().remove(id));
      dlg.gesture$('shrug');
      dlg.say(`Ah — ${names} just got snapped up by somebody else. Sorry about that; the rest are still yours.`);
    } else {
      dlg.gesture$('shrug');
      dlg.say(`The register's being fussy (${(e as Error).message}). Give me a second and try again.`);
    }
    ui.setPhase('atCounter');
  }
}

const MOODS: { label: string; positive: boolean }[] = [
  { label: 'Excited to get these home and show them off!', positive: true },
  { label: 'This is going to break the bank…', positive: false },
  { label: 'Straight into the display case with these beauties.', positive: true },
  { label: 'What am I even doing — rent is due Friday!', positive: false },
];

export function CheckoutModal() {
  const phase = useUIStore((s) => s.checkoutPhase);
  const receipt = useUIStore((s) => s.lastReceipt);
  const items = useBasketStore((s) => s.items);

  if (phase === 'moodCheck') {
    return (
      <div className="modal-backdrop">
        <div className="modal">
          <h2>How are we feeling about today's haul?</h2>
          <div className="mood-options">
            {MOODS.map((m) => (
              <button
                key={m.label}
                className="btn mood-btn"
                onClick={() => (m.positive ? useUIStore.getState().setPhase('reviewing') : useUIStore.getState().tantrum())}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'reviewing') {
    const total = basketTotalCents(items);
    return (
      <div className="modal-backdrop">
        <div className="modal">
          <h2>{SOFT_OPENING ? "Here's what you've got on hold" : "Ring up what's on hold?"}</h2>
          {SOFT_OPENING && (
            <p className="soft-open-note">
              Soft opening: the register's in <b>test mode</b>. Use card <code>4242 4242 4242 4242</code>, any future date, any CVC — you won't be
              charged and nothing ships. Enjoy the ride.
            </p>
          )}
          <div className="receipt">
            {items.map((id) => {
              const c = inventoryById.get(id)!;
              return (
                <div className="r-row" key={id}>
                  <span>
                    {c.playerName} ’{String(c.year).slice(2)} {c.setName}
                  </span>
                  <span>{formatCents(c.price)}</span>
                </div>
              );
            })}
            <div className="r-row r-total">
              <span>TOTAL</span>
              <span>{formatCents(total)}</span>
            </div>
          </div>
          <div className="modal-actions">
            <button className="btn secondary" onClick={() => useUIStore.getState().setPhase('atCounter')}>
              Keep browsing
            </button>
            <button className="btn" onClick={() => void ringItUp(items)}>
              {SOFT_OPENING ? 'Try the register' : 'Ring it up'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'paying') {
    return (
      <div className="modal-backdrop">
        <div className="modal paying">
          <div className="speech-dots">
            <span />
            <span />
            <span />
          </div>
          <p>Chris is at the register…</p>
        </div>
      </div>
    );
  }

  if (phase === 'receipt' && receipt) {
    return (
      <div className="modal-backdrop">
        <div className="modal">
          <h2>Thanks for stopping by!</h2>
          <div className="receipt">
            {receipt.testMode && <div className="r-stamp">TEST · NOT A SALE</div>}
            <div className="r-center">★ GEM ★</div>
            <div className="r-center" style={{ marginBottom: 8 }}>CARDS · COLLECTIBLES</div>
            {receipt.items.map((i) => (
              <div className="r-row" key={i.id}>
                <span>{i.name}</span>
                <span>{formatCents(i.price)}</span>
              </div>
            ))}
            <div className="r-row r-total">
              <span>TOTAL</span>
              <span>{formatCents(receipt.total)}</span>
            </div>
            {receipt.orderId && <div className="r-center r-order">order {receipt.orderId.slice(0, 8)}</div>}
            <div className="r-center">Come again soon — Chris</div>
          </div>
          <div className="modal-actions">
            <button className="btn" onClick={() => useUIStore.getState().dismissReceipt()}>
              Back to the shop
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
