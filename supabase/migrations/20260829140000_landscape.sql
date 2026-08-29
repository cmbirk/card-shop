-- Horizontal cards: the scan is landscape, so the card renders sideways (and graded ones get
-- the wide holder). Set automatically from the front scan's dimensions at upload.
alter table public.cards add column if not exists landscape boolean not null default false;
-- views can't have a column inserted mid-list: recreate with landscape appended
drop view if exists public.cards_public;
create view public.cards_public as
  select id, sport, category, player_name, team, year, set_name, card_number, rarity,
         brand, subset, parallel, print_run, serial_number, variation,
         is_rookie, autograph, relic, is_insert, is_error,
         graded, grade, raw_condition,
         price, status, quantity,
         foil, image_front, image_back, image_extra,
         lore, featured, section, seed, created_at, updated_at, landscape
  from public.cards;
grant select on public.cards_public to anon, authenticated;
