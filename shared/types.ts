export type Sport = 'baseball' | 'basketball' | 'football' | 'hockey' | 'tcg';

export type Rarity = 'common' | 'rare' | 'premium' | 'graded';

export type GradeCompany = 'PSA' | 'BGS' | 'TAG' | 'SGC' | 'CGC';
export type AutographKind = 'none' | 'on-card' | 'sticker';
export type RelicKind = 'none' | 'jersey' | 'patch' | 'multi-patch' | 'bat' | 'other';
export type CardStatus = 'available' | 'reserved' | 'sold' | 'personal'; // personal = Chris's own collection, not for sale
export type RawCondition = 'NM-MT' | 'NM' | 'EX-MT' | 'EX' | 'VG-EX' | 'VG' | 'GOOD' | 'POOR';

export interface Grade {
  company: GradeCompany;
  value: number;
  label: string;
  certNumber?: string;
  subgrades?: { centering?: number; corners?: number; edges?: number; surface?: number };
  autoGrade?: number;
}

export interface Card {
  id: string;
  sport: Sport;
  category: string; // shelf grouping: 'rookies' | 'vintage' | 'stars' | 'graded-slabs' | 'budget-box'
  playerName: string;
  team: string;
  year: number;
  setName: string;
  cardNumber: string;
  rarity: Rarity;

  // identity
  brand?: string; // Topps, Panini, Upper Deck, Bowman…
  subset?: string; // insert/subset name, e.g. "Downtown", "Young Guns"

  // variant / parallel
  parallel?: string; // "Base", "Refractor", "Silver Prizm", "Gold"…
  printRun?: number | null; // the /X (null = unnumbered)
  serialNumber?: number; // the specific copy, e.g. 113 of /125
  variation?: string; // SP / SSP / photo variation / error note

  // features ("hits")
  isRookie?: boolean;
  autograph?: AutographKind;
  relic?: RelicKind;
  isInsert?: boolean;
  isError?: boolean;

  // condition / grading
  graded?: boolean;
  grade?: Grade;
  rawCondition?: RawCondition; // when ungraded

  // commerce
  price: number; // list price, integer cents
  status?: CardStatus; // available | reserved | sold | personal
  quantity?: number; // usually 1 for singles
  costBasis?: number; // ADMIN-ONLY, integer cents — never selected into the public client
  acquiredDate?: string; // ADMIN-ONLY, ISO date
  acquiredFrom?: string; // ADMIN-ONLY

  // media
  foil?: boolean;
  images?: { front: string; back?: string; extra?: string[] }; // real scans override procedural art

  // presentation / AI grounding
  lore: { blurb: string; funFact?: string; investmentNote?: string };
  featured?: boolean; // display case
  section?: string; // optional fixture override; else auto by sport

  // system
  seed: number; // drives procedural art + placement jitter
  createdAt?: string;
  updatedAt?: string;
}

export interface InventoryFile {
  cards: Card[];
}

export type Vec3 = [number, number, number];

export type FixtureKind = 'shelf' | 'displayCase' | 'counter' | 'bin';

export interface Fixture {
  id: string;
  kind: FixtureKind;
  position: Vec3;
  rotationY: number; // radians
  accepts: { sport?: Sport; category?: string; featured?: boolean; status?: CardStatus };
  slots: { rows: number; cols: number; spacing: [number, number] };
  stationId: string;
  label: string;
}

export interface Station {
  id: string;
  position: Vec3; // camera position
  target: Vec3; // look-at point
  yawRange: number; // radians, +/- around pose azimuth
  pitchRange: number; // radians, +/- around pose polar
  neighbors: string[];
}

export interface ShopLayout {
  fixtures: Fixture[];
  stations: Station[];
  entry: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  basket: string[]; // card ids
  /** Situational context (rides the user turn, never the cached system prompt). */
  context?: { station?: string; holding?: string };
}
