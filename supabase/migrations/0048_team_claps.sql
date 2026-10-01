-- Claps on team WODs (0045 + 0047): a clap goes to the whole team, stored on one teammate's row. Every teammate
-- sees who clapped their team, and nobody claps their own team.
drop policy "claps: read mine or received" on public.result_claps;
create policy "claps: read mine or received" on public.result_claps for select to authenticated using (
  from_user = auth.uid()
  or exists (
    select 1 from public.results r
    where r.id = result_id and (r.athlete_id = auth.uid() or (r.team_id is not null and public.in_my_team(r.team_id)))
  )
);

drop policy "claps: insert own" on public.result_claps;
create policy "claps: insert own" on public.result_claps for insert to authenticated with check (
  from_user = auth.uid()
  and exists (
    select 1 from public.results r
    where r.id = result_id and r.workout_id = result_claps.workout_id and r.athlete_id <> auth.uid()
      and (r.team_id is null or not public.in_my_team(r.team_id))
      and public.can_see_block(r.block_id)
  )
  and public.can_see_workout(workout_id)
  and public.leaderboard_on(workout_id)
  and exists (
    select 1 from public.workouts w join public.programs p on p.id = w.program_id
    where w.id = result_claps.workout_id and p.reactions_enabled
  )
);
