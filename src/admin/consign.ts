import type { Card, ConsignStatus } from '@shared/types';
import { rowToCard, cardToRow, type CardRow } from '@shared/cardMapping';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

// Seller-side consignment data ops. All writes go browser → Supabase under the seller's JWT;
// RLS + the cards_consignor_guard trigger are the real fence (see docs/SPEC-consignment.md).

export interface PayoutRow {
  id: string;
  card_id: string;
  sale_price: number;
  split_pct: number;
  amount: number;
  test_mode: boolean;
  status: 'owed' | 'paid' | 'void';
  method: string | null;
  reference: string | null;
  paid_at: string | null;
  created_at: string;
}

const uid = () => {
  const id = useAuthStore.getState().user?.id;
  if (!id) throw new Error('sign in first');
  return id;
};

/** The caller's consignments, newest first (base-table read; RLS scopes rows). */
export async function myConsignments(): Promise<Card[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('cards')
    .select('*')
    .eq('consignor_id', uid())
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data as CardRow[]).map(rowToCard);
}

/** Submit or re-save a consignment (trigger forces submitted/price 0 on insert). */
export async function saveConsignment(card: Card): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  const row = { ...cardToRow(card), consignor_id: uid(), asking_price: card.askingPrice ?? null };
  const { error } = await supabase.from('cards').upsert(row as never, { onConflict: 'id' });
  if (error) throw error;
}

export async function deleteConsignment(id: string): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase.from('cards').delete().eq('id', id).eq('consignor_id', uid());
  if (error) throw error;
}

/** Ask for the card back (allowed from approved/received/listed; Chris confirms). */
export async function requestWithdraw(id: string): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase
    .from('cards')
    .update({ consign_status: 'withdraw_requested', consignor_id: uid() } as never)
    .eq('id', id)
    .eq('consignor_id', uid());
  if (error) throw error;
}

/** Resubmit after a rejection (edits allowed again once back in `submitted`). */
export async function resubmit(id: string): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase
    .from('cards')
    .update({ consign_status: 'submitted', consignor_id: uid() } as never)
    .eq('id', id)
    .eq('consignor_id', uid());
  if (error) throw error;
}

/** Upload a scan under the seller's own storage prefix (consign/{uid}/…). */
export async function uploadConsignScan(file: File, cardId: string, side: 'front' | 'back'): Promise<string> {
  if (!supabase) throw new Error('Supabase not configured');
  const path = `consign/${uid()}/${cardId}-${side}-${Date.now()}.jpg`;
  const { error } = await supabase.storage.from('card-images').upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  return supabase.storage.from('card-images').getPublicUrl(path).data.publicUrl;
}

/** The caller's payout ledger (RLS scopes rows). */
export async function myPayouts(): Promise<PayoutRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('payouts').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data as PayoutRow[];
}

export const CONSIGN_STATUS_LABEL: Record<ConsignStatus, string> = {
  submitted: 'Waiting for Chris',
  approved: 'Approved — ship it in',
  rejected: 'Not this one',
  received: 'In Chris’s hands',
  listed: 'On the shelf',
  sold: 'Sold!',
  paid: 'Paid out',
  withdraw_requested: 'Return requested',
  withdrawn: 'Returned to you',
};

/** Fire-and-forget notification (server re-verifies state before emailing). */
export function notifyConsign(cardId: string, event: string): void {
  const token = useAuthStore.getState().session?.access_token;
  void fetch('/api/consign-notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ cardId, event }),
  }).catch(() => undefined);
}

// ─── Chris's side (admin) ───────────────────────────────────────────────────

/** Admin: move a consignment along its lifecycle (approve/reject/receive/list/withdraw…). */
export async function adminSetConsignStatus(id: string, status: ConsignStatus, note?: string): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  const patch: Record<string, unknown> = { consign_status: status };
  if (note !== undefined) patch.consign_note = note;
  const { error } = await supabase.from('cards').update(patch as never).eq('id', id);
  if (error) throw error;
}

export interface AdminPayoutRow extends PayoutRow {
  seller_id: string | null;
  seller_handle: string | null;
}

export async function adminListPayouts(): Promise<AdminPayoutRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('payouts').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data as AdminPayoutRow[];
}

/** Admin: record a payout as paid (method + reference) and flip the card to `paid`. */
export async function adminMarkPaid(payout: AdminPayoutRow, method: string, reference: string): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase
    .from('payouts')
    .update({ status: 'paid', method, reference, paid_at: new Date().toISOString() } as never)
    .eq('id', payout.id)
    .eq('status', 'owed');
  if (error) throw error;
  await adminSetConsignStatus(payout.card_id, 'paid');
}
