-- M1: profiles (coach / athlete) and invitations.
-- A coach is also an athlete (can log scores). role null = account without access yet.

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text check (char_length(display_name) between 1 and 40),
  role text check (role in ('coach', 'athlete')),
  share_scores boolean not null default false,
  created_at timestamptz not null default now()
);

-- Helpers used by RLS policies (security definer to avoid recursive RLS on profiles).
create function public.my_role() returns text
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = auth.uid()
$$;

create function public.is_coach() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select role = 'coach' from public.profiles where id = auth.uid()), false)
$$;

create function public.is_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role is not null)
$$;

-- Profile row created automatically on sign-up.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;

create policy "profiles: read own or as member" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_member());

create policy "profiles: update own" on public.profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Users may only edit these columns themselves; role changes go through RPCs / admin.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (display_name, share_scores) on public.profiles to authenticated;

-- Invitations -----------------------------------------------------------------

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default substr(md5(gen_random_uuid()::text), 1, 10),
  role text not null default 'athlete' check (role in ('coach', 'athlete')),
  created_by uuid not null default auth.uid() references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  max_uses int check (max_uses > 0), -- null = unlimited
  uses int not null default 0,
  revoked_at timestamptz
);

alter table public.invitations enable row level security;

create policy "invitations: coach read" on public.invitations
  for select to authenticated using (public.is_coach());
create policy "invitations: coach insert" on public.invitations
  for insert to authenticated with check (public.is_coach() and created_by = auth.uid());
create policy "invitations: coach update" on public.invitations
  for update to authenticated using (public.is_coach()) with check (public.is_coach());

revoke update on public.invitations from authenticated;
grant update (revoked_at, expires_at) on public.invitations to authenticated;

-- Accepts an invitation for the current user. Never downgrades a coach.
create function public.accept_invitation(p_code text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  inv public.invitations;
  current_role_ text;
  new_role text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select * into inv from public.invitations
  where code = p_code
    and revoked_at is null
    and expires_at > now()
    and (max_uses is null or uses < max_uses)
  for update;

  if not found then
    raise exception 'invalid_invitation';
  end if;

  select role into current_role_ from public.profiles where id = auth.uid();
  new_role := case
    when current_role_ = 'coach' or inv.role = 'coach' then 'coach'
    else 'athlete'
  end;

  if new_role is distinct from current_role_ then
    update public.profiles set role = new_role where id = auth.uid();
    update public.invitations set uses = uses + 1 where id = inv.id;
  end if;

  return new_role;
end $$;

revoke execute on function public.accept_invitation(text) from anon, public;
grant execute on function public.accept_invitation(text) to authenticated;
