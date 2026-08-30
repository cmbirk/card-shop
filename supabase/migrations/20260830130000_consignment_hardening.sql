-- Consignment hardening (post-review):
-- 1. Base-table reads are no longer world-readable to authenticated users: customers read
--    cards_public (owner-definer view, unaffected); the base table is admins + own consignments.
-- 2. reserve_cards refuses consignments that aren't listed and anything priced <= 0 — a
--    submitted ($0, still at the seller's house) or withdrawn card can never be sold.
-- 3. Withdraw can't be requested while a buyer's live reservation holds the card.
-- 4. Consignor display name lives on sellers (set at invite, admin-editable) — never derived
--    from an email local-part.

drop policy if exists cards_select_public on public.cards;
create policy cards_select_public on public.cards
  for select using (
    public.is_admin(auth.uid())
    or consignor_id = auth.uid()
  );

create or replace function public.reserve_cards(ids text[], order_id uuid, ttl interval)
returns setof text language sql security definer set search_path = public as $$
  update public.cards
     set status = 'reserved', reserved_until = now() + ttl, reserved_order = order_id
   where id = any(ids)
     and (status = 'available' or (status = 'reserved' and reserved_until < now()))
     and (consignor_id is null or consign_status = 'listed')
     and price > 0
  returning id;
$$;
grant execute on function public.reserve_cards(text[], uuid, interval) to service_role;

alter table public.sellers add column if not exists display_name text;

create or replace function public.cards_consignor_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin(auth.uid()) then
    return new;
  end if;
  if not public.is_seller(auth.uid()) then
    raise exception 'not allowed';
  end if;
  if new.consignor_id is distinct from auth.uid() then
    raise exception 'consignments must belong to you';
  end if;
  if tg_op = 'INSERT' then
    new.consign_status := 'submitted';
    new.price := 0;
    new.status := 'available';
    new.featured := false;
    new.cost_basis := null;
    new.section := null;
    return new;
  end if;
  if old.consignor_id is distinct from auth.uid() then
    raise exception 'not your consignment';
  end if;
  if new.price is distinct from old.price
     or new.status is distinct from old.status
     or new.cost_basis is distinct from old.cost_basis
     or new.featured is distinct from old.featured
     or new.section is distinct from old.section
     or new.lore is distinct from old.lore
     or new.consign_note is distinct from old.consign_note then
    raise exception 'sellers cannot change price, status, lore or notes';
  end if;
  if new.consign_status is distinct from old.consign_status then
    if old.consign_status in ('approved','received','listed') and new.consign_status = 'withdraw_requested' then
      if old.status = 'reserved' and old.reserved_until > now() then
        raise exception 'someone is checking out with this card — try again in a few minutes';
      end if;
      return new;
    elsif old.consign_status = 'rejected' and new.consign_status = 'submitted' then
      return new;
    end if;
    raise exception 'transition % -> % is not yours to make', old.consign_status, new.consign_status;
  end if;
  if old.consign_status not in ('submitted','rejected') then
    raise exception 'card is locked once approved — ask Chris for changes';
  end if;
  return new;
end; $$;

-- view: consignor name from sellers.display_name (never an email local-part)
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
         lore, featured, section, seed, created_at, updated_at, landscape,
         (consignor_id is not null) as is_consigned,
         case when consignor_id is not null
              then coalesce((select nullif(trim(s.display_name), '') from public.sellers s where s.user_id = consignor_id), 'a local collector')
         end as consignor_display
  from public.cards
  where consignor_id is null or consign_status in ('listed','sold','paid');
grant select on public.cards_public to anon, authenticated;
