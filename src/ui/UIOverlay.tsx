import { useEffect, useRef } from 'react';
import { useNavStore } from '../stores/navStore';
import { useUIStore } from '../stores/uiStore';
import { useDialogueStore } from '../stores/dialogueStore';
import { useInspectStore } from '../stores/inspectStore';
import { BasketPanel } from './BasketPanel';
import { InspectHud } from './InspectHud';
import { ChatWindow } from './ChatWindow';
import { CheckoutModal } from './CheckoutModal';

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
      dlg.greet(); // Mel says hello in-world (speech bubble) as you walk in
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
  return (
    <div className="overlay">
      <NavEffects />
      <div className="hud">
        <h1>GEM</h1>
        <p>
          {outside
            ? 'Click the front door to step inside'
            : 'Click a glowing spot to walk over · click a card to pick it up'}
        </p>
      </div>
      {showStepBack && (
        <button className="btn step-back" onClick={() => useNavStore.getState().goTo('center')}>
          ↩ Step back
        </button>
      )}
      <BasketPanel />
      <InspectHud />
      <ChatWindow />
      <CheckoutModal />
    </div>
  );
}
