import { describe, expect, it } from 'vitest';
import type { Card } from '@shared/types';
import { cardEligible, isMismatch, suggestionsFor, type XimilarCheck } from './enrich';

const card = (over: Partial<Card> = {}): Card => ({
  id: 'x-1', sport: 'football', category: 'stars', playerName: 'Josh Jacobs', team: 'Raiders',
  year: 2019, setName: 'Contenders', cardNumber: '#106', rarity: 'common', price: 5500, seed: 1,
  lore: { blurb: '' }, images: { front: 'https://x.supabase.co/storage/v1/object/public/a.jpg' }, ...over,
});
const check = (over: Partial<XimilarCheck['result']> = {}): XimilarCheck => ({
  checkedAt: new Date().toISOString(),
  result: { outcome: 'match', distance: 0.33, card: { fullName: 'Josh Jacobs 2019 #106 Panini Contenders', name: 'Josh Jacobs', year: 2019, setName: 'Panini Contenders', cardNumber: '106', team: 'Oakland Raiders' }, ...over },
});

describe('ximilar enrichment', () => {
  it('eligibility = a real scan', () => {
    expect(cardEligible(card())).toBe(true);
    expect(cardEligible(card({ images: undefined }))).toBe(false);
  });
  it('mismatch klaxon fires only on a different player', () => {
    expect(isMismatch(card(), check())).toBe(false); // same player, fuzzy
    expect(isMismatch(card({ playerName: 'Peyton Manning' }), check())).toBe(true);
    expect(isMismatch(card({ playerName: 'josh  JACOBS' }), check())).toBe(false);
  });
  it('suggests only differing fields and applies into form state', () => {
    const s = suggestionsFor(card(), check());
    const fields = s.map((x) => x.field);
    expect(fields).toContain('setName'); // Contenders vs Panini Contenders
    expect(fields).toContain('team'); // Raiders vs Oakland Raiders
    expect(fields).not.toContain('cardNumber'); // '#106' vs '106' is cosmetic — normalizer eats it
    const applied = s.find((x) => x.field === 'setName')!.apply(card());
    expect(applied.setName).toBe('Panini Contenders');
  });
  it('no suggestions on ambiguous or mismatch-guarded results', () => {
    expect(suggestionsFor(card(), check({ outcome: 'ambiguous' }))).toEqual([]);
  });
});
