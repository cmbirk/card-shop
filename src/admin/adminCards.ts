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

/** A blank card scaffold for the "add" form. */
export function blankCard(): Card {
  return {
    id: '',
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

/** Derive a stable id from the card fields when the admin hasn't set one. */
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
