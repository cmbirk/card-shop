import type { Card, InventoryFile } from '@shared/types';
import { rowToCard, type CardRow } from '@shared/cardMapping';
import inventoryJson from '@shared/data/inventory.json';
import realCardsJson from '@shared/data/realCards.json';
import { create } from 'zustand';
import { supabase } from '../lib/supabase';

// Live inventory. Populated by loadInventory() before the shop renders:
// from Supabase when configured, otherwise the bundled mock data (so the app
// works during setup). The scene consumes these as Card[] / Map — the arrays
// are mutated in place so existing imports stay valid.

/** The mock + real cards bundled at build time — fallback and test fixture. */
export const bundledInventory: Card[] = [
  ...(inventoryJson as InventoryFile).cards,
  ...(realCardsJson as unknown as InventoryFile).cards,
];

export const inventory: Card[] = [];
export const inventoryById: Map<string, Card> = new Map();

function setInventory(cards: Card[]) {
  inventory.length = 0;
  inventory.push(...cards);
  inventoryById.clear();
  for (const c of cards) inventoryById.set(c.id, c);
}

let loaded: Promise<void> | null = null;

/** Bumps every time the live inventory is (re)loaded; scene code keys placement on it. */
export const useInventoryVersion = create<{ version: number; bump: () => void }>((set) => ({
  version: 0,
  bump: () => set((s) => ({ version: s.version + 1 })),
}));

/** Re-read from Supabase (after an admin edit) and re-place cards on the shelves. */
export async function reloadInventory(): Promise<void> {
  loaded = null;
  await loadInventory();
  // the card-art atlas was built from the old inventory; rebuild it before the shelves re-place
  const { invalidateCardVisuals } = await import('../scene/cards/atlas');
  invalidateCardVisuals();
  useInventoryVersion.getState().bump();
}

/** Load inventory once (Supabase → fallback bundled). Idempotent. */
export function loadInventory(): Promise<void> {
  if (loaded) return loaded;
  loaded = (async () => {
    if (supabase) {
      try {
        // customer-safe view: omits cost_basis / acquisition columns
        const { data, error } = await supabase.from('cards_public').select('*');
        if (error) throw error;
        if (data && data.length) {
          setInventory((data as CardRow[]).map(rowToCard));
          return;
        }
      } catch (err) {
        console.warn('[inventory] Supabase read failed, using bundled data:', (err as Error).message);
      }
    }
    setInventory(bundledInventory);
  })();
  return loaded;
}
