-- Enrichment cache: the last Ximilar identification for a card (admin-only feature).
-- Deliberately NOT in cards_public (the view lists its columns explicitly).
alter table public.cards add column if not exists ximilar jsonb;
