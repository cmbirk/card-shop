import { create } from 'zustand';
import { shopLayout } from '@shared/data/shopLayout';

export type NavMode = 'station' | 'transit' | 'inspect-locked' | 'freewalk';

interface NavState {
  mode: NavMode;
  currentStation: string;
  targetStation: string | null;
  goTo: (id: string) => void;
  arrived: (id: string) => void;
  setMode: (mode: NavMode) => void;
}

export const useNavStore = create<NavState>((set, get) => ({
  mode: 'station',
  currentStation: shopLayout.entry,
  targetStation: null,
  goTo: (id) => {
    const { mode, currentStation } = get();
    if (mode === 'inspect-locked') return;
    if (id === currentStation && mode === 'station') return;
    set({ targetStation: id, mode: 'transit' });
  },
  arrived: (id) => set({ currentStation: id, targetStation: null, mode: 'station' }),
  setMode: (mode) => set({ mode }),
}));
