-- Emoji reactions on blocks removed (UI gone): drop the table. The admin stats count claps instead.
-- programs.reactions_enabled stays: it now only toggles claps.
-- Claps: whoever can read a score can see who clapped it (long press on 👏), not only its athlete.

create or replace function public.admin_usage() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  tz constant text := 'Europe/Paris';
  today date := (now() at time zone tz)::date;
  since timestamptz := (today - 6)::timestamp at time zone tz;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;

  return jsonb_build_object(
    'members', (select count(*) from public.profiles where role is not null),
    'active_1d', (select count(distinct user_id) from public.usage_events where (at at time zone tz)::date = today),
    'active_7d', (select count(distinct user_id) from public.usage_events where at >= since),
    'sessions', (select count(*) from public.usage_events where at >= since and kind = 'session'),
    'standalone_sessions', (select count(*) from public.usage_events
                              where at >= since and kind = 'session' and key = 'standalone'),
    'views', (select count(*) from public.usage_events where at >= since and kind = 'view'),
    'avg_launch_ms', (select round(avg(ms)) from public.usage_events where at >= since and kind = 'load'),
    'avg_view_ms', (select round(avg(ms)) from public.usage_events where at >= since and kind = 'view'),
    'scores', (select count(*) from public.results where created_at >= since),
    'scorers', (select count(distinct athlete_id) from public.results where created_at >= since),
    'claps', (select count(*) from public.result_claps where created_at >= since),
    'records', (select count(*) from public.personal_records where created_at >= since),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'users', coalesce(a.users, 0), 'views', coalesce(a.views, 0))
                                order by d.day), '[]')
      from (select (today - i) as day from generate_series(0, 6) as i) d
      left join (
        select (at at time zone tz)::date as day, count(distinct user_id) as users, count(*) filter (where kind = 'view') as views
        from public.usage_events where at >= since group by 1
      ) a on a.day = d.day
    ),
    -- Screen load times per 10-minute slot over the last 7 x 24 h (slot = start); empty slots are omitted.
    'load_slots', (
      select coalesce(jsonb_agg(jsonb_build_object('at', x.slot, 'avg_ms', x.avg_ms, 'max_ms', x.max_ms, 'n', x.n)
                                order by x.slot), '[]')
      from (
        select to_timestamp(floor(extract(epoch from at) / 600) * 600) as slot,
          round(avg(ms)) as avg_ms, max(ms) as max_ms, count(*) as n
        from public.usage_events where at >= now() - interval '7 days' and kind = 'view' and ms is not null group by 1
      ) x
    ),
    'users', (
      select coalesce(jsonb_agg(to_jsonb(x) order by x.last_at desc nulls last, x.display_name), '[]')
      from (
        select p.id, p.display_name, p.role, p.is_admin, p.avatar_url, s.last_at,
          count(*) filter (where e.kind = 'session') as sessions,
          count(*) filter (where e.kind = 'view') as views,
          count(distinct (e.at at time zone tz)::date) as active_days,
          (select count(*) from public.results where athlete_id = p.id and created_at >= since) as scores
        from public.profiles p
        left join public.usage_last_seen s on s.user_id = p.id
        left join public.usage_events e on e.user_id = p.id and e.at >= since
        where p.role is not null
        group by p.id, s.last_at
      ) x
    ),
    'pages', (
      select coalesce(jsonb_agg(to_jsonb(x) order by x.views desc), '[]')
      from (
        select key, count(*) as views, count(distinct user_id) as users, round(avg(ms)) as avg_ms
        from public.usage_events where at >= since and kind = 'view' group by key
      ) x
    ),
    'errors', (
      select coalesce(jsonb_agg(to_jsonb(x) order by x.last_at desc), '[]')
      from (
        select key, count(*) as count, count(distinct user_id) as users, max(at) as last_at
        from public.usage_events where at >= since and kind = 'error' group by key
        order by max(at) desc limit 20
      ) x
    )
  );
end $$;

drop table public.block_reactions;

drop policy "claps: read mine or received" on public.result_claps;
create policy "claps: read on visible scores" on public.result_claps for select to authenticated using (
  from_user = auth.uid()
  -- results RLS applies inside the subquery: the scores the caller can read.
  or exists (select 1 from public.results r where r.id = result_id)
  or exists (
    select 1 from public.results r
    where r.id = result_id and r.team_id is not null and public.in_my_team(r.team_id)
  )
);
