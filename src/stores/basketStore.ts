import { create } from 'zustand';
import { inventoryById } from '../systems/inventory';

interface BasketState {
  items: string[]; // card ids, in add order
  add: (id: string) => void;
  remove: (id: string) => void;
  clear: () => void;
}

export const useBasketStore = create<BasketState>((set) => ({
  items: [],
  add: (id) => set((s) => (s.items.includes(id) ? s : { items: [...s.items, id] })),
  remove: (id) => set((s) => ({ items: s.items.filter((i) => i !== id) })),
  clear: () => set({ items: [] }),
}));

export function basketTotalCents(items: string[]): number {
  return items.reduce((sum, id) => sum + (inventoryById.get(id)?.price ?? 0), 0);
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
