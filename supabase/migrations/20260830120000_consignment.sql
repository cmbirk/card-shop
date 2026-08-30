-- Consignment Stage 1: sellers, consigned cards, payouts. TLC stays merchant of record;
-- sellers submit cards + an asking price, Chris approves/prices/lists, the Stripe webhook
-- creates payout obligations. Seller writes are fenced by RLS + a guard trigger.

-- ── sellers ────────────────────────────────────────────────────────────────
create table if not exists public.sellers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  invited_by uuid,
  split_pct int not null default 85 check (split_pct between 0 and 100), -- the seller's keep
  payout_handle text,
  payout_method text,
  created_at timestamptz not null default now()
);

create or replace function public.is_seller(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.sellers s where s.user_id = uid);
$$;

alter table public.sellers enable row level security;
drop policy if exists sellers_self_read on public.sellers;
create policy sellers_self_read on public.sellers
  for select using (auth.uid() = user_id or public.is_admin(auth.uid()));
drop policy if exists sellers_admin_write on public.sellers;
create policy sellers_admin_write on public.sellers
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
grant select on public.sellers to anon, authenticated;
grant insert, update, delete on public.sellers to authenticated;

-- ── cards: consignment columns ─────────────────────────────────────────────
alter table public.cards add column if not exists consignor_id uuid references auth.users(id) on delete set null;
alter table public.cards add column if not exists consign_status text
  check (consign_status in ('submitted','approved','rejected','received','listed','sold','paid','withdraw_requested','withdrawn'));
alter table public.cards add column if not exists asking_price int;
alter table public.cards add column if not exists consign_note text;
create index if not exists cards_consignor_idx on public.cards (consignor_id);

-- Guard trigger: sellers may only touch their own consignments, may never set commerce fields,
-- and may only move consign_status along the allowed edges. Admins + service role pass.
create or replace function public.cards_consignor_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin(auth.uid()) then
    return new; -- service role / admin: unrestricted
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
  -- UPDATE: owner check on the old row, commerce fields frozen
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
      return new; -- ask for the card back
    elsif old.consign_status = 'rejected' and new.consign_status = 'submitted' then
      return new; -- fix and resubmit
    end if;
    raise exception 'transition % -> % is not yours to make', old.consign_status, new.consign_status;
  end if;
  if old.consign_status not in ('submitted','rejected') then
    raise exception 'card is locked once approved — ask Chris for changes';
  end if;
  return new;
end; $$;

drop trigger if exists cards_consignor_guard on public.cards;
create trigger cards_consignor_guard before insert or update on public.cards
  for each row execute function public.cards_consignor_guard();

drop policy if exists cards_seller_insert on public.cards;
create policy cards_seller_insert on public.cards
  for insert with check (public.is_seller(auth.uid()) and consignor_id = auth.uid());
drop policy if exists cards_seller_update on public.cards;
create policy cards_seller_update on public.cards
  for update using (public.is_seller(auth.uid()) and consignor_id = auth.uid())
  with check (public.is_seller(auth.uid()) and consignor_id = auth.uid());
drop policy if exists cards_seller_delete on public.cards;
create policy cards_seller_delete on public.cards
  for delete using (consignor_id = auth.uid() and consign_status in ('submitted','rejected'));

-- ── customer view: only floor-ready consignments, with a display first name ─
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
              then (select split_part(coalesce(p.display_name, ''), ' ', 1) from public.profiles p where p.id = consignor_id)
         end as consignor_display
  from public.cards
  where consignor_id is null or consign_status in ('listed','sold','paid');
grant select on public.cards_public to anon, authenticated;

-- ── payouts ────────────────────────────────────────────────────────────────
create table if not exists public.payouts (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid references auth.users(id) on delete set null,
  seller_handle text,                -- snapshot; the obligation survives account deletion
  card_id text not null,
  order_id uuid not null,
  sale_price int not null,
  split_pct int not null,
  amount int not null,
  test_mode boolean not null,
  status text not null default 'owed' check (status in ('owed','paid','void')),
  method text,
  reference text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (card_id, order_id)
);
alter table public.payouts enable row level security;
drop policy if exists payouts_self_read on public.payouts;
create policy payouts_self_read on public.payouts
  for select using (auth.uid() = seller_id or public.is_admin(auth.uid()));
drop policy if exists payouts_admin_update on public.payouts;
create policy payouts_admin_update on public.payouts
  for update using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
grant select, update on public.payouts to authenticated;

-- ── storage: sellers upload scans under consign/{uid}/ ─────────────────────
drop policy if exists card_images_seller_write on storage.objects;
create policy card_images_seller_write on storage.objects
  for insert with check (
    bucket_id = 'card-images'
    and public.is_seller(auth.uid())
    and (storage.foldername(name))[1] = 'consign'
    and (storage.foldername(name))[2] = auth.uid()::text
  );
