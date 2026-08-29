import type { Card } from '@shared/types';
import { rowToCard, cardToRow, type CardRow } from '@shared/cardMapping';
import { supabase } from '../lib/supabase';

// Admin-only data operations. All writes go browser → Supabase under the
// admin's JWT; RLS enforces that only admins can mutate. Reads here hit the
// base `cards` table (admins see every column + sold/reserved rows), unlike
// the customer-facing `cards_public` view.

export async function listAllCards(): Promise<Card[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('cards').select('*').order('updated_at', { ascending: false });
  if (error) throw error;
  return (data as CardRow[]).map(rowToCard);
}

export async function saveCard(card: Card): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase.from('cards').upsert(cardToRow(card) as never, { onConflict: 'id' });
  if (error) throw error;
}

/** Remove many at once (bulk select in the panel). */
export async function deleteCards(ids: string[]): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  if (ids.length === 0) return;
  const { error } = await supabase.from('cards').delete().in('id', ids);
  if (error) throw error;
}

/** Upsert many (import). Chunked so a big CSV doesn't hit request limits. */
export async function saveCards(cards: Card[]): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  for (let i = 0; i < cards.length; i += 200) {
    const rows = cards.slice(i, i + 200).map((c) => cardToRow(c) as never);
    const { error } = await supabase.from('cards').upsert(rows, { onConflict: 'id' });
    if (error) throw error;
  }
}

export async function deleteCard(id: string): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase.from('cards').delete().eq('id', id);
  if (error) throw error;
}

