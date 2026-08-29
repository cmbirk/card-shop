// Relative imports only — keeps the Vercel function bundler happy without alias config.
import { createClient } from '@supabase/supabase-js';
import type { Card, InventoryFile } from '../../shared/types';
import { showcase } from '../../shared/data/showcase.js';
import { rowToCard, type CardRow } from '../../shared/cardMapping.js';
import inventoryJson from '../../shared/data/inventory.json' with { type: 'json' };
import realCardsJson from '../../shared/data/realCards.json' with { type: 'json' };

const bundled: Card[] = [
  ...(inventoryJson as InventoryFile).cards,
  ...(realCardsJson as unknown as InventoryFile).cards,
];

// Live inventory for the shopkeeper's grounding: fetched from Supabase (service
// role, server-side) with a short TTL cache so freshly-added cards show up
// without a redeploy; falls back to bundled data when Supabase isn't configured.
const SUPA_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supa = SUPA_URL && SUPA_KEY ? createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } }) : null;

const TTL_MS = 60_000;
let cache: { at: number; cards: Card[]; byId: Map<string, Card> } | null = null;

export async function getInventory(): Promise<{ cards: Card[]; cardsById: Map<string, Card> }> {
  if (cache && Date.now() - cache.at < TTL_MS) return { cards: cache.cards, cardsById: cache.byId };
  let cards = bundled;
  if (supa) {
    try {
      // deterministic order — unordered SELECT can shuffle rows between fetches,
      // changing the system-prompt bytes and silently invalidating the prompt cache
      const { data, error } = await supa.from('cards').select('*').neq('status', 'sold').order('id');
      if (error) throw error;
      if (data && data.length) cards = (data as CardRow[]).map(rowToCard);
    } catch (err) {
      console.warn('[grounding] Supabase read failed, using bundled data:', (err as Error).message);
    }
  }
  const byId = new Map(cards.map((c) => [c.id, c]));
  cache = { at: Date.now(), cards, byId };
  return { cards, cardsById: byId };
}

const SHELF_LABEL: Record<string, string> = {
  baseball: 'the Baseball shelf (right wall, near the entrance)',
  basketball: 'the Basketball shelf (left wall, near the entrance)',
  football: 'the Football shelf (left wall, middle)',
  hockey: 'the Hockey shelf (left wall, toward the counter)',
  tcg: 'the Trading Card Games shelf (right wall, middle)',
};

function where(card: Card): string {
  if (card.status === 'personal') return "the Colts Room (through the doorway left of the hockey shelf) — Chris's PERSONAL collection, NOT FOR SALE";
  if (card.featured) return 'the glass display case (near the counter)';
  if (card.category.startsWith('budget-box')) return 'the bargain bins (middle of the shop)';
  return SHELF_LABEL[card.sport];
}

export function priceStr(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function cardLine(c: Card): string {
  const cert = c.grade?.certNumber ? ` (cert #${c.grade.certNumber})` : '';
  const grade = c.grade ? `, ${c.grade.label}${cert}` : c.foil ? ', foil' : '';
  const note = c.lore.investmentNote ? ` (${c.lore.investmentNote})` : '';
  const fact = c.lore.funFact ? ` ${c.lore.funFact}` : '';
  if (c.status === 'personal') return `- [${c.id}] ${c.playerName}, ${c.year} ${c.setName} ${c.cardNumber}, ${c.team}${grade} — not for sale. ${c.lore.blurb}${fact}`;
  return `- [${c.id}] ${c.playerName}, ${c.year} ${c.setName} ${c.cardNumber}, ${c.team}${grade} — ${priceStr(c.price)}${note}. ${c.lore.blurb}`;
}

/** Full inventory grounding text, grouped by physical location in the shop. */
export function buildInventoryContext(cards: Card[]): string {
  const groups = new Map<string, Card[]>();
  for (const c of cards) {
    const loc = where(c);
    if (!groups.has(loc)) groups.set(loc, []);
    groups.get(loc)!.push(c);
  }
  const sections: string[] = [];
  for (const [loc, group] of groups) {
    sections.push(`## In ${loc}:\n${group.map(cardLine).join('\n')}`);
  }
  sections.push(`## Also in the Colts Room (memorabilia, not for sale):\n${showcase.map((i) => `- ${i.name}: ${i.blurb}`).join('\n')}`);
  return sections.join('\n\n');
}
