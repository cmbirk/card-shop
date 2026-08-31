import { track } from '@vercel/analytics';
import { inventoryById } from './inventory';

// Product events for Vercel Web Analytics — the funnel a single-page shop can't get from page
// views. Event names + prop keys are the contract with the dashboard, so keep them stable.
// No PII ever: card ids, sports and station ids only — never emails, names or chat text.

export interface CardProps {
  card: string;
  sport: string;
  graded: boolean;
  cents: number;
  personal: boolean;
}

export interface ShopEvents {
  enter_shop: undefined; // first step through the front door
  visit_station: { station: string; via: 'glide' | 'walk' };
  freewalk: undefined; // detached from the station rig with WASD
  pickup_card: CardProps;
  basket_add: CardProps;
  chat: { via: 'typed' | 'card' | 'photo' }; // a message to Chris, by how it started
  sign_in: { method: 'google' | 'magic' }; // completed, not attempted
  checkout: { step: 'atCounter' | 'moodCheck' | 'reviewing' | 'paying' | 'receipt'; items: number; cents: number };
}

type Props = Record<string, string | number | boolean | null>;

/** Dev-only tap so verify.mjs can assert events fired: `eval,JSON.stringify(window.__events)`. */
const devLog: { name: string; props?: Props }[] = [];
if (import.meta.env.DEV && typeof window !== 'undefined') (window as unknown as { __events: typeof devLog }).__events = devLog;

export function logEvent<K extends keyof ShopEvents>(name: K, ...rest: ShopEvents[K] extends undefined ? [] : [ShopEvents[K]]): void {
  if (typeof window === 'undefined') return; // unit tests
  const props = rest[0] as Props | undefined;
  if (import.meta.env.DEV) devLog.push({ name, props });
  try {
    track(name, props);
  } catch {
    // analytics never breaks the shop
  }
}

export function cardProps(id: string): CardProps {
  const c = inventoryById.get(id);
  return { card: id, sport: c?.sport ?? 'unknown', graded: !!c?.graded, cents: c?.price ?? 0, personal: c?.status === 'personal' };
}

export function basketSummary(ids: readonly string[]): { items: number; cents: number } {
  return { items: ids.length, cents: ids.reduce((n, id) => n + (inventoryById.get(id)?.price ?? 0), 0) };
}
