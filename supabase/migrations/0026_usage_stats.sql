-- Usage telemetry, aggregated per day / member / event: no raw event log, so the table stays small
-- (~30 members x a dozen screens x 365 days ≈ 100k rows a year). Read by admins only.
-- kind: 'session' (key = 'standalone' | 'browser'), 'view' (key = route pattern, e.g. /workouts/:id),
--       'load' (total_ms = time until the app is usable), 'error' (key = error message).

create table public.usage_daily (
  day date not null,
  user_id uuid not null references public.profiles on delete cascade,
  kind text not null check (kind in ('session', 'view', 'load', 'error')),
  key text not null default '' check (char_length(key) <= 120),
  count int not null default 0,
  total_ms bigint not null default 0,
  last_at timestamptz not null default now(),
  primary key (day, user_id, kind, key)
);
create index on public.usage_daily (user_id, last_at);

alter table public.usage_daily enable row level security;
create policy "usage_daily: admin read" on public.usage_daily for select to authenticated using (public.is_admin());
-- No write policy: members write only through track_usage().

create or replace function public.track_usage(p_kind text, p_key text default '', p_ms int default 0) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_member() then return; end if;
  if p_kind not in ('session', 'view', 'load', 'error') then raise exception 'invalid_kind'; end if;
  insert into public.usage_daily as u (day, user_id, kind, key, count, total_ms)
    values (
      (now() at time zone 'Europe/Paris')::date, auth.uid(), p_kind, left(coalesce(p_key, ''), 120), 1,
      least(greatest(coalesce(p_ms, 0), 0), 120000)
    )
  on conflict (day, user_id, kind, key) do update
    set count = u.count + 1, total_ms = u.total_ms + excluded.total_ms, last_at = now();
end $$;

-- Admin dashboard: everything over the last p_days days (Paris calendar days), in one call.
create or replace function public.admin_usage(p_days int default 30) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  today date := (now() at time zone 'Europe/Paris')::date;
  since date;
  since_ts timestamptz;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  p_days := least(greatest(coalesce(p_days, 30), 1), 365);
  since := today - (p_days - 1);
  since_ts := since::timestamp at time zone 'Europe/Paris';

  return jsonb_build_object(
    'days', p_days,
    'members', (select count(*) from public.profiles where role is not null),
    'active_1d', (select count(distinct user_id) from public.usage_daily where day = today),
    'active_7d', (select count(distinct user_id) from public.usage_daily where day > today - 7),
    'active_30d', (select count(distinct user_id) from public.usage_daily where day > today - 30),
    'active_period', (select count(distinct user_id) from public.usage_daily where day >= since),
    'sessions', (select coalesce(sum(count), 0) from public.usage_daily where day >= since and kind = 'session'),
    'standalone_sessions', (select coalesce(sum(count), 0) from public.usage_daily
                              where day >= since and kind = 'session' and key = 'standalone'),
    'views', (select coalesce(sum(count), 0) from public.usage_daily where day >= since and kind = 'view'),
    'avg_load_ms', (select round(sum(total_ms)::numeric / nullif(sum(count), 0)) from public.usage_daily
                      where day >= since and kind = 'load'),
    'scores', (select count(*) from public.results where created_at >= since_ts),
    'scorers', (select count(distinct athlete_id) from public.results where created_at >= since_ts),
    'reactions', (select count(*) from public.block_reactions where created_at >= since_ts),
    'records', (select count(*) from public.personal_records where created_at >= since_ts),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d.day::date, 'users', coalesce(a.users, 0), 'views', coalesce(a.views, 0))
                                order by d.day), '[]')
      from generate_series(since, today, interval '1 day') as g(ts), lateral (select g.ts::date as day) d
      left join (
        select day, count(distinct user_id) as users, sum(count) filter (where kind = 'view') as views
        from public.usage_daily where day >= since group by day
      ) a on a.day = d.day
    ),
    'users', (
      select coalesce(jsonb_agg(to_jsonb(x) order by x.last_at desc nulls last, x.display_name), '[]')
      from (
        select p.id, p.display_name, p.role, p.is_admin, p.avatar_url,
          (select max(last_at) from public.usage_daily where user_id = p.id) as last_at,
          coalesce(sum(u.count) filter (where u.kind = 'session'), 0) as sessions,
          coalesce(sum(u.count) filter (where u.kind = 'view'), 0) as views,
          count(distinct u.day) as active_days,
          (select count(*) from public.results where athlete_id = p.id and created_at >= since_ts) as scores
        from public.profiles p
        left join public.usage_daily u on u.user_id = p.id and u.day >= since
        where p.role is not null
        group by p.id
      ) x
    ),
    'pages', (
      select coalesce(jsonb_agg(to_jsonb(x) order by x.views desc), '[]')
      from (
        select key, sum(count) as views, count(distinct user_id) as users
        from public.usage_daily where day >= since and kind = 'view' group by key
      ) x
    ),
    'errors', (
      select coalesce(jsonb_agg(to_jsonb(x) order by x.last_at desc), '[]')
      from (
        select key, sum(count) as count, count(distinct user_id) as users, max(last_at) as last_at
        from public.usage_daily where day >= since and kind = 'error' group by key
        order by max(last_at) desc limit 20
      ) x
    )
  );
end $$;

revoke execute on function public.track_usage(text, text, int) from anon, public;
revoke execute on function public.admin_usage(int) from anon, public;
grant execute on function public.track_usage(text, text, int) to authenticated;
grant execute on function public.admin_usage(int) to authenticated;
