import { create } from 'zustand';

// Maya's scripted lines (no API). <Maya/> shows the bubble + talk pose.
interface MayaState {
  line: string | null;
  lineId: number;
  spoken: boolean; // once per session
  say: (text: string) => void;
  clear: () => void;
}

export const useMayaStore = create<MayaState>((set) => ({
  line: null,
  lineId: 0,
  spoken: false,
  say: (text) => set((s) => ({ line: text, lineId: s.lineId + 1, spoken: true })),
  clear: () => set({ line: null }),
}));
