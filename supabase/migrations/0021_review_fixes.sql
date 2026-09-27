-- Pre-production review fixes.

-- Nightly cleanup: only delete accounts that never got a role (abandoned invitations),
-- not members created by the admin script without enrolled_at.
update public.profiles set enrolled_at = coalesce(enrolled_at, created_at) where role is not null;

create or replace function internal.cleanup_enrollment() returns void
language sql security definer set search_path = '' as $$
  delete from public.invitations
    where expires_at < now() or revoked_at is not null;
  -- Accounts created by an invitation but never enrolled; 7 days = longest invitation validity.
  delete from auth.users u
    using public.profiles p
    where p.id = u.id and p.role is null and p.enrolled_at is null and u.created_at < now() - interval '7 days';
$$;

-- Invitations: a coach sees and edits only their own links; admins see and edit all of them.
drop policy "invitations: coach read" on public.invitations;
create policy "invitations: coach read" on public.invitations
  for select to authenticated using (public.is_coach() and (created_by = auth.uid() or public.is_admin()));
drop policy "invitations: coach update" on public.invitations;
create policy "invitations: coach update" on public.invitations
  for update to authenticated
  using (public.is_coach() and (created_by = auth.uid() or public.is_admin()))
  with check (public.is_coach() and (created_by = auth.uid() or public.is_admin()));

-- Deleting an exercise must not erase athletes' records: refuse while a record uses it.
alter table public.personal_records drop constraint personal_records_exercise_id_fkey;
alter table public.personal_records add constraint personal_records_exercise_id_fkey
  foreign key (exercise_id) references public.exercises on delete restrict;

-- A deleted account never leaves programs without an owner, whatever the path
-- (app, admin script, dashboard, nightly cleanup): they go to the app owner.
create function internal.hand_over_on_delete() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform internal.hand_over_programs(old.id, (select id from public.profiles where is_app_owner and id <> old.id));
  return old;
end $$;
create trigger hand_over_on_delete before delete on public.profiles
  for each row execute function internal.hand_over_on_delete();

-- Programs left without owner before this migration: give them to the app owner.
update public.programs set owner_id = (select id from public.profiles where is_app_owner)
  where owner_id is null;

-- An admin cannot change their own role (they would keep programs as an athlete).
create or replace function public.set_member_role(p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  target public.profiles;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_user = auth.uid() then raise exception 'cannot_change_self'; end if;
  if p_role not in ('athlete', 'coach', 'admin') then raise exception 'invalid_role'; end if;
  select * into target from public.profiles where id = p_user and role is not null for update;
  if not found then raise exception 'not_a_member'; end if;
  if target.is_app_owner then raise exception 'app_owner'; end if;
  if target.is_admin and p_role <> 'admin'
     and (select count(*) from public.profiles where is_admin) = 1 then
    raise exception 'last_admin';
  end if;

  if p_role = 'athlete' and target.role = 'coach' then
    perform internal.hand_over_programs(p_user, auth.uid());
  end if;
  update public.profiles
    set role = case when p_role = 'athlete' then 'athlete' else 'coach' end,
        is_admin = (p_role = 'admin')
    where id = p_user;
end $$;
