import { describe, it, expect } from 'vitest';
import { basketTotalCents, formatCents } from './basketStore';
import { inventory } from '../systems/inventory';

describe('basket money math', () => {
  it('totals integer cents exactly', () => {
    const ids = inventory.slice(0, 5).map((c) => c.id);
    const expected = inventory.slice(0, 5).reduce((s, c) => s + c.price, 0);
    expect(basketTotalCents(ids)).toBe(expected);
    expect(Number.isInteger(basketTotalCents(ids))).toBe(true);
  });

  it('ignores unknown ids', () => {
    expect(basketTotalCents(['nope'])).toBe(0);
  });

  it('formats cents as dollars', () => {
    expect(formatCents(599)).toBe('$5.99');
    expect(formatCents(120000)).toBe('$1200.00');
    expect(formatCents(0)).toBe('$0.00');
  });
});
