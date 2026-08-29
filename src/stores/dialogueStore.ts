import { create } from 'zustand';
import type { ChatMessage, ChatRequest } from '@shared/types';
import { shopLayout, ROOM, ANNEX, OFFICE } from '@shared/data/shopLayout';
import { streamChat } from '../api/chat';
import { useBasketStore } from './basketStore';
import { useInspectStore } from './inspectStore';
import { useNavStore } from './navStore';
import { useShopkeeperStore } from './shopkeeperStore';
import { bubbleHoldSeconds } from '../feel';
import { useAuthStore } from './authStore';
import { SOFT_OPENING, SHOP_NAME } from '@shared/launch';

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
  send: (text: string, context?: ChatRequest['context']) => Promise<void>;
  /** Hold a card up: Chris walks over, gives his take on it in-world, walks back. */
  askAbout: (cardId: string) => Promise<void>;
}

/** Where Chris stands to talk to a customer at `stationId`: off to the viewer's right, ~2 m away
 *  (a full figure fits the 55° fov there), facing the camera. The camera turns to him on arrival. */
function greetSpot(stationId: string): { spot: [number, number]; facing: number } | null {
  const st = shopLayout.stations.find((s) => s.id === stationId);
  if (!st) return null;
  const [cx, , cz] = st.position;
  const [tx, , tz] = st.target;
  const len = Math.hypot(tx - cx, tz - cz) || 1;
  const fx = (tx - cx) / len;
  const fz = (tz - cz) / len;
  // viewer's right = forward rotated -90° about Y
  const rx = -fz;
  const rz = fx;
  const spot: [number, number] = [cx + rx * 1.6 + fx * 1.0, cz + rz * 1.6 + fz * 1.0];
  // keep him inside whichever room the customer is standing in
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  if (cx < ANNEX.xMax) {
    spot[0] = clamp(spot[0], ANNEX.xMin + 0.5, ANNEX.xMax - 0.5);
    spot[1] = clamp(spot[1], ANNEX.zMin + 1.0, ANNEX.zMax - 0.5); // clear of the corner plinth
  } else if (cz < OFFICE.zMax) {
    spot[0] = clamp(spot[0], OFFICE.xMin + 0.5, OFFICE.xMax - 0.5);
    spot[1] = clamp(spot[1], OFFICE.zMin + 0.8, OFFICE.zMax - 0.5);
  } else {
    spot[0] = clamp(spot[0], -ROOM.width / 2 + 0.5, ROOM.width / 2 - 0.5);
    spot[1] = clamp(spot[1], -ROOM.depth / 2 + 0.5, ROOM.depth / 2 - 0.5);
  }
  const facing = Math.atan2(cx - spot[0], cz - spot[1]); // model faces +Z at rest
  return { spot, facing };
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
    // first-timers during the soft opening hear that we're not ringing up sales yet
    let welcomed = false;
    try {
      welcomed = localStorage.getItem('gem.welcomed') === '1';
    } catch {
      /* private mode */
    }
    const newHere = useAuthStore.getState().firstVisit && !welcomed;
    const content =
      SOFT_OPENING && newHere
        ? `Hey there, welcome to ${SHOP_NAME}! Name's Chris. Full disclosure — we're still getting the shop ready to open, so the register's in test mode: nothing's charged and nothing ships. But browse all you like, pick things up, ask me about anything, and if you want to try the register, I'll walk you through it.`
        : `Hey there, welcome to ${SHOP_NAME}! Name's Chris. Browse all you like — holler if you want to know what something's worth, or hand me anything you like and I'll hold it up front for you.`;
    try {
      localStorage.setItem('gem.welcomed', '1');
    } catch {
      /* private mode */
    }
    set((s) => ({
      gesture: 'wave',
      gestureId: s.gestureId + 1,
      messages: [{ role: 'assistant' as const, content }],
    }));
  },
  say: (text) => set((s) => ({ messages: [...s.messages, { role: 'assistant' as const, content: text }] })),
  open: () => set({ isOpen: true }),
  close: () => {
    abort?.abort();
    set({ isOpen: false, isStreaming: false, streamingText: '' });
  },
  askAbout: async (cardId) => {
    if (get().isStreaming) return;
    if (useInspectStore.getState().heldCardId !== cardId || useInspectStore.getState().mode !== 'inspecting') return;
    const station = useNavStore.getState().currentStation;
    const keeper = useShopkeeperStore.getState();
    if (keeper.pose !== 'counter') return;

    // still holding this card at this station? (put back / walked off → Chris turns around)
    const stillRelevant = () =>
      useInspectStore.getState().heldCardId === cardId &&
      useInspectStore.getState().mode === 'inspecting' &&
      useNavStore.getState().currentStation === station;

    const dest = station === 'counter' ? null : greetSpot(station);
    if (dest) {
      keeper.visit(dest.spot, dest.facing);
      const arrived = await new Promise<boolean>((resolve) => {
        let done = false;
        const finish = (ok: boolean) => {
          if (done) return;
          done = true;
          unsubKeeper();
          unsubInspect();
          unsubNav();
          clearTimeout(timer);
          resolve(ok);
        };
        const unsubKeeper = useShopkeeperStore.subscribe((s) => {
          if (s.pose === 'visiting') finish(true);
          else if (s.pose === 'counter' || s.pose === 'walkingBack') finish(false);
        });
        const cancel = () => {
          if (!stillRelevant()) {
            useShopkeeperStore.getState().leave();
            finish(false);
          }
        };
        const unsubInspect = useInspectStore.subscribe(cancel);
        const unsubNav = useNavStore.subscribe(cancel);
        // safety net: if <Shopkeeper/> never reports arrival (model failed to load), don't wedge the HUD
        const timer = setTimeout(() => {
          useShopkeeperStore.getState().leave();
          finish(false);
        }, 20000);
      });
      if (!arrived) return;
    }

    // customer may walk off while he's talking — cut him off and send him home
    const unsubMid = dest
      ? useInspectStore.subscribe(() => {
          if (!stillRelevant()) {
            abort?.abort();
            useShopkeeperStore.getState().leave();
          }
        })
      : () => {};
    try {
      await get().send('Hey Chris, what do you think of this one?', { station, holding: cardId });
    } finally {
      unsubMid();
    }

    if (dest && useShopkeeperStore.getState().pose === 'visiting') {
      const last = get().messages[get().messages.length - 1];
      const hold = bubbleHoldSeconds(last?.role === 'assistant' ? last.content : '');
      setTimeout(() => useShopkeeperStore.getState().leave(), hold * 1000);
    }
  },

  send: async (text, context) => {
    const trimmed = text.trim();
    if (!trimmed || get().isStreaming) return;
    const messages: ChatMessage[] = [...get().messages, { role: 'user' as const, content: trimmed }].slice(-HISTORY_CAP);
    set({ messages, isStreaming: true, streamingText: '' });
    abort = new AbortController();
    try {
      const final = await streamChat(
        { messages, basket: useBasketStore.getState().items, ...(context ? { context } : {}) },
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
          { role: 'assistant', content: "*(Chris is wrestling with the register — the intercom's out. Try me again in a minute.)*" },
        ],
        streamingText: '',
        isStreaming: false,
      }));
    }
  },
}));
