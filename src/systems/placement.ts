import type { Card, Fixture, ShopLayout } from '@shared/types';
import { mulberry32, spread } from './rng';

export interface SlotTransform {
  position: [number, number, number]; // fixture-local
  rotation: [number, number, number]; // fixture-local euler (XYZ order)
}

export interface PlacedCard {
  card: Card;
  slot: SlotTransform;
}

const DEG = Math.PI / 180;

// Shelf boards (card row heights, bottom of card stack)
const SHELF_ROW_Y = [0.5, 0.9, 1.3, 1.7];

function matches(card: Card, fixture: Fixture): boolean {
  const a = fixture.accepts;
  // personal (not-for-sale) cards only ever go in a fixture that asks for them
  if (a.status) return card.status === a.status;
  if (card.status === 'personal') return false;
  // consigned cards mix into regular stock (marked by a sleeve dot); accepts.consigned is kept
  // in the schema for a possible seasonal "fresh consignments" fixture later
  if (a.consigned) return !!card.isConsigned && card.status === 'available';
  // reserved (someone's at the register with it) and sold cards leave the floor
  if (card.status === 'reserved' || card.status === 'sold') return false;
  if (a.featured) return !!card.featured;
  if (card.featured) return false;
  if (a.sport && card.sport !== a.sport) return false;
  if (a.category && card.category !== a.category) return false;
  // shelves shouldn't grab bin stock
  if (a.sport && card.category.startsWith('budget-box')) return false;
  return true;
}

function shelfSlot(fixture: Fixture, index: number, card: Card): SlotTransform {
  const { cols, spacing } = fixture.slots;
  const row = Math.floor(index / cols);
  const col = index % cols;
  const rowY = SHELF_ROW_Y[SHELF_ROW_Y.length - 1 - row]; // fill top (eye-level) rows first
  const x = (col - (cols - 1) / 2) * spacing[0];
  const rand = mulberry32(card.seed);
  return {
    position: [x + spread(rand) * 0.005, rowY + 0.048, 0.16],
    rotation: [-10 * DEG, 0, spread(rand) * 1.5 * DEG],
  };
}

function caseSlot(fixture: Fixture, index: number): SlotTransform {
  const { cols, spacing } = fixture.slots;
  const row = Math.floor(index / cols);
  const col = index % cols;
  // theater staging on one low shelf: best row in front, second row on a
  // velvet riser behind — everything stays below the cap's sightline
  const y = row === 0 ? 0.58 : 0.69;
  const z = row === 0 ? 0.16 : -0.06;
  const x = (col - (cols - 1) / 2) * spacing[0];
  return {
    position: [x, y, z],
    rotation: [-32 * DEG, 0, 0],
  };
}

/** Closed stack, back (index 0) to front; Bin.tsx animates the riffle on top of this rest pose. */
function binSlot(fixture: Fixture, index: number, card: Card): SlotTransform {
  const { spacing } = fixture.slots;
  const rand = mulberry32(card.seed);
  return {
    position: [spread(rand) * 0.008, 0.85 + spread(rand) * 0.008, -0.18 + index * spacing[1]],
    rotation: [-35 * DEG, spread(rand) * 3 * DEG, spread(rand) * 5 * DEG],
  };
}

/**
 * Pure, deterministic: inventory + layout → per-fixture placed cards.
 * Cards never store 3D positions; moving a fixture never touches inventory data.
 */
export function assignCards(cards: Card[], layout: ShopLayout): Map<string, PlacedCard[]> {
  const out = new Map<string, PlacedCard[]>();
  const taken = new Set<string>();

  for (const fixture of layout.fixtures) {
    if (fixture.kind === 'counter') continue;
    const capacity = fixture.slots.rows * fixture.slots.cols;
    const eligible = cards.filter((c) => !taken.has(c.id) && matches(c, fixture));

    if (fixture.kind === 'displayCase') eligible.sort((a, b) => b.price - a.price);
    else if (fixture.kind === 'shelf')
      eligible.sort((a, b) => a.category.localeCompare(b.category) || a.playerName.localeCompare(b.playerName));

    const placed: PlacedCard[] = [];
    for (let i = 0; i < Math.min(capacity, eligible.length); i++) {
      const card = eligible[i];
      taken.add(card.id);
      const slot =
        fixture.kind === 'displayCase'
          ? caseSlot(fixture, i)
          : fixture.kind === 'bin'
            ? binSlot(fixture, i, card)
            : shelfSlot(fixture, i, card);
      placed.push({ card, slot });
    }
    if (eligible.length > capacity) {
      console.warn(`[placement] ${fixture.id}: ${eligible.length - capacity} cards did not fit`);
    }
    out.set(fixture.id, placed);
  }
  return out;
}
