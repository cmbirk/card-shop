import { describe, it, expect, beforeAll } from 'vitest';
import type { Card } from '../../shared/types';
import { buildInventoryContext, getInventory } from './inventoryContext';

// Supabase is unconfigured in tests, so getInventory falls back to bundled data.
let cards: Card[];
let text: string;
beforeAll(async () => {
  cards = (await getInventory()).cards;
  text = buildInventoryContext(cards);
});

describe('shopkeeper inventory grounding', () => {
  it('mentions every card exactly once', () => {
    for (const card of cards) {
      const marker = `[${card.id}]`;
      const first = text.indexOf(marker);
      expect(first, `${card.id} missing from grounding`).toBeGreaterThanOrEqual(0);
      expect(text.indexOf(marker, first + 1), `${card.id} duplicated in grounding`).toBe(-1);
    }
  });

  it('includes exact sticker prices', () => {
    const forSale = cards.find((c) => c.status !== 'personal') ?? cards[0]; // personal cards carry no price
    expect(text).toContain(`$${(forSale.price / 100).toFixed(2)}`);
  });

  it('is comfortably inside the prompt budget', () => {
    // ~4 chars/token heuristic; grounding should stay well under ~20K tokens
    expect(text.length).toBeLessThan(80_000);
  });
});
