// Relative imports only — keeps the Vercel function bundler happy without alias config.
import type { Card, InventoryFile } from '../../shared/types';
import inventoryJson from '../../shared/data/inventory.json';
import realCardsJson from '../../shared/data/realCards.json';

export const cards: Card[] = [
  ...(inventoryJson as InventoryFile).cards,
  ...(realCardsJson as unknown as InventoryFile).cards,
];
export const cardsById: Map<string, Card> = new Map(cards.map((c) => [c.id, c]));

const SHELF_LABEL: Record<string, string> = {
  baseball: 'the Baseball shelf (right wall, near the entrance)',
  basketball: 'the Basketball shelf (left wall, near the entrance)',
  football: 'the Football shelf (left wall, middle)',
  hockey: 'the Hockey shelf (left wall, toward the counter)',
  tcg: 'the Trading Card Games shelf (right wall, middle)',
};

function where(card: Card): string {
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
  return `- [${c.id}] ${c.playerName}, ${c.year} ${c.setName} ${c.cardNumber}, ${c.team}${grade} — ${priceStr(c.price)}${note}. ${c.lore.blurb}`;
}

/** Full inventory grounding text, grouped by physical location in the shop. */
export function buildInventoryContext(): string {
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
  return sections.join('\n\n');
}
