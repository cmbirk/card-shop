export type Sport = 'baseball' | 'basketball' | 'football' | 'hockey' | 'tcg';

export type Rarity = 'common' | 'rare' | 'premium' | 'graded';

export interface Card {
  id: string;
  sport: Sport;
  category: string; // 'rookies' | 'vintage' | 'stars' | 'graded-slabs' | 'budget-box'
  playerName: string;
  team: string;
  year: number;
  setName: string;
  cardNumber: string;
  rarity: Rarity;
  grade?: { company: 'PSA' | 'BGS' | 'TAG' | 'SGC'; value: number; label: string };
  price: number; // integer cents
  foil?: boolean;
  seed: number; // drives procedural art + placement jitter
  images?: { front: string; back?: string }; // real scans override procedural art
  lore: { blurb: string; funFact?: string; investmentNote?: string };
  featured?: boolean; // display case
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
  accepts: { sport?: Sport; category?: string; featured?: boolean };
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
}
