-- Leaderboard can be turned off per program (owner setting). Off = athletes only see their own score;
-- the program's coaches still see everyone's.
alter table public.programs add column leaderboard_enabled boolean not null default true;

create function public.leaderboard_on(p_workout uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select p.leaderboard_enabled from public.workouts w join public.programs p on p.id = w.program_id
    where w.id = p_workout
  ), true)
$$;

drop policy "results: read" on public.results;
create policy "results: read" on public.results for select to authenticated using (
  athlete_id = auth.uid()
  or public.can_edit_workout(workout_id)
  or (public.shares_scores(athlete_id) and public.can_see_workout(workout_id) and public.leaderboard_on(workout_id))
);
