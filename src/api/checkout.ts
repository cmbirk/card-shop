import { accessToken } from '../stores/authStore';

// Client side of the register: open a hosted Stripe Checkout for the hold pile, fetch the
// resulting order for the receipt, or release a canceled one.

export interface OrderItem {
  id: string;
  playerName: string;
  year: number;
  setName: string;
  cardNumber: string;
  price: number;
}
export interface Order {
  id: string;
  status: 'pending' | 'paid' | 'canceled' | 'expired';
  items: OrderItem[];
  total: number;
  test_mode: boolean;
  created_at: string;
  paid_at: string | null;
}

const headers = () => {
  const token = accessToken();
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
};

export class CheckoutConflict extends Error {
  constructor(public missing: string[]) {
    super('some cards are gone');
  }
}

/** Reserve the cards + open Stripe. Resolves with the hosted Checkout URL to navigate to. */
export async function startCheckout(ids: string[]): Promise<{ url: string; orderId: string }> {
  const res = await fetch('/api/checkout', { method: 'POST', headers: headers(), body: JSON.stringify({ ids }) });
  const body = (await res.json().catch(() => ({}))) as { url?: string; orderId?: string; error?: string; missing?: string[] };
  if (res.status === 409) throw new CheckoutConflict(body.missing ?? []);
  if (!res.ok || !body.url || !body.orderId) throw new Error(body.error ?? `checkout failed (${res.status})`);
  return { url: body.url, orderId: body.orderId };
}

export async function fetchOrder(q: { sessionId?: string; orderId?: string }): Promise<Order | null> {
  const p = q.sessionId ? `session_id=${encodeURIComponent(q.sessionId)}` : `order_id=${encodeURIComponent(q.orderId ?? '')}`;
  const res = await fetch(`/api/orders?${p}`, { headers: headers() });
  if (!res.ok) return null;
  return ((await res.json()) as { order: Order }).order;
}

export async function cancelOrder(orderId: string): Promise<void> {
  await fetch('/api/orders', { method: 'POST', headers: headers(), body: JSON.stringify({ order_id: orderId, action: 'cancel' }) });
}
