import { describe, expect, it } from 'vitest';
import { parseImport, exportCsv, parseCsv, CSV_TEMPLATE } from './adminCards';

describe('bulk import', () => {
  it('parses the CSV template into a card with dollars → cents and a generated id', () => {
    const { cards, errors } = parseImport(CSV_TEMPLATE);
    expect(errors).toEqual([]);
    expect(cards).toHaveLength(1);
    const c = cards[0];
    expect(c.playerName).toBe('Jane Example');
    expect(c.price).toBe(499);
    expect(c.costBasis).toBe(150);
    expect(c.isRookie).toBe(true);
    expect(c.id).toMatch(/^ba-[0-9a-f]{8}$/); // generated, sport-prefixed
    expect(c.lore.blurb).toContain('sample rookie');
  });

  it('reports row errors and duplicate ids without dropping good rows', () => {
    const csv = ['id,sport,playerName,year,price', 'ba-1,baseball,Good Row,2020,1.00', 'ba-2,tennis,Bad Sport,2020,1.00', 'ba-1,baseball,Same Id Again,2020,2.00'].join('\n');
    const { cards, errors } = parseImport(csv);
    expect(cards).toHaveLength(1);
    expect(errors.map((e) => e.row)).toEqual([2, 3]);
    expect(errors[0].message).toMatch(/sport/);
    expect(errors[1].message).toMatch(/duplicate/);
  });

  it('accepts app-shape JSON (cents) and round-trips through CSV export', () => {
    const json = JSON.stringify({ cards: [{ id: 'x-1', sport: 'hockey', category: 'stars', playerName: 'Jo', team: 'T', year: 2001, setName: 'S', cardNumber: '#1', rarity: 'rare', price: 1234, seed: 5, lore: { blurb: 'b, "quoted"' }, grade: { company: 'PSA', value: 9, label: 'PSA 9' } }] });
    const first = parseImport(json);
    expect(first.errors).toEqual([]);
    expect(first.cards[0].price).toBe(1234);
    const csv = exportCsv(first.cards);
    const again = parseImport(csv);
    expect(again.errors).toEqual([]);
    expect(again.cards[0].price).toBe(1234);
    expect(again.cards[0].grade?.label).toBe('PSA 9');
    expect(again.cards[0].lore.blurb).toBe('b, "quoted"');
  });

  it('handles quoted CSV cells with commas and newlines', () => {
    expect(parseCsv('a,"b,c","d\n e"\n1,2,3')).toEqual([['a', 'b,c', 'd\n e'], ['1', '2', '3']]);
  });
});
