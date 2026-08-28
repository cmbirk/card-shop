import { describe, it, expect } from 'vitest';
import { assignCards } from './placement';
import { inventory } from './inventory';
import { shopLayout } from '@shared/data/shopLayout';

describe('placement', () => {
  it('is deterministic across calls', () => {
    const a = assignCards(inventory, shopLayout);
    const b = assignCards(inventory, shopLayout);
    expect(JSON.parse(JSON.stringify([...a]))).toEqual(JSON.parse(JSON.stringify([...b])));
  });

  it('never places a card in two fixtures', () => {
    const placed = assignCards(inventory, shopLayout);
    const seen = new Set<string>();
    for (const list of placed.values()) {
      for (const { card } of list) {
        expect(seen.has(card.id)).toBe(false);
        seen.add(card.id);
      }
    }
  });

  it('puts only featured cards in the display case, sorted by price desc', () => {
    const placed = assignCards(inventory, shopLayout);
    const caseCards = placed.get('case-premium')!;
    expect(caseCards.length).toBeGreaterThan(0);
    for (const { card } of caseCards) expect(card.featured).toBe(true);
    const prices = caseCards.map((p) => p.card.price);
    expect(prices).toEqual([...prices].sort((a, b) => b - a));
  });

  it('matches each shelf to its sport and excludes bin stock', () => {
    const placed = assignCards(inventory, shopLayout);
    for (const fixture of shopLayout.fixtures) {
      if (fixture.kind !== 'shelf') continue;
      for (const { card } of placed.get(fixture.id)!) {
        expect(card.sport).toBe(fixture.accepts.sport);
        expect(card.featured).toBeFalsy();
        expect(card.category.startsWith('budget-box')).toBe(false);
      }
    }
  });

  it('respects fixture capacity', () => {
    const placed = assignCards(inventory, shopLayout);
    for (const fixture of shopLayout.fixtures) {
      const list = placed.get(fixture.id);
      if (!list) continue;
      expect(list.length).toBeLessThanOrEqual(fixture.slots.rows * fixture.slots.cols);
    }
  });
});
