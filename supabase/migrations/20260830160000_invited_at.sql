-- Invite flow: the server (service role) stamps when a user was invited; a profile with
-- invited_at set and visits <= 1 renders as "invited · hasn't visited" in the Users tab.
alter table public.profiles add column if not exists invited_at timestamptz;
