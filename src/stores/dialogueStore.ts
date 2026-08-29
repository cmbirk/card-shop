import { create } from 'zustand';
import type { ChatMessage } from '@shared/types';
import { streamChat } from '../api/chat';
import { useBasketStore } from './basketStore';

const HISTORY_CAP = 40; // ~20 turns

export type MelGesture = 'wave' | 'nod' | 'shrug' | 'checkout';

interface DialogueState {
  messages: ChatMessage[];
  streamingText: string;
  isStreaming: boolean;
  isOpen: boolean;
  /** One-shot body-language cue for the 3D Mel (consumed by <Shopkeeper/>). */
  gesture: MelGesture | null;
  gestureId: number;
  /** Fire a one-shot gesture (nod, shrug, wave, checkout). Idle/talk are automatic. */
  gesture$: (g: MelGesture) => void;
  /** Local canned greeting on first counter visit — works with no API at all. */
  greet: () => void;
  /** Append a scripted line from Mel (shows as his in-world bubble when chat is closed). */
  say: (text: string) => void;
  open: () => void;
  close: () => void;
  send: (text: string) => Promise<void>;
}

let abort: AbortController | null = null;

export const useDialogueStore = create<DialogueState>((set, get) => ({
  messages: [],
  streamingText: '',
  isStreaming: false,
  isOpen: false,
  gesture: null,
  gestureId: 0,
  gesture$: (g) => set((s) => ({ gesture: g, gestureId: s.gestureId + 1 })),
  greet: () => {
    if (get().messages.length > 0) return;
    set((s) => ({
      gesture: 'wave',
      gestureId: s.gestureId + 1,
      messages: [
        {
          role: 'assistant' as const,
          content:
            "Hey there, welcome to GEM! Name's Mel. Browse all you like — holler if you want to know what something's worth, or bring your basket up when you're ready.",
        },
      ],
    }));
  },
  say: (text) => set((s) => ({ messages: [...s.messages, { role: 'assistant' as const, content: text }] })),
  open: () => set({ isOpen: true }),
  close: () => {
    abort?.abort();
    set({ isOpen: false, isStreaming: false, streamingText: '' });
  },
  send: async (text) => {
    const trimmed = text.trim();
    if (!trimmed || get().isStreaming) return;
    const messages: ChatMessage[] = [...get().messages, { role: 'user' as const, content: trimmed }].slice(-HISTORY_CAP);
    set({ messages, isStreaming: true, streamingText: '' });
    abort = new AbortController();
    try {
      const final = await streamChat(
        { messages, basket: useBasketStore.getState().items },
        (chunk) => set((s) => ({ streamingText: s.streamingText + chunk })),
        abort.signal,
      );
      set((s) => ({
        messages: [...s.messages, { role: 'assistant', content: final }],
        streamingText: '',
        isStreaming: false,
      }));
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      set((s) => ({
        messages: [
          ...s.messages,
          { role: 'assistant', content: "*(Mel is wrestling with the register — the intercom's out. Try me again in a minute.)*" },
        ],
        streamingText: '',
        isStreaming: false,
      }));
    }
  },
}));
