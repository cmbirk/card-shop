import { useBasketStore, basketTotalCents, formatCents } from '../stores/basketStore';
import { useUIStore } from '../stores/uiStore';
import { inventoryById } from '../systems/inventory';
import { sfx } from '../systems/sfx';

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
          <h2>Ring it up?</h2>
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
            <button
              className="btn"
              onClick={() => {
                sfx.checkout();
                useUIStore.getState().completePurchase(items, total);
                useBasketStore.getState().clear();
              }}
            >
              Confirm purchase
            </button>
          </div>
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
            <div className="r-center">★ GEM ★</div>
            <div className="r-center" style={{ marginBottom: 8 }}>CARDS · COLLECTIBLES</div>
            {receipt.items.map((id) => {
              const c = inventoryById.get(id)!;
              return (
                <div className="r-row" key={id}>
                  <span>{c.playerName}</span>
                  <span>{formatCents(c.price)}</span>
                </div>
              );
            })}
            <div className="r-row r-total">
              <span>TOTAL</span>
              <span>{formatCents(receipt.total)}</span>
            </div>
            <div className="r-center">Come again soon — Mel</div>
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
