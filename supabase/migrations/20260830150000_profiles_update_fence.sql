-- Supabase's default privileges grant blanket UPDATE on new tables to authenticated, which
-- made the ship_address column grant meaningless (any self-row column was writable). Revoke
-- the blanket grant and re-grant ONLY ship_address.
revoke update on public.profiles from anon, authenticated;
grant update (ship_address) on public.profiles to authenticated;
