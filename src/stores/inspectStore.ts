import { create } from 'zustand';
import { useNavStore } from './navStore';
import { inventoryById } from '../systems/inventory';

export type InspectMode = 'idle' | 'pickingUp' | 'inspecting' | 'returning' | 'toBasket';

interface InspectState {
  heldCardId: string | null;
  mode: InspectMode;
  pickUp: (id: string) => void;
  /** animation layer reports a discrete transition finished */
  transitionDone: () => void;
  putBack: () => void;
  sendToBasket: () => void;
  requestFlip: number; // increment to request a flip; animation layer consumes
  flip: () => void;
}

export const useInspectStore = create<InspectState>((set, get) => ({
  heldCardId: null,
  mode: 'idle',
  requestFlip: 0,
  pickUp: (id) => {
    const nav = useNavStore.getState();
    if (get().mode !== 'idle' || nav.mode === 'transit') return;
    if (!inventoryById.has(id)) return; // stale id (card removed since load) — don't crash the scene
    nav.setMode('inspect-locked');
    set({ heldCardId: id, mode: 'pickingUp' });
  },
  transitionDone: () => {
    const { mode } = get();
    if (mode === 'pickingUp') set({ mode: 'inspecting' });
    else if (mode === 'returning' || mode === 'toBasket') {
      set({ heldCardId: null, mode: 'idle' });
      useNavStore.getState().setMode('station');
    }
  },
  putBack: () => {
    if (get().mode === 'inspecting') set({ mode: 'returning' });
  },
  sendToBasket: () => {
    const id = get().heldCardId;
    if (id && inventoryById.get(id)?.status === 'personal') return; // Chris's own — not for sale
    if (get().mode === 'inspecting') set({ mode: 'toBasket' });
  },
  flip: () => set((s) => ({ requestFlip: s.requestFlip + 1 })),
}));
