import { create } from 'zustand';

// Loki's whereabouts. <Loki/> does the walking and calls arrived() at each leg's end.
// 'home' = hanging out by the counter; he greets the customer once per visit.
export type LokiPose = 'home' | 'greeting' | 'waiting' | 'returning';

export const LOKI_HOME: readonly [number, number] = [1.0, -2.35];
const LOKI_GREET: readonly [number, number] = [0.1, 0.3]; // in full view from the entry station, clear of the bins
const AROUND_BINS: readonly [number, number] = [1.8, -1.0]; // east of bin-b, clear of the case

interface LokiState {
  pose: LokiPose;
  path: [number, number][];
  legId: number; // bumps per leg so the walker resets its waypoint cursor
  greeted: boolean;
  greet: () => void;
  arrived: () => void;
  goHome: () => void;
}

export const useLokiStore = create<LokiState>((set, get) => ({
  pose: 'home',
  path: [],
  legId: 0,
  greeted: false,
  greet: () => {
    if (get().greeted) return;
    set((s) => ({ pose: 'greeting', path: [[...AROUND_BINS], [...LOKI_GREET]], legId: s.legId + 1, greeted: true }));
  },
  arrived: () => {
    const { pose } = get();
    if (pose === 'greeting') set({ pose: 'waiting', path: [] });
    else if (pose === 'returning') set({ pose: 'home', path: [] });
  },
  goHome: () => {
    if (get().pose !== 'waiting') return;
    set((s) => ({ pose: 'returning', path: [[...AROUND_BINS], [...LOKI_HOME]], legId: s.legId + 1 }));
  },
}));
