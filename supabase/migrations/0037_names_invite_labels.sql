-- Member first / last name (shown on the member page; the nickname stays everywhere else),
-- invitation label (who a link is for), and the member email readable by admins only.
alter table public.profiles
  add column first_name text check (char_length(first_name) between 1 and 40),
  add column last_name text check (char_length(last_name) between 1 and 40);
grant update (first_name, last_name) on public.profiles to authenticated;

alter table public.invitations add column label text check (char_length(label) between 1 and 60);

-- Emails live in auth.users: exposed to admins only, one member at a time.
create function public.member_email(p_user uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return (select email from auth.users where id = p_user);
end $$;

revoke execute on function public.member_email(uuid) from anon, public;
grant execute on function public.member_email(uuid) to authenticated;

-- Pending sign-ups: invitation accepted but onboarding (first / last name) never completed.
-- Nickname is optional from now on; accounts from before this migration all have one.
alter table public.profiles add column invitation_id uuid references public.invitations on delete set null;

create function public.is_pending(p public.profiles) returns boolean
language sql immutable as $$
  select p.first_name is null and p.display_name is null
$$;

create or replace function public.accept_invitation(p_code text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  inv public.invitations;
  current_role_ text;
  new_role text;
  added int;
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

  update public.profiles
    set role = new_role, enrolled_at = coalesce(enrolled_at, now())
    where id = auth.uid() and role is distinct from new_role;
  -- Remembers the link used (its label names a sign-up still in progress).
  update public.profiles set invitation_id = inv.id where id = auth.uid() and invitation_id is null;

  insert into public.program_members (program_id, user_id)
    select ip.program_id, auth.uid() from public.invitation_programs ip where ip.invitation_id = inv.id
    on conflict do nothing;
  get diagnostics added = row_count;

  if new_role is distinct from current_role_ or added > 0 then
    update public.invitations set uses = uses + 1 where id = inv.id;
  end if;

  return new_role;
end $$;

-- A coach deletes a sign-up still in progress (the account and its link usage).
create function public.delete_pending_member(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  target public.profiles;
begin
  if not public.is_coach() then raise exception 'forbidden'; end if;
  select * into target from public.profiles where id = p_user for update;
  if not found or not public.is_pending(target) then raise exception 'not_pending'; end if;
  update public.invitations set uses = greatest(uses - 1, 0) where id = target.invitation_id;
  delete from auth.users where id = p_user;
end $$;

revoke execute on function public.delete_pending_member(uuid) from anon, public;
grant execute on function public.delete_pending_member(uuid) to authenticated;

-- Nightly cleanup: also drops sign-ups left unfinished for 7 days.
create or replace function internal.cleanup_enrollment() returns void
language sql security definer set search_path = '' as $$
  delete from public.invitations
    where expires_at < now() or revoked_at is not null;
  delete from auth.users u
    using public.profiles p
    where p.id = u.id and p.role is null and p.enrolled_at is null and u.created_at < now() - interval '7 days';
  delete from auth.users u
    using public.profiles p
    where p.id = u.id and p.first_name is null and p.display_name is null and not p.is_admin
      and u.created_at < now() - interval '7 days';
$$;