/** Upload a scan to the card-images bucket, return its public URL. */
export async function uploadCardImage(file: File, cardId: string, side: 'front' | 'back' | string): Promise<string> {
  if (!supabase) throw new Error('Supabase not configured');
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${cardId}/${side}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('card-images').upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  const { data } = supabase.storage.from('card-images').getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Generated card id: sport prefix + 8 random hex chars (e.g. "fb-3f9a2c1d"). Never derived from
 * mutable fields — two copies of the same card must not collide — and short because ids ride
 * Chris's grounding prompt.
 */
export function newCardId(sport: Card['sport'] = 'baseball'): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const prefix = sport === 'basketball' ? 'bk' : sport.slice(0, 2);
  return `${prefix}-${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

/** A blank card scaffold for the "add" form. */
export function blankCard(): Card {
  return {
    id: newCardId(),
    sport: 'baseball',
    category: 'stars',
    playerName: '',
    team: '',
    year: new Date().getFullYear(),
    setName: '',
    cardNumber: '',
    rarity: 'common',
    autograph: 'none',
    relic: 'none',
    status: 'available',
    quantity: 1,
    price: 0,
    seed: Math.floor(Math.random() * 2_000_000_000),
    lore: { blurb: '' },
  };
}

/** @deprecated ids are generated (newCardId); kept for scripts that still call it. */
export function suggestId(c: Card): string {
  const slug = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 24);
  const parts = [c.sport.slice(0, 2), c.year || '', slug(c.playerName), c.grade?.certNumber || slug(c.parallel || '')].filter(
    Boolean,
  );
  return parts.join('-').replace(/-+/g, '-');
}


// ─── Import / export ────────────────────────────────────────────────────────
// CSV headers are Card field names (camelCase) plus a few flattened ones. Prices in DOLLARS.

export const CSV_COLUMNS = [
  'id', 'sport', 'category', 'playerName', 'team', 'year', 'setName', 'cardNumber', 'brand', 'subset',
  'parallel', 'printRun', 'serialNumber', 'variation', 'rarity', 'isRookie', 'autograph', 'relic', 'isInsert',
  'isError', 'foil', 'landscape', 'featured', 'gradeCompany', 'gradeValue', 'gradeLabel', 'certNumber', 'rawCondition',
  'price', 'status', 'quantity', 'costBasis', 'acquiredDate', 'acquiredFrom', 'imageFront', 'imageBack',
  'blurb', 'funFact', 'investmentNote', 'seed',
] as const;

const SPORTS = new Set(['baseball', 'basketball', 'football', 'hockey', 'tcg']);
const STATUSES = new Set(['available', 'reserved', 'sold', 'personal']);
const RARITIES = new Set(['common', 'rare', 'premium', 'graded']);

export interface ImportResult {
  cards: Card[];
  /** per-row problems (row = 1-based data row, or 0 for file-level) */
  errors: { row: number; message: string }[];
}

const truthy = (v: unknown) => /^(true|yes|y|1|x)$/i.test(String(v ?? '').trim());
const num = (v: unknown): number | undefined => {
  const s = String(v ?? '').trim().replace(/^\$/, '');
  if (s === '') return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
};
const str = (v: unknown): string | undefined => {
  const s = String(v ?? '').trim();
  return s === '' ? undefined : s;
};

/** Minimal RFC-4180 CSV parser (quotes, escaped quotes, newlines in quotes). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else q = false;
      } else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

/** One flat record (from CSV or JSON) → Card, or a list of problems. */
function recordToCard(r: Record<string, unknown>): { card?: Card; errors: string[] } {
  const errors: string[] = [];
  const sport = str(r.sport)?.toLowerCase();
  if (!sport || !SPORTS.has(sport)) errors.push(`sport must be one of ${[...SPORTS].join('/')}`);
  const playerName = str(r.playerName);
  if (!playerName) errors.push('playerName is required');
  const category = str(r.category) ?? 'stars';
  const status = (str(r.status) ?? 'available').toLowerCase();
  if (!STATUSES.has(status)) errors.push(`status must be one of ${[...STATUSES].join('/')}`);
  const rarity = (str(r.rarity) ?? 'common').toLowerCase();
  if (!RARITIES.has(rarity)) errors.push(`rarity must be one of ${[...RARITIES].join('/')}`);
  const priceDollars = num(r.price);
  if (priceDollars !== undefined && priceDollars < 0) errors.push('price must be ≥ 0');
  if (errors.length) return { errors };

  // JSON rows may already carry nested shapes; CSV rows carry the flattened ones
  const lore = (r.lore as Card['lore'] | undefined) ?? {
    blurb: str(r.blurb) ?? '',
    ...(str(r.funFact) ? { funFact: str(r.funFact) } : {}),
    ...(str(r.investmentNote) ? { investmentNote: str(r.investmentNote) } : {}),
  };
  const gradeCompany = str(r.gradeCompany);
  const gradeValue = num(r.gradeValue);
  const grade: Card['grade'] =
    (r.grade as Card['grade'] | undefined) ??
    (gradeCompany && gradeValue !== undefined
      ? { company: gradeCompany.toUpperCase() as NonNullable<Card['grade']>['company'], value: gradeValue, label: str(r.gradeLabel) ?? `${gradeCompany.toUpperCase()} ${gradeValue}`, ...(str(r.certNumber) ? { certNumber: str(r.certNumber) } : {}) }
      : undefined);
  const images = (r.images as Card['images'] | undefined) ?? (str(r.imageFront) ? { front: str(r.imageFront)!, ...(str(r.imageBack) ? { back: str(r.imageBack) } : {}) } : undefined);
  const priceIsCents = typeof r.price === 'number' && r.lore !== undefined; // JSON in app shape = cents already

  const card: Card = {
    id: str(r.id) ?? '',
    sport: sport as Card['sport'],
    category,
    playerName: playerName!,
    team: str(r.team) ?? '',
    year: num(r.year) ?? 0,
    setName: str(r.setName) ?? '',
    cardNumber: str(r.cardNumber) ?? '',
    rarity: (grade ? 'graded' : rarity) as Card['rarity'],
    brand: str(r.brand),
    subset: str(r.subset),
    parallel: str(r.parallel),
    printRun: num(r.printRun) ?? null,
    serialNumber: num(r.serialNumber),
    variation: str(r.variation),
    isRookie: truthy(r.isRookie),
    autograph: (str(r.autograph)?.toLowerCase() as Card['autograph']) ?? 'none',
    relic: (str(r.relic)?.toLowerCase() as Card['relic']) ?? 'none',
    isInsert: truthy(r.isInsert),
    isError: truthy(r.isError),
    graded: !!grade,
    grade,
    rawCondition: str(r.rawCondition)?.toUpperCase() as Card['rawCondition'],
    price: priceDollars === undefined ? 0 : priceIsCents ? Math.round(priceDollars) : Math.round(priceDollars * 100),
    status: status as Card['status'],
    quantity: num(r.quantity) ?? 1,
    costBasis: num(r.costBasis) === undefined ? undefined : priceIsCents ? Math.round(num(r.costBasis)!) : Math.round(num(r.costBasis)! * 100),
    acquiredDate: str(r.acquiredDate),
    acquiredFrom: str(r.acquiredFrom),
    foil: truthy(r.foil),
    landscape: truthy(r.landscape),
    images,
    lore,
    featured: truthy(r.featured),
    seed: num(r.seed) ?? Math.floor(Math.random() * 2_000_000_000),
  };
  if (!card.id) card.id = newCardId(card.sport); // no id → a new card
  return { card, errors: [] };
}

/** CSV or JSON text → cards + row errors. JSON may be `Card[]` or `{ cards: Card[] }` in app shape. */
export function parseImport(text: string): ImportResult {
  const trimmed = text.trim();
  const errors: ImportResult['errors'] = [];
  let records: Record<string, unknown>[] = [];
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const j = JSON.parse(trimmed) as unknown;
      const arr = Array.isArray(j) ? j : (j as { cards?: unknown }).cards;
      if (!Array.isArray(arr)) return { cards: [], errors: [{ row: 0, message: 'JSON must be an array of cards or { cards: [...] }' }] };
      records = arr as Record<string, unknown>[];
    } catch (e) {
      return { cards: [], errors: [{ row: 0, message: `Invalid JSON: ${(e as Error).message}` }] };
    }
  } else {
    const rows = parseCsv(trimmed);
    if (rows.length < 2) return { cards: [], errors: [{ row: 0, message: 'CSV needs a header row and at least one card' }] };
    const headers = rows[0].map((h) => h.trim());
    records = rows.slice(1).map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ''])));
  }
  const cards: Card[] = [];
  const seen = new Set<string>();
  records.forEach((rec, i) => {
    const { card, errors: errs } = recordToCard(rec);
    if (!card) {
      errs.forEach((m) => errors.push({ row: i + 1, message: m }));
      return;
    }
    if (seen.has(card.id)) {
      errors.push({ row: i + 1, message: `duplicate id "${card.id}" in this file` });
      return;
    }
    seen.add(card.id);
    cards.push(card);
  });
  return { cards, errors };
}

function csvCell(v: unknown): string {
  const s = v === undefined || v === null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Cards → CSV with CSV_COLUMNS (prices in dollars). Round-trips through parseImport. */
export function exportCsv(cards: Card[]): string {
  const line = (c: Card) =>
    CSV_COLUMNS.map((col) => {
      switch (col) {
        case 'price': return (c.price / 100).toFixed(2);
        case 'costBasis': return c.costBasis == null ? '' : (c.costBasis / 100).toFixed(2);
        case 'gradeCompany': return c.grade?.company ?? '';
        case 'gradeValue': return c.grade?.value ?? '';
        case 'gradeLabel': return c.grade?.label ?? '';
        case 'certNumber': return c.grade?.certNumber ?? '';
        case 'imageFront': return c.images?.front ?? '';
        case 'imageBack': return c.images?.back ?? '';
        case 'blurb': return c.lore?.blurb ?? '';
        case 'funFact': return c.lore?.funFact ?? '';
        case 'investmentNote': return c.lore?.investmentNote ?? '';
        case 'printRun': return c.printRun ?? '';
        default: return (c as unknown as Record<string, unknown>)[col];
      }
    })
      .map(csvCell)
      .join(',');
  return [CSV_COLUMNS.join(','), ...cards.map(line)].join('\n');
}

export const CSV_TEMPLATE =
  CSV_COLUMNS.join(',') +
  '\n' +
  ',baseball,rookies,Jane Example,Harbor City Herons,2024,Pennant Craze,#12,Topps,,Base,,,,common,yes,none,none,no,no,no,no,no,,,,,NM-MT,4.99,available,1,1.50,2026-08-01,card show,,,"A sample rookie — replace me.",,,\n';
