import { useState } from 'react';
import { useBasketStore, basketTotalCents, formatCents } from '../stores/basketStore';
import { inventoryById } from '../systems/inventory';
import { useNavStore } from '../stores/navStore';

export function BasketPanel() {
  const items = useBasketStore((s) => s.items);
  const remove = useBasketStore((s) => s.remove);
  const [open, setOpen] = useState(false);
  const total = basketTotalCents(items);

  if (items.length === 0) return null;
  return (
    <>
      {open && (
        <div className="basket-panel">
          <div className="basket-head">Chris is holding these up front</div>
          {items.map((id) => {
            const card = inventoryById.get(id)!;
            return (
              <div className="basket-row" key={id}>
                <span>
                  {card.playerName} <span style={{ opacity: 0.6 }}>’{String(card.year).slice(2)}</span>
                </span>
                <span>
                  {formatCents(card.price)} <button onClick={() => remove(id)} title="Put back">✕</button>
                </span>
              </div>
            );
          })}
          <div className="basket-total">
            <span>Total</span>
            <span>{formatCents(total)}</span>
          </div>
          <button className="btn" style={{ width: '100%', marginTop: 10 }} onClick={() => useNavStore.getState().goTo('counter')}>
            Walk to the counter →
          </button>
        </div>
      )}
      <button className="basket-pill" onClick={() => setOpen((o) => !o)}>
        🗂 On hold · {items.length} · {formatCents(total)}
      </button>
    </>
  );
}
