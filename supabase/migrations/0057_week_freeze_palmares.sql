-- Weeks close on Sunday 23:59:59, Paris time: scores, "Fait" and "Je passe" are then frozen for athletes. The
-- program's coaches and the admins can still correct them.
-- Palmarès computed from the closed weeks: weeks as leader of a weekly leaderboard, blocks won, crown.

-- Monday 00:00 (Paris) after the week of `p_date`: when that week closes.
create function public.week_end(p_date date) returns timestamptz
language sql immutable set search_path = '' as $$
  select ((p_date - (extract(isodow from p_date)::int - 1) + 7)::timestamp at time zone 'Europe/Paris')
$$;

create function internal.freeze_closed_week() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_row record := case when tg_op = 'DELETE' then old else new end;
  v_date date := (select date from public.workouts where id = v_row.workout_id);
begin
  -- Scripts (no user), deleted workouts or blocks (cascade), coaches of the program and admins: never frozen.
  if (select auth.uid()) is null or v_date is null or now() < public.week_end(v_date)
    or public.can_edit_workout(v_row.workout_id) or public.is_admin()
    or (tg_op = 'DELETE' and not exists (select 1 from public.workout_blocks where id = v_row.block_id)) then
    return v_row;
  end if;
  raise exception 'Semaine terminée : les scores sont figés.';
end $$;

create trigger results_freeze before insert or update or delete on public.results
  for each row execute function internal.freeze_closed_week();
create trigger block_skips_freeze before insert or update or delete on public.block_skips
  for each row execute function internal.freeze_closed_week();

-- Weekly leaderboards of the closed weeks, the same rules as the app (src/domain/scoring.ts, weeklyLeaderboards):
-- per program (leaderboard on) and gender, on each ranked solo block of the published workouts of the week, the RX
-- rank is worth 10 points for the 1st down to 1 for the 10th; the total is the sum of the 3 best blocks; a multi-day
-- workout (challenge) gives no points and only breaks ties. Counted from the week of 2026-09-28.
create function internal.closed_weeks(p_now timestamptz default now()) returns table (
  program_id uuid, week date, gender text, athlete_id uuid, total int, rank int, board_size int, wins int
)
language sql stable security definer set search_path = '' as $$
  with blocks as (
    select b.id, w.program_id, w.date - (extract(isodow from w.date)::int - 1) as week, w.days > 1 as bonus,
      coalesce(b.params->>'score', case b.format when 'for_time' then 'time' when 'amrap' then 'rounds_reps'
        when 'sets_reps' then 'load' when 'tabata' then 'reps' else 'none' end) as stype
    from public.workout_blocks b
    join public.workouts w on w.id = b.workout_id
    join public.programs p on p.id = w.program_id and p.leaderboard_enabled
    where w.date >= '2026-09-28' and w.publish_at <= p_now and p_now >= public.week_end(w.date)
      and coalesce((b.params->>'min_level')::int, 0) = 0
      and coalesce(b.params->>'ranked', 'true') <> 'false'
      and coalesce((b.params->>'team_size')::int, 0) = 0
  ),
  placed as (
    select b.id as block_id, b.program_id, b.week, b.bonus, r.athlete_id, coalesce(pr.gender, 'male') as gender,
      rank() over (partition by b.id, coalesce(pr.gender, 'male') order by
        case when b.stype = 'time' then r.capped::int end,
        case when b.stype = 'time' and not r.capped then r.time_s end asc nulls last,
        case when b.stype = 'rounds_reps' then r.rounds end desc nulls last,
        case when b.stype = 'reps' or b.stype = 'rounds_reps' or (b.stype = 'time' and r.capped) then r.reps end desc nulls last,
        case when b.stype = 'load' then r.load_kg end desc nulls last
      )::int as place,
      count(*) over (partition by b.id, coalesce(pr.gender, 'male'))::int as block_size
    from blocks b
    join public.results r on r.block_id = b.id and r.rx
    left join public.profiles pr on pr.id = r.athlete_id
    where b.stype <> 'none'
  ),
  best as (
    select *, row_number() over (partition by program_id, week, gender, athlete_id, bonus order by place) as nth
    from placed
  ),
  totals as (
    select program_id, week, gender, athlete_id,
      coalesce(sum(greatest(0, 11 - place)) filter (where not bonus and nth <= 3), 0)::int as total,
      min(place) filter (where bonus) as tiebreak,
      count(*) filter (where not bonus and place = 1 and block_size >= 3)::int as wins
    from best
    group by 1, 2, 3, 4
  )
  select program_id, week, gender, athlete_id, total,
    rank() over (partition by program_id, week, gender order by total desc, tiebreak asc nulls last)::int,
    count(*) over (partition by program_id, week, gender)::int,
    wins
  from totals
$$;
revoke execute on function internal.closed_weeks(timestamptz) from anon, public;

-- Palmarès of every athlete who has one: weeks as leader (at most 1 a week, boards of 3 athletes or more), blocks won
-- (1st in RX among 3 or more, ties included, challenges and team blocks aside) and the crown (30 points last week).
-- Counters of the others are only given to coaches and admins; the crown to everyone.
create function public.palmares() returns table (athlete_id uuid, leader_weeks int, wins int, crown boolean)
language sql stable security definer set search_path = '' as $$
  with s as (select * from internal.closed_weeks()),
  today as (select (now() at time zone 'Europe/Paris')::date as d),
  last_week as (select d - (extract(isodow from d)::int - 1) - 7 as week from today)
  select s.athlete_id,
    case when mine or staff then (count(distinct s.week) filter (where s.rank = 1 and s.board_size >= 3))::int end,
    case when mine or staff then sum(s.wins)::int end,
    bool_or(s.week = (select week from last_week) and s.total >= 30 and s.board_size >= 3)
  from s,
    lateral (select s.athlete_id = (select auth.uid()) as mine, (select public.is_coach()) or (select public.is_admin()) as staff) v
  group by s.athlete_id, mine, staff
$$;
revoke execute on function public.palmares() from anon, public;
grant execute on function public.palmares() to authenticated;
