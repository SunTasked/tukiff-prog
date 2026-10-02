-- Benchmark leaderboards: every member's benchmark records for one library session (records are otherwise own-only).
-- The best per athlete and block is picked client-side.
create function public.benchmark_board(p_workout uuid)
returns table (block_id uuid, athlete_id uuid, score_type text, time_s numeric, rounds int, reps int, load_kg numeric,
               date date, gender text, first_name text, last_name text, display_name text)
language sql stable security definer set search_path = '' as $$
  select r.block_id, r.athlete_id, r.score_type, r.time_s, r.rounds, r.reps, r.load_kg, r.date,
         p.gender, p.first_name, p.last_name, p.display_name
  from public.personal_records r
  join public.profiles p on p.id = r.athlete_id
  where r.workout_id = p_workout and r.block_id is not null and (select public.is_member())
$$;
revoke execute on function public.benchmark_board(uuid) from anon, public;
grant execute on function public.benchmark_board(uuid) to authenticated;
