import { useEffect, useRef } from 'react';
import { useNavStore } from '../stores/navStore';
import { useUIStore } from '../stores/uiStore';
import { useDialogueStore } from '../stores/dialogueStore';
import { useInspectStore } from '../stores/inspectStore';
import { useMayaStore } from '../stores/mayaStore';
import { inventory } from '../systems/inventory';
import { BasketPanel } from './BasketPanel';
import { InspectHud } from './InspectHud';
import { ChatWindow } from './ChatWindow';
import { CheckoutModal } from './CheckoutModal';
import { SignInPanel } from './SignInPanel';
import { AdminPanel } from './AdminPanel';
import { ConsignPanel } from './ConsignPanel';
import { useAuthStore } from '../stores/authStore';
import { useBasketStore } from '../stores/basketStore';
import { SOFT_OPENING, SHOP_NAME, SHOP_FULL_NAME } from '@shared/launch';

/** Maya's one canned line about the top slab in the case — no API, once per session. */
function mayaCaseLine(): string | null {
  const top = inventory
    .filter((c) => c.featured && (c.status ?? 'available') === 'available')
    .sort((a, b) => b.price - a.price)[0];
  if (!top) return null;
  const what = top.grade?.label ?? top.parallel ?? top.setName;
  const detail = top.lore.funFact ?? top.lore.blurb;
  return `That ${top.year} ${top.playerName} ${what} is the one everybody asks about — ${detail} Chris won't budge on the price, but I'd try.`;
}

/** Non-visual: wires station arrival to checkout phase + shopkeeper dialogue. */
function NavEffects() {
  const currentStation = useNavStore((s) => s.currentStation);
  const mode = useNavStore((s) => s.mode);
  const prevStation = useRef(currentStation);

  // Esc steps back to the middle of the store (when not inspecting a card)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const nav = useNavStore.getState();
      if (useInspectStore.getState().mode !== 'idle') return; // InspectHud owns Esc there
      if (nav.mode === 'station' && nav.currentStation !== 'outside' && nav.currentStation !== 'center') {
        nav.goTo('center');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (mode !== 'station') return;
    const prev = prevStation.current;
    prevStation.current = currentStation;
    const ui = useUIStore.getState();
    const dlg = useDialogueStore.getState();
    if (currentStation === 'entry' && prev === 'outside') {
      dlg.greet(); // Chris says hello in-world (speech bubble) as you walk in
    }
    if (currentStation === 'case' && !useMayaStore.getState().spoken) {
      const line = mayaCaseLine();
      if (line) useMayaStore.getState().say(line);
    }
    if (currentStation === 'counter') {
      if (ui.checkoutPhase === 'browsing') ui.setPhase('atCounter');
      dlg.greet();
      dlg.open();
    } else {
      if (ui.checkoutPhase === 'atCounter') ui.setPhase('browsing');
      if (dlg.isOpen) dlg.close();
    }
  }, [currentStation, mode]);

  return null;
}

export function UIOverlay() {
  const outside = useNavStore((s) => s.currentStation === 'outside');
  const station = useNavStore((s) => s.currentStation);
  const mode = useNavStore((s) => s.mode);
  const showStepBack = mode === 'station' && station !== 'outside' && station !== 'center' && station !== 'entry';
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const isSeller = useAuthStore((s) => s.isSeller);
  const holding = useBasketStore((s) => s.items.length > 0);
  return (
    <div className="overlay">
      <NavEffects />
      <div className="hud">
        <h1>
          <img className="hud-logo" src="/tlc-logo-full-dark.svg" alt={`${SHOP_NAME} — ${SHOP_FULL_NAME}`} width={500} height={210} />
        </h1>
        <p>
          {outside
            ? 'Click the front door to step inside'
            : station === 'counter' && holding
              ? 'Your picks are on the counter · click one to put it back · talk to Chris to check out'
              : station === 'bins'
              ? 'Scroll over a bin to thumb through it · click the card that\'s up to pick it up'
              : 'Click a glowing spot — or just walk with WASD/arrows · click a card to pick it up · scroll to lean back'}
        </p>
      </div>
      {SOFT_OPENING && <div className="soft-open-ribbon">Opening soon · browse away, nothing's for sale yet</div>}
      {isSeller && (
        <button className={`btn secondary consign-btn${isAdmin ? ' with-office' : ''}`} onClick={() => useUIStore.getState().setConsignOpen(true)}>
          📦 My consignments
        </button>
      )}
      {isAdmin && (
        <button className="btn secondary back-office-btn" onClick={() => useUIStore.getState().setAdminOpen(true)}>
          🗝 Back office
        </button>
      )}
      {showStepBack && (
        <button className="btn step-back" onClick={() => useNavStore.getState().goTo('center')}>
          ↩ Step back
        </button>
      )}
      <BasketPanel />
      <InspectHud />
      <ChatWindow />
      <CheckoutModal />
      <SignInPanel />
      <AdminPanel />
      <ConsignPanel />
    </div>
  );
}
