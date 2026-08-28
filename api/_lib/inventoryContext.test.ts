import { describe, it, expect } from 'vitest';
import { buildInventoryContext, cards } from './inventoryContext';

describe('shopkeeper inventory grounding', () => {
  it('mentions every card exactly once', () => {
    const text = buildInventoryContext();
    for (const card of cards) {
      const marker = `[${card.id}]`;
      const first = text.indexOf(marker);
      expect(first, `${card.id} missing from grounding`).toBeGreaterThanOrEqual(0);
      expect(text.indexOf(marker, first + 1), `${card.id} duplicated in grounding`).toBe(-1);
    }
  });

  it('includes exact sticker prices', () => {
    const text = buildInventoryContext();
    const sample = cards[0];
    expect(text).toContain(`$${(sample.price / 100).toFixed(2)}`);
  });

  it('is comfortably inside the prompt budget', () => {
    // ~4 chars/token heuristic; grounding should stay well under ~20K tokens
    expect(buildInventoryContext().length).toBeLessThan(80_000);
  });
});
