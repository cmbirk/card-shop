-- Shipping addresses live on profiles, not in env. Each user may edit ONLY their own
-- ship_address (column-level grant + self-row policy); everything else on profiles stays
-- trigger-owned. Used for: where sellers ship approved consignments (the approving admin's
-- address) and where Chris returns withdrawn cards (the seller's address).
alter table public.profiles add column if not exists ship_address text;

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
-- the column grant is the fence: only ship_address is updatable by clients
grant update (ship_address) on public.profiles to authenticated;
