-- Account lifecycle: enrollment tracking, access removal, self-deletion, nightly cleanup.

-- Set the first time an invitation grants a role. null = enrollment never completed.
alter table public.profiles add column enrolled_at timestamptz;
update public.profiles set enrolled_at = created_at where role is not null;

create or replace function public.accept_invitation(p_code text) returns text
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
    update public.profiles
      set role = new_role, enrolled_at = coalesce(enrolled_at, now())
      where id = auth.uid();
    update public.invitations set uses = uses + 1 where id = inv.id;
  end if;

  return new_role;
end $$;

-- Coach removes a member's access (data kept, member can be re-invited).
create function public.remove_member(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_coach() then
    raise exception 'forbidden';
  end if;
  if p_user = auth.uid() then
    raise exception 'cannot_remove_self';
  end if;
  update public.profiles set role = null where id = p_user;
end $$;

-- A user deletes their own account and all their data (cascades from auth.users).
create function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if (select role from public.profiles where id = auth.uid()) = 'coach'
     and (select count(*) from public.profiles where role = 'coach') = 1 then
    raise exception 'last_coach';
  end if;
  delete from auth.users where id = auth.uid();
end $$;

revoke execute on function public.remove_member(uuid) from anon, public;
revoke execute on function public.delete_my_account() from anon, public;
grant execute on function public.remove_member(uuid) to authenticated;
grant execute on function public.delete_my_account() to authenticated;

-- Nightly cleanup (not exposed through the API: internal schema).
create function internal.cleanup_enrollment() returns void
language sql security definer set search_path = '' as $$
  delete from public.invitations
    where expires_at < now() or revoked_at is not null;
  -- Accounts created by an invitation but never enrolled; 7 days = longest invitation validity.
  delete from auth.users u
    using public.profiles p
    where p.id = u.id and p.enrolled_at is null and u.created_at < now() - interval '7 days';
$$;

create extension if not exists pg_cron;
select cron.schedule('cleanup-enrollment', '17 3 * * *', 'select internal.cleanup_enrollment()');
