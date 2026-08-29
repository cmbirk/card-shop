import { create } from 'zustand';
import { useNavStore } from './navStore';
import { useBasketStore } from './basketStore';
import { useDialogueStore } from './dialogueStore';
import { sfx } from '../systems/sfx';

export type CheckoutPhase = 'browsing' | 'atCounter' | 'moodCheck' | 'reviewing' | 'paying' | 'receipt';

export interface Receipt {
  items: { id: string; name: string; price: number }[];
  total: number;
  orderId: string | null;
  testMode: boolean;
}

interface UIState {
  checkoutPhase: CheckoutPhase;
  soldIds: string[]; // purchased this session — stay off shelves
  lastReceipt: Receipt | null;
  tantrumCount: number; // increments when the customer storms out; the hold pile gets swept off the counter
  signInOpen: boolean; // guestbook sign-in panel
  adminOpen: boolean; // back-office admin panel
  setPhase: (p: CheckoutPhase) => void;
  /** Show the receipt for a paid order (or a dry-run one) and mark its cards gone for the session. */
  completePurchase: (receipt: Receipt) => void;
  dismissReceipt: () => void;
  tantrum: () => void;
  setSignInOpen: (v: boolean) => void;
  setAdminOpen: (v: boolean) => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  checkoutPhase: 'browsing',
  soldIds: [],
  lastReceipt: null,
  tantrumCount: 0,
  signInOpen: false,
  adminOpen: false,
  setSignInOpen: (v) => set({ signInOpen: v }),
  setAdminOpen: (v) => set({ adminOpen: v }),
  setPhase: (p) => {
    if (p === 'reviewing') useDialogueStore.getState().gesture$('nod'); // Chris nods you toward the register
    set({ checkoutPhase: p });
  },
  completePurchase: (receipt) => {
    useDialogueStore.getState().gesture$('checkout'); // rings it up
    set((s) => ({
      soldIds: [...s.soldIds, ...receipt.items.map((i) => i.id)],
      lastReceipt: receipt,
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
