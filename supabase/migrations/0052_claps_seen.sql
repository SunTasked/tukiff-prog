-- Claps notification on the Messages page: nothing is stored but the moment the user last read their claps.
-- Existing users start from now, so the first notification is not every clap ever received.
alter table public.profiles add column claps_seen_at timestamptz not null default now();
grant update (claps_seen_at) on public.profiles to authenticated;

-- Members who clapped my scores (team scores included: a team clap is stored on one teammate's row) since I last read them.
create function public.new_clappers() returns int
language sql stable security definer set search_path = '' as $$
  select count(distinct c.from_user)::int
  from public.result_claps c
  join public.results r on r.id = c.result_id
  where c.created_at > (select claps_seen_at from public.profiles where id = (select auth.uid()))
    and c.from_user <> (select auth.uid())
    and (r.athlete_id = (select auth.uid())
      or r.team_id in (select team_id from public.results where athlete_id = (select auth.uid()) and team_id is not null))
$$;
revoke execute on function public.new_clappers() from anon, public;
grant execute on function public.new_clappers() to authenticated;
