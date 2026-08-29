import { useEffect } from 'react';
import { useInspectStore } from '../stores/inspectStore';
import { useDialogueStore } from '../stores/dialogueStore';
import { useShopkeeperStore } from '../stores/shopkeeperStore';
import { inventoryById } from '../systems/inventory';
import { isRefractor } from '../scene/cards/atlas';
import { formatCents } from '../stores/basketStore';

export function InspectHud() {
  const heldCardId = useInspectStore((s) => s.heldCardId);
  const mode = useInspectStore((s) => s.mode);
  const isStreaming = useDialogueStore((s) => s.isStreaming);
  const pose = useShopkeeperStore((s) => s.pose);
  const chrisOut = pose !== 'counter';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') useInspectStore.getState().putBack();
      if ((e.key === 'a' || e.key === 'A') && !(e.target as HTMLElement | null)?.closest('input, textarea, [contenteditable]')) {
        const { heldCardId, mode } = useInspectStore.getState();
        if (heldCardId && mode === 'inspecting') void useDialogueStore.getState().askAbout(heldCardId);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!heldCardId || mode !== 'inspecting') return null;
  const card = inventoryById.get(heldCardId)!;
  const personal = card.status === 'personal';

  return (
    <div className="inspect-hud">
      <h2>{card.playerName}</h2>
      <div className="sub">
        {card.year} {card.setName} {card.cardNumber} · {card.team}
        {card.grade ? ` · ${card.grade.label}` : ''}
        {card.foil ? ' · Foil' : ''}
      </div>
      <p className="blurb">{card.lore.blurb}</p>
      {personal ? <div className="price personal">From Chris's own collection · not for sale</div> : <div className="price">{formatCents(card.price)}</div>}
      <div className="inspect-actions">
        <button className="btn secondary" onClick={() => useInspectStore.getState().flip()}>
          Flip
        </button>
        <button
          className="btn secondary"
          disabled={isStreaming || chrisOut}
          title="Hold it up — Chris will come take a look"
          onClick={() => void useDialogueStore.getState().askAbout(card.id)}
        >
          {pose === 'walkingOut' ? 'Chris is coming…' : pose === 'visiting' ? 'Chris is here' : pose === 'walkingBack' ? 'Chris is heading back' : 'Ask Chris'}
        </button>
        {!personal && (
          <button className="btn" onClick={() => useInspectStore.getState().sendToBasket()}>
            Add to basket
          </button>
        )}
        <button className="btn secondary" onClick={() => useInspectStore.getState().putBack()}>
          Put back
        </button>
      </div>
      <div className="hint-line">{isRefractor(card) ? 'tilt it — it\'s a refractor · ' : 'drag to tilt · '}double-click or Flip to see the back · scroll to zoom · A to ask Chris · Esc to put back</div>
    </div>
  );
}
