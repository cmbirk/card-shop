import { create } from 'zustand';
import { logEvent } from '../systems/analytics';
import { shopLayout } from '@shared/data/shopLayout';
import { useAuthStore } from './authStore';

export type NavMode = 'station' | 'transit' | 'inspect-locked' | 'freewalk';

interface NavState {
  mode: NavMode;
  currentStation: string;
  targetStation: string | null;
  goTo: (id: string) => void;
  arrived: (id: string) => void;
  setMode: (mode: NavMode) => void;
  /** Freewalk only: keep currentStation pointing at wherever the walker is nearest (context stays honest). */
  setCurrentSilently: (id: string) => void;
}

export const useNavStore = create<NavState>((set, get) => ({
  mode: 'station',
  currentStation: shopLayout.entry,
  targetStation: null,
  goTo: (id) => {
    const { mode, currentStation } = get();
    if (mode === 'inspect-locked') return;
    if (id === currentStation && mode === 'station') return;
    if (id === 'office' && !useAuthStore.getState().isAdmin) return; // staff only — the door gate
    set({ targetStation: id, mode: 'transit' });
  },
  arrived: (id) => {
    if (id !== 'outside') {
      if (get().currentStation === 'outside') logEvent('enter_shop');
      logEvent('visit_station', { station: id, via: 'glide' });
    }
    set({ currentStation: id, targetStation: null, mode: 'station' });
  },
  setMode: (mode) => set({ mode }),
  setCurrentSilently: (id) => {
    logEvent('visit_station', { station: id, via: 'walk' });
    set({ currentStation: id });
  },
}));
