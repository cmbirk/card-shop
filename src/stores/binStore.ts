import { create } from 'zustand';

// Bargain-bin riffle state: per bin, how many cards are flicked forward from
// the front (0 = closed stack; the "open" card is the one your thumb is on).
interface BinState {
  index: Record<string, number>;
  lastUsed: string | null; // for keyboard stepping
  set: (fixtureId: string, i: number, count: number) => void;
  step: (fixtureId: string, delta: number, count: number) => void;
}

const clamp = (i: number, count: number) => Math.max(0, Math.min(Math.max(count - 1, 0), i));

export const useBinStore = create<BinState>((set, get) => ({
  index: {},
  lastUsed: null,
  set: (id, i, count) => set((s) => ({ index: { ...s.index, [id]: clamp(i, count) }, lastUsed: id })),
  step: (id, delta, count) => get().set(id, (get().index[id] ?? 0) + delta, count),
}));
