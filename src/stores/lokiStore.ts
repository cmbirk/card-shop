import { create } from 'zustand';
import { planRoute } from '@shared/data/obstacles';

// Loki's whereabouts. <Loki/> does the walking and calls arrived() at each leg's end.
// 'home' = hanging out by the counter; he greets the customer once per visit.
export type LokiPose = 'home' | 'greeting' | 'waiting' | 'returning';

export const LOKI_HOME: readonly [number, number] = [4.7, 3.0]; // by the south end of the bar, customer side
export const LOKI_GREET: readonly [number, number] = [2.4, 5.0]; // in full view from the entry station

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
    set((s) => ({ pose: 'greeting', path: planRoute(LOKI_HOME, LOKI_GREET), legId: s.legId + 1, greeted: true }));
  },
  arrived: () => {
    const { pose } = get();
    if (pose === 'greeting') set({ pose: 'waiting', path: [] });
    else if (pose === 'returning') set({ pose: 'home', path: [] });
  },
  goHome: () => {
    if (get().pose !== 'waiting') return;
    set((s) => ({ pose: 'returning', path: planRoute(LOKI_GREET, LOKI_HOME), legId: s.legId + 1 }));
  },
}));
