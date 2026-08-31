import type { Card } from '@shared/types';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import type { Identified } from '../../api/identify';

// "Check with Ximilar" (admin): identify a card's stored scan, cache the result on the row
// (cards.ximilar jsonb — never public), and turn it into per-field suggestions. Prices are
// context only, never auto-written. See docs/SPEC-consignment.md conventions + the scout spec.

export interface XimilarCheck {
  checkedAt: string;
  result: Identified;
  confirmedAs?: string; // admin picked an alternative on an ambiguous match
}

const CACHE_DAYS = 30;

export function cardEligible(card: Card): boolean {
  return !!card.images?.front; // a real scan is the eligibility flag — procedural cards would match garbage
}

export function cachedCheck(card: Card): XimilarCheck | null {
  const x = (card as { ximilar?: XimilarCheck | null }).ximilar ?? null;
  if (!x?.checkedAt) return null;
  return Date.now() - new Date(x.checkedAt).getTime() < CACHE_DAYS * 86_400_000 ? x : null;
}

/** Identify the card's stored front scan (cached ≤30 days unless forced). ~10 Ximilar credits on a miss. */
export async function checkWithXimilar(card: Card, force = false): Promise<XimilarCheck> {
  if (!cardEligible(card)) throw new Error('This card has no real scan — nothing to check.');
  if (!force) {
    const hit = cachedCheck(card);
    if (hit) return hit;
  }
  const token = useAuthStore.getState().session?.access_token;
  const res = await fetch('/api/identify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ url: card.images!.front, slab: !!card.grade }),
  });
  const body = (await res.json().catch(() => ({}))) as { result?: Identified; error?: string };
  if (!res.ok || !body.result) throw new Error(body.error ?? `check failed (${res.status})`);
  const check: XimilarCheck = { checkedAt: new Date().toISOString(), result: body.result };
  if (supabase) await supabase.from('cards').update({ ximilar: check } as never).eq('id', card.id);
  return check;
}

export async function confirmAlternative(cardId: string, check: XimilarCheck, name: string): Promise<XimilarCheck> {
  const next = { ...check, confirmedAs: name };
  if (supabase) await supabase.from('cards').update({ ximilar: next } as never).eq('id', cardId);
  return next;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** The klaxon: Ximilar thinks this is a different player than the listing says. */
export function isMismatch(card: Card, check: XimilarCheck): boolean {
  const theirs = check.result.card?.name ?? check.result.card?.fullName;
  if (!theirs || !card.playerName) return false;
  const a = norm(card.playerName);
  const b = norm(theirs);
  return !(b.includes(a) || a.includes(b));
}

export interface FieldSuggestion {
  field: 'playerName' | 'year' | 'setName' | 'cardNumber' | 'team' | 'sport';
  label: string;
  ours: string;
  theirs: string;
  apply: (c: Card) => Card;
}

/** Per-field diffs between the listing and Ximilar's match (only fields that differ). */
export function suggestionsFor(card: Card, check: XimilarCheck): FieldSuggestion[] {
  const m = check.result.card;
  if (!m || check.result.outcome !== 'match') return [];
  const out: FieldSuggestion[] = [];
  const push = (field: FieldSuggestion['field'], label: string, ours: string, theirs: string | undefined, apply: (c: Card) => Card) => {
    if (theirs && norm(ours || '') !== norm(theirs)) out.push({ field, label, ours: ours || '—', theirs, apply });
  };
  push('playerName', 'Player', card.playerName, m.name, (c) => ({ ...c, playerName: m.name! }));
  push('year', 'Year', String(card.year || ''), m.year ? String(m.year) : undefined, (c) => ({ ...c, year: m.year! }));
  push('setName', 'Set', card.setName, m.setName, (c) => ({ ...c, setName: m.setName! }));
  push('cardNumber', 'Card #', card.cardNumber, m.cardNumber, (c) => ({ ...c, cardNumber: m.cardNumber! }));
  push('team', 'Team', card.team, m.team, (c) => ({ ...c, team: m.team! }));
  const sport = check.result.detectedSport;
  if (sport && sport !== card.sport) out.push({ field: 'sport', label: 'Sport', ours: card.sport, theirs: sport, apply: (c) => ({ ...c, sport: sport as Card['sport'] }) });
  return out;
}
