-- Scores are always shared (user decision 2026-09-28): drop the per-athlete opt-in.
-- Athletes still see only their own score when the program leaderboard is off.
drop policy "results: read" on public.results;
create policy "results: read" on public.results for select to authenticated using (
  athlete_id = auth.uid()
  or public.can_edit_workout(workout_id)
  or (public.can_see_workout(workout_id) and public.leaderboard_on(workout_id))
);
drop function public.shares_scores(uuid);
alter table public.profiles drop column share_scores;
