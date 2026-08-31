import { create } from 'zustand';
import { FEEL, bubbleHoldSeconds } from '../feel';

// One pinned speech surface for every character line (the collapsed ChatWindow renders it;
// the scene shows "…" dots over whoever holds the floor). One-deep queue: Chris preempts,
// Maya waits out his hold. Maya's lines NEVER enter dialogueStore.messages — that's the LLM
// history sent to /api/chat, and her words would pollute Chris's context.

export type Speaker = 'chris' | 'maya';
export interface Speech {
  speaker: Speaker;
  text: string;
  streaming?: boolean;
}

interface SpeechState {
  current: Speech | null;
  pending: Speech | null;
  /** Chris's live stream — updates the card without touching hold timers. */
  stream: (text: string) => void;
  /** A finished line; holds for reading time, then yields to `pending`. */
  say: (speaker: Speaker, text: string) => void;
  dismiss: () => void;
}

let timer: ReturnType<typeof setTimeout> | null = null;
const clearTimer = () => {
  if (timer) clearTimeout(timer);
  timer = null;
};

export const useSpeechStore = create<SpeechState>((set, get) => {
  const holdThen = (speech: Speech) => {
    clearTimer();
    const secs = speech.speaker === 'maya' ? FEEL.mayaLineHold : bubbleHoldSeconds(speech.text);
    timer = setTimeout(() => {
      const next = get().pending;
      if (next) {
        set({ current: next, pending: null });
        holdThen(next);
      } else {
        set({ current: null });
      }
    }, secs * 1000);
  };
  return {
    current: null,
    pending: null,
    stream: (text) => {
      clearTimer();
      set({ current: { speaker: 'chris', text, streaming: true } });
    },
    say: (speaker, text) => {
      const cur = get().current;
      if (speaker === 'maya' && cur && cur.speaker === 'chris') {
        set({ pending: { speaker, text } }); // she'll wait — it's his shop
        return;
      }
      const speech = { speaker, text };
      set({ current: speech, pending: speaker === 'chris' ? get().pending : null });
      holdThen(speech);
    },
    dismiss: () => {
      clearTimer();
      set({ current: null, pending: null });
    },
  };
});
