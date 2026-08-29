-- Checkout hardening (post-review):
-- 1. cards_public self-heals: a reservation whose TTL lapsed reads as 'available' even if the
--    Stripe 'expired' webhook never arrived, so the card can't be stranded off the shelf.
-- 2. explicit EXECUTE grants for the reserve/release functions (don't rely on default privileges).
drop view if exists public.cards_public;
create view public.cards_public as
  select id, sport, category, player_name, team, year, set_name, card_number, rarity,
         brand, subset, parallel, print_run, serial_number, variation,
         is_rookie, autograph, relic, is_insert, is_error,
         graded, grade, raw_condition,
         price,
         case when status = 'reserved' and (reserved_until is null or reserved_until < now()) then 'available' else status end as status,
         quantity,
         foil, image_front, image_back, image_extra,
         lore, featured, section, seed, created_at, updated_at, landscape
  from public.cards;
grant select on public.cards_public to anon, authenticated;
grant execute on function public.reserve_cards(text[], uuid, interval) to service_role;
grant execute on function public.release_order(uuid) to service_role;
