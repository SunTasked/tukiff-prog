-- Access level granted with each program of an invitation link (0 = Base).
alter table public.invitation_programs add column level smallint not null default 0 check (level between 0 and 9);

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

  -- Already a member: keeps the higher of the two levels.
  insert into public.program_members (program_id, user_id, level)
    select ip.program_id, auth.uid(), ip.level from public.invitation_programs ip where ip.invitation_id = inv.id
    on conflict (program_id, user_id) do update set level = excluded.level
      where public.program_members.level < excluded.level;
  get diagnostics added = row_count;

  if new_role is distinct from current_role_ or added > 0 then
    update public.invitations set uses = uses + 1 where id = inv.id;
  end if;

  return new_role;
end $$;
