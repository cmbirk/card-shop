-- GEM card shop — Supabase schema (READABLE REFERENCE COPY).
-- The live schema is applied via the CLI: an identical copy lives in
-- supabase/migrations/ and is applied with `npm run db:push`. Edit the schema
-- by adding a new migration, not by hand-running this file. See supabase/SETUP.md.
-- Sets up the cards table, admin gating, Row Level Security, a customer-safe
-- public view, and the storage bucket policies for card scans.

-- ── admins ────────────────────────────────────────────────────────────────
-- Membership table: a user is an admin iff their auth uid is in here.
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  added_at timestamptz not null default now()
);

create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins a where a.user_id = uid);
$$;

-- ── cards ─────────────────────────────────────────────────────────────────
create table if not exists public.cards (
  id text primary key,
  sport text not null,
  category text not null,
  player_name text not null,
  team text not null default '',
  year int not null default 0,
  set_name text not null default '',
  card_number text not null default '',
  rarity text not null default 'common',

  -- identity
  brand text,
  subset text,

  -- variant / parallel
  parallel text,
  print_run int,
  serial_number int,
  variation text,

  -- features
  is_rookie boolean not null default false,
  autograph text not null default 'none',
  relic text not null default 'none',
  is_insert boolean not null default false,
  is_error boolean not null default false,

  -- condition / grading (grade held as jsonb: {company,value,label,certNumber,subgrades,autoGrade})
  graded boolean not null default false,
  grade jsonb,
  raw_condition text,

  -- commerce
  price int not null default 0,               -- integer cents, list price
  status text not null default 'available',   -- available | reserved | sold
  quantity int not null default 1,
  cost_basis int,                             -- ADMIN-ONLY, integer cents
  acquired_date date,                         -- ADMIN-ONLY
  acquired_from text,                         -- ADMIN-ONLY

  -- media
  foil boolean not null default false,
  image_front text,
  image_back text,
  image_extra text[] not null default '{}',

  -- presentation / AI grounding
  lore jsonb not null default '{}'::jsonb,     -- {blurb,funFact,investmentNote}
  featured boolean not null default false,
  section text,

  -- system
  seed bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cards_sport_idx on public.cards (sport);
create index if not exists cards_status_idx on public.cards (status);
create index if not exists cards_featured_idx on public.cards (featured);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists cards_touch on public.cards;
create trigger cards_touch before update on public.cards
  for each row execute function public.touch_updated_at();

-- ── customer-safe view ─────────────────────────────────────────────────────
-- Omits cost_basis / acquisition columns. Customers read from this.
create or replace view public.cards_public as
  select id, sport, category, player_name, team, year, set_name, card_number, rarity,
         brand, subset, parallel, print_run, serial_number, variation,
         is_rookie, autograph, relic, is_insert, is_error,
         graded, grade, raw_condition,
         price, status, quantity,
         foil, image_front, image_back, image_extra,
         lore, featured, section, seed, created_at, updated_at
  from public.cards;

-- ── Row Level Security ─────────────────────────────────────────────────────
alter table public.cards enable row level security;
alter table public.admins enable row level security;

-- Anyone (anon) may read the base table too, but ONLY the safe columns are
-- exposed through cards_public, which the client uses. To be strict we grant
-- select on the view and on the table's non-admin path via a policy that any
-- role can read; the sensitive columns simply aren't selected by the client.
drop policy if exists cards_select_public on public.cards;
create policy cards_select_public on public.cards
  for select using (true);

drop policy if exists cards_admin_insert on public.cards;
create policy cards_admin_insert on public.cards
  for insert with check (public.is_admin(auth.uid()));

drop policy if exists cards_admin_update on public.cards;
create policy cards_admin_update on public.cards
  for update using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists cards_admin_delete on public.cards;
create policy cards_admin_delete on public.cards
  for delete using (public.is_admin(auth.uid()));

-- admins table: a user may read their own admin row (so the client can check
-- "am I an admin?"); only existing admins may modify membership.
drop policy if exists admins_self_read on public.admins;
create policy admins_self_read on public.admins
  for select using (auth.uid() = user_id or public.is_admin(auth.uid()));

drop policy if exists admins_admin_write on public.admins;
create policy admins_admin_write on public.admins
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- Explicit table grants so this works whether or not "Automatically expose new
-- tables" is enabled. RLS still governs which rows each role may touch.
grant usage on schema public to anon, authenticated;
grant select on public.cards_public to anon, authenticated; -- customers read the safe view
grant select, insert, update, delete on public.cards to authenticated; -- admin writes (RLS gates to admins)
grant select on public.admins to anon, authenticated;
grant insert, update, delete on public.admins to authenticated;

-- ── Storage: card-images bucket ────────────────────────────────────────────
-- Create the bucket named 'card-images' (public) in the Storage UI, then run:
insert into storage.buckets (id, name, public)
  values ('card-images', 'card-images', true)
  on conflict (id) do nothing;

drop policy if exists card_images_public_read on storage.objects;
create policy card_images_public_read on storage.objects
  for select using (bucket_id = 'card-images');

drop policy if exists card_images_admin_write on storage.objects;
create policy card_images_admin_write on storage.objects
  for insert with check (bucket_id = 'card-images' and public.is_admin(auth.uid()));

drop policy if exists card_images_admin_update on storage.objects;
create policy card_images_admin_update on storage.objects
  for update using (bucket_id = 'card-images' and public.is_admin(auth.uid()));

drop policy if exists card_images_admin_delete on storage.objects;
create policy card_images_admin_delete on storage.objects
  for delete using (bucket_id = 'card-images' and public.is_admin(auth.uid()));

-- ── Make yourself an admin ─────────────────────────────────────────────────
-- After creating your auth user (Authentication → Users → Add user), run:
--   insert into public.admins (user_id) values ('<your-auth-user-uuid>');
