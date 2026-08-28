import { useEffect } from 'react';
import { useInspectStore } from '../stores/inspectStore';
import { inventoryById } from '../systems/inventory';
import { formatCents } from '../stores/basketStore';

export function InspectHud() {
  const heldCardId = useInspectStore((s) => s.heldCardId);
  const mode = useInspectStore((s) => s.mode);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') useInspectStore.getState().putBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!heldCardId || mode !== 'inspecting') return null;
  const card = inventoryById.get(heldCardId)!;

  return (
    <div className="inspect-hud">
      <h2>{card.playerName}</h2>
      <div className="sub">
        {card.year} {card.setName} {card.cardNumber} · {card.team}
        {card.grade ? ` · ${card.grade.label}` : ''}
        {card.foil ? ' · Foil' : ''}
      </div>
      <p className="blurb">{card.lore.blurb}</p>
      <div className="price">{formatCents(card.price)}</div>
      <div className="inspect-actions">
        <button className="btn secondary" onClick={() => useInspectStore.getState().flip()}>
          Flip
        </button>
        <button className="btn" onClick={() => useInspectStore.getState().sendToBasket()}>
          Add to basket
        </button>
        <button className="btn secondary" onClick={() => useInspectStore.getState().putBack()}>
          Put back
        </button>
      </div>
      <div className="hint-line">drag to tilt · double-click or Flip to see the back · scroll to zoom · Esc to put back</div>
    </div>
  );
}
