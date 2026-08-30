import type { Card, ConsignStatus, Grade } from './types';

// Maps between the Postgres `cards` row (snake_case) and the app `Card`
// (camelCase). Used by the client read, the seed script, and the grounding fn.

export interface CardRow {
  id: string;
  sport: string;
  category: string;
  player_name: string;
  team: string;
  year: number;
  set_name: string;
  card_number: string;
  rarity: string;
  brand: string | null;
  subset: string | null;
  parallel: string | null;
  print_run: number | null;
  serial_number: number | null;
  variation: string | null;
  is_rookie: boolean;
  autograph: string;
  relic: string;
  is_insert: boolean;
  is_error: boolean;
  graded: boolean;
  grade: Grade | null;
  raw_condition: string | null;
  price: number;
  status: string;
  quantity: number;
  cost_basis?: number | null; // present only when read as admin
  acquired_date?: string | null;
  acquired_from?: string | null;
  foil: boolean;
  landscape?: boolean;
  consignor_id?: string | null;
  consign_status?: string | null;
  asking_price?: number | null;
  consign_note?: string | null;
  is_consigned?: boolean; // view only
  consignor_display?: string | null; // view only
  image_front: string | null;
  image_back: string | null;
  image_extra: string[];
  lore: Card['lore'];
  featured: boolean;
  section: string | null;
  seed: number;
  created_at?: string;
  updated_at?: string;
}

export function rowToCard(r: CardRow): Card {
  const images = r.image_front
    ? { front: r.image_front, ...(r.image_back ? { back: r.image_back } : {}), ...(r.image_extra?.length ? { extra: r.image_extra } : {}) }
    : undefined;
  return {
    id: r.id,
    sport: r.sport as Card['sport'],
    category: r.category,
    playerName: r.player_name,
    team: r.team,
    year: r.year,
    setName: r.set_name,
    cardNumber: r.card_number,
    rarity: r.rarity as Card['rarity'],
    brand: r.brand ?? undefined,
    subset: r.subset ?? undefined,
    parallel: r.parallel ?? undefined,
    printRun: r.print_run,
    serialNumber: r.serial_number ?? undefined,
    variation: r.variation ?? undefined,
    isRookie: r.is_rookie,
    autograph: r.autograph as Card['autograph'],
    relic: r.relic as Card['relic'],
    isInsert: r.is_insert,
    isError: r.is_error,
    graded: r.graded,
    grade: r.grade ?? undefined,
    rawCondition: (r.raw_condition ?? undefined) as Card['rawCondition'],
    price: r.price,
    status: r.status as Card['status'],
    quantity: r.quantity,
    costBasis: r.cost_basis ?? undefined,
    acquiredDate: r.acquired_date ?? undefined,
    acquiredFrom: r.acquired_from ?? undefined,
    foil: r.foil,
    landscape: !!r.landscape,
    consignorId: r.consignor_id ?? undefined,
    consignStatus: (r.consign_status ?? undefined) as ConsignStatus | undefined,
    askingPrice: r.asking_price ?? undefined,
    consignNote: r.consign_note ?? undefined,
    isConsigned: r.is_consigned ?? !!r.consignor_id,
    consignorDisplay: r.consignor_display ?? undefined,
    images,
    lore: r.lore ?? { blurb: '' },
    featured: r.featured,
    section: r.section ?? undefined,
    seed: Number(r.seed),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** Card → row for insert/update (admin fields included; omit keys that are undefined). */
export function cardToRow(c: Card): Partial<CardRow> {
  const row: Partial<CardRow> = {
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
    landscape: !!c.landscape,
    // consignment keys only when present — an admin upsert must not stomp them
    ...(c.consignorId !== undefined ? { consignor_id: c.consignorId } : {}),
    ...(c.consignStatus !== undefined ? { consign_status: c.consignStatus } : {}),
    ...(c.askingPrice !== undefined ? { asking_price: c.askingPrice } : {}),
    ...(c.consignNote !== undefined ? { consign_note: c.consignNote } : {}),
    image_front: c.images?.front ?? null,
    image_back: c.images?.back ?? null,
    image_extra: c.images?.extra ?? [],
    lore: c.lore ?? { blurb: '' },
    featured: !!c.featured,
    section: c.section ?? null,
    seed: c.seed ?? 0,
  };
  return row;
}
