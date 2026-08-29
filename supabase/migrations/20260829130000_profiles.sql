-- Visitor profiles: one row per auth user, maintained by triggers on auth.users so the
-- admin panel's Users tab can show who's visited (and promote them to admin).

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  provider text,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  visits int not null default 1
);

create or replace function public.sync_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url, provider, first_seen, last_seen, visits)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(coalesce(new.email, ''), '@', 1)),
    new.raw_user_meta_data->>'avatar_url',
    coalesce(new.raw_app_meta_data->>'provider', 'email'),
    coalesce(new.created_at, now()),
    coalesce(new.last_sign_in_at, now()),
    1
  )
  on conflict (id) do update set
    email = excluded.email,
    display_name = coalesce(excluded.display_name, public.profiles.display_name),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    provider = excluded.provider,
    last_seen = coalesce(new.last_sign_in_at, now()),
    visits = public.profiles.visits + 1;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.sync_profile();

drop trigger if exists on_auth_user_signin on auth.users;
create trigger on_auth_user_signin after update of last_sign_in_at on auth.users
  for each row when (old.last_sign_in_at is distinct from new.last_sign_in_at)
  execute function public.sync_profile();

-- backfill everyone who signed in before this existed
insert into public.profiles (id, email, display_name, avatar_url, provider, first_seen, last_seen, visits)
select u.id, u.email,
       coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(coalesce(u.email, ''), '@', 1)),
       u.raw_user_meta_data->>'avatar_url',
       coalesce(u.raw_app_meta_data->>'provider', 'email'),
       u.created_at, coalesce(u.last_sign_in_at, u.created_at), 1
from auth.users u
on conflict (id) do nothing;

alter table public.profiles enable row level security;

drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles
  for select using (auth.uid() = id or public.is_admin(auth.uid()));
-- no client writes: the triggers own this table

grant select on public.profiles to authenticated;
