-- Last access per member for the Communauté page (coaches and admins).
-- usage_last_seen (0026) is updated on every app launch / resume; auth last_sign_in_at covers members
-- not seen since tracking started. The most recent of both wins.
create function public.members_last_seen() returns table (user_id uuid, last_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (public.is_coach() or public.is_admin()) then raise exception 'forbidden'; end if;
  return query
    select p.id, nullif(greatest(coalesce(s.last_at, '-infinity'), coalesce(u.last_sign_in_at, '-infinity')), '-infinity')
    from public.profiles p
    left join public.usage_last_seen s on s.user_id = p.id
    left join auth.users u on u.id = p.id
    where p.role is not null;
end $$;

revoke execute on function public.members_last_seen() from anon, public;
grant execute on function public.members_last_seen() to authenticated;
