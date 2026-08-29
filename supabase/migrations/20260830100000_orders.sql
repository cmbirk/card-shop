-- Stripe checkout: orders + atomic card reservation. All writes happen server-side (service role);
-- customers can only read their own orders.

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_session_id text unique,
  stripe_payment_intent text,
  items jsonb not null,                -- [{id, playerName, year, setName, cardNumber, price}] snapshot at checkout
  total int not null,                  -- integer cents
  status text not null check (status in ('pending', 'paid', 'canceled', 'expired')),
  test_mode boolean not null default true,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index if not exists orders_user_idx on public.orders (user_id, created_at desc);

alter table public.cards add column if not exists reserved_until timestamptz;
alter table public.cards add column if not exists reserved_order uuid;

-- Reserve the cards for an order, atomically: only cards that are available (or whose previous
-- reservation has lapsed) are taken. Returns the ids actually reserved — the caller compares.
create or replace function public.reserve_cards(ids text[], order_id uuid, ttl interval)
returns setof text language sql security definer set search_path = public as $$
  update public.cards
     set status = 'reserved', reserved_until = now() + ttl, reserved_order = order_id
   where id = any(ids)
     and (status = 'available' or (status = 'reserved' and reserved_until < now()))
  returning id;
$$;

-- Put an order's cards back on the floor (cancel / expiry / failed reserve).
create or replace function public.release_order(order_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.cards
     set status = 'available', reserved_until = null, reserved_order = null
   where reserved_order = order_id and status = 'reserved';
$$;

revoke all on function public.reserve_cards(text[], uuid, interval) from public, anon, authenticated;
revoke all on function public.release_order(uuid) from public, anon, authenticated;

alter table public.orders enable row level security;
drop policy if exists orders_self_read on public.orders;
create policy orders_self_read on public.orders
  for select using (auth.uid() = user_id or public.is_admin(auth.uid()));
grant select on public.orders to authenticated;
