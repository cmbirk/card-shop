import { create } from 'zustand';
import { useNavStore } from './navStore';
import { useBasketStore } from './basketStore';
import { useDialogueStore } from './dialogueStore';
import { sfx } from '../systems/sfx';

export type CheckoutPhase = 'browsing' | 'atCounter' | 'moodCheck' | 'reviewing' | 'receipt';

interface UIState {
  checkoutPhase: CheckoutPhase;
  soldIds: string[]; // purchased this session — stay off shelves
  lastReceipt: { items: string[]; total: number } | null;
  tantrumCount: number; // increments when the customer storms out; Basket3D reacts
  setPhase: (p: CheckoutPhase) => void;
  completePurchase: (items: string[], total: number) => void;
  dismissReceipt: () => void;
  tantrum: () => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  checkoutPhase: 'browsing',
  soldIds: [],
  lastReceipt: null,
  tantrumCount: 0,
  setPhase: (p) => {
    if (p === 'reviewing') useDialogueStore.getState().gesture$('nod'); // Chris nods you toward the register
    set({ checkoutPhase: p });
  },
  completePurchase: (items, total) => {
    useDialogueStore.getState().gesture$('checkout'); // rings it up
    set((s) => ({
      soldIds: [...s.soldIds, ...items],
      lastReceipt: { items, total },
      checkoutPhase: 'receipt',
    }));
  },
  dismissReceipt: () => set({ checkoutPhase: 'atCounter', lastReceipt: null }),
  tantrum: () => {
    set({ checkoutPhase: 'browsing', tantrumCount: get().tantrumCount + 1 });
    sfx.tantrum();
    const dlg = useDialogueStore.getState();
    dlg.gesture$('shrug'); // oh well
    dlg.say("Whoa hey — easy on the merchandise, friend! …No harm done, I'll restock 'em. Come back when the wallet's feeling braver.");
    setTimeout(() => useNavStore.getState().goTo('outside'), 1400);
    setTimeout(() => useBasketStore.getState().clear(), 2800);
  },
}));
