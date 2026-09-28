-- Usage telemetry for the admin "Stats" tab. Raw events kept 7 days only (purged on write), read by admins only.
-- kind: 'session' (key = 'standalone' | 'browser'), 'view' (key = route pattern e.g. /workouts/:id,
--       ms = time until the screen's data is loaded), 'load' (ms = launch -> app usable), 'error' (key = message).
-- The last activity date is kept apart (one row per member) so it survives the 7-day purge.

create table public.usage_events (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  user_id uuid not null references public.profiles on delete cascade,
  kind text not null check (kind in ('session', 'view', 'load', 'error')),
  key text not null default '' check (char_length(key) <= 120),
  ms int check (ms between 0 and 120000)
);
create index on public.usage_events (at);
create index on public.usage_events (user_id, at);

create table public.usage_last_seen (
  user_id uuid primary key references public.profiles on delete cascade,
  last_at timestamptz not null default now()
);

alter table public.usage_events enable row level security;
alter table public.usage_last_seen enable row level security;
create policy "usage_events: admin read" on public.usage_events for select to authenticated using (public.is_admin());
create policy "usage_last_seen: admin read" on public.usage_last_seen for select to authenticated using (public.is_admin());
-- No write policy: members write only through track_usage().

create or replace function public.track_usage(p_kind text, p_key text default '', p_ms int default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_member() then return; end if;
  if p_kind not in ('session', 'view', 'load', 'error') then raise exception 'invalid_kind'; end if;
  insert into public.usage_events (user_id, kind, key, ms)
    values (auth.uid(), p_kind, left(coalesce(p_key, ''), 120), least(greatest(p_ms, 0), 120000));
  insert into public.usage_last_seen (user_id, last_at) values (auth.uid(), now())
    on conflict (user_id) do update set last_at = now();
  delete from public.usage_events where at < now() - interval '7 days';
end $$;

-- Admin dashboard: the last 7 calendar days (Paris), today included, in one call.
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
    'reactions', (select count(*) from public.block_reactions where created_at >= since),
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

revoke execute on function public.track_usage(text, text, int) from anon, public;
revoke execute on function public.admin_usage() from anon, public;
grant execute on function public.track_usage(text, text, int) to authenticated;
grant execute on function public.admin_usage() to authenticated;
