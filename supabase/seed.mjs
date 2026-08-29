// One-time migration: push the current mock + real inventory into Supabase.
// Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node supabase/seed.mjs
//        (or put those in .env.local)
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

if (existsSync(join(root, '.env.local'))) {
  for (const line of readFileSync(join(root, '.env.local'), 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Need SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (service role bypasses RLS for the seed).');
  process.exit(1);
}

const inventory = JSON.parse(readFileSync(join(root, 'shared/data/inventory.json'), 'utf8')).cards;
const real = JSON.parse(readFileSync(join(root, 'shared/data/realCards.json'), 'utf8')).cards;
const cards = [...inventory, ...real];

// inline camelCase → snake_case (can't import TS from node without a build step)
function toRow(c) {
  return {
    id: c.id,
    sport: c.sport,
    category: c.category,
    player_name: c.playerName,
    team: c.team ?? '',
    year: c.year ?? 0,
    set_name: c.setName ?? '',
    card_number: c.cardNumber ?? '',
    rarity: c.rarity ?? 'common',
    brand: c.brand ?? null,
    subset: c.subset ?? null,
    parallel: c.parallel ?? null,
    print_run: c.printRun ?? null,
    serial_number: c.serialNumber ?? null,
    variation: c.variation ?? null,
    is_rookie: !!c.isRookie,
    autograph: c.autograph ?? 'none',
    relic: c.relic ?? 'none',
    is_insert: !!c.isInsert,
    is_error: !!c.isError,
    graded: c.graded ?? !!c.grade,
    grade: c.grade ?? null,
    raw_condition: c.rawCondition ?? null,
    price: c.price ?? 0,
    status: c.status ?? 'available',
    quantity: c.quantity ?? 1,
    cost_basis: c.costBasis ?? null,
    acquired_date: c.acquiredDate ?? null,
    acquired_from: c.acquiredFrom ?? null,
    foil: !!c.foil,
    image_front: c.images?.front ?? null,
    image_back: c.images?.back ?? null,
    image_extra: c.images?.extra ?? [],
    lore: c.lore ?? { blurb: '' },
    featured: !!c.featured,
    section: c.section ?? null,
    seed: c.seed ?? 0,
  };
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
const rows = cards.map(toRow);
const { error } = await supabase.from('cards').upsert(rows, { onConflict: 'id' });
if (error) {
  console.error('Seed failed:', error.message);
  process.exit(1);
}
console.log(`Seeded ${rows.length} cards into Supabase.`);
