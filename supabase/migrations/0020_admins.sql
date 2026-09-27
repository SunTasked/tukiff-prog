-- Admins: "super coaches" who manage roles and access. One app owner (never demoted, never removed).
alter table public.profiles add column is_admin boolean not null default false;
alter table public.profiles add column is_app_owner boolean not null default false;
alter table public.profiles add constraint admin_is_coach check (not is_admin or role = 'coach');
alter table public.profiles add constraint owner_is_admin check (not is_app_owner or is_admin);
create unique index one_app_owner on public.profiles (is_app_owner) where is_app_owner;

update public.profiles p set is_admin = true, is_app_owner = true
  from auth.users u where u.id = p.id and u.email = 'guillaume.kheng@gmail.com';

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

-- A coach loses coach rights: the programs they own go to p_heir, their contributions are removed.
create function internal.hand_over_programs(p_coach uuid, p_heir uuid) returns void
language sql security definer set search_path = '' as $$
  delete from public.program_coaches c using public.programs p
    where c.program_id = p.id and p.owner_id = p_coach and c.coach_id = p_heir;
  update public.programs set owner_id = p_heir where owner_id = p_coach;
  delete from public.program_coaches where coach_id = p_coach;
$$;

-- Admin: set a member's role ('athlete' | 'coach' | 'admin').
create function public.set_member_role(p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  target public.profiles;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
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

-- Admin only: remove a member's access (data kept, can be re-invited).
create or replace function public.remove_member(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  target public.profiles;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_user = auth.uid() then raise exception 'cannot_remove_self'; end if;
  select * into target from public.profiles where id = p_user for update;
  if target.is_app_owner then raise exception 'app_owner'; end if;
  if target.is_admin and (select count(*) from public.profiles where is_admin) = 1 then
    raise exception 'last_admin';
  end if;
  perform internal.hand_over_programs(p_user, auth.uid());
  update public.profiles set role = null, is_admin = false where id = p_user;
end $$;

-- Self deletion: the app owner and the last admin cannot leave; a coach's programs go to the app owner.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into me from public.profiles where id = auth.uid();
  if me.is_app_owner then raise exception 'app_owner'; end if;
  if me.is_admin and (select count(*) from public.profiles where is_admin) = 1 then
    raise exception 'last_admin';
  end if;
  perform internal.hand_over_programs(auth.uid(), (select id from public.profiles where is_app_owner));
  delete from auth.users where id = auth.uid();
end $$;

-- A program's owner hands it to another coach; the former owner stays as a contributor.
create function public.transfer_program(p_program uuid, p_new_owner uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.owns_program(p_program) then raise exception 'forbidden'; end if;
  if not exists (select 1 from public.profiles where id = p_new_owner and role = 'coach') then
    raise exception 'not_a_coach';
  end if;
  if p_new_owner = auth.uid() then return; end if;
  delete from public.program_coaches where program_id = p_program and coach_id = p_new_owner;
  update public.programs set owner_id = p_new_owner where id = p_program;
  insert into public.program_coaches (program_id, coach_id) values (p_program, auth.uid()) on conflict do nothing;
end $$;

revoke execute on function public.set_member_role(uuid, text) from anon, public;
revoke execute on function public.transfer_program(uuid, uuid) from anon, public;
grant execute on function public.set_member_role(uuid, text) to authenticated;
grant execute on function public.transfer_program(uuid, uuid) to authenticated;

-- Invitations: coaches create athlete links; only admins create coach links.
drop policy "invitations: coach insert" on public.invitations;
create policy "invitations: coach insert" on public.invitations
  for insert to authenticated with check (
    public.is_coach() and created_by = auth.uid() and (role = 'athlete' or public.is_admin())
  );
