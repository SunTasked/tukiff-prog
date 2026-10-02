-- RLS performance: the policies called per-row helpers (can_see_workout -> can_edit_workout -> can_edit_program
-- -> is_coach, can_see_block, my_level...), so every row read re-ran a chain of lookups (147 ms for 73 scores).
-- Same rules, evaluated once per query instead:
--  * scalar helpers wrapped in (select ...) so Postgres computes them once (initPlan);
--  * per-row "can I see this workout/block" replaced by "is it in the set of workouts/blocks I can see",
--    computed once per query by the set-returning helpers below and checked with a hash lookup.
-- FOR ALL policies also apply to SELECT, so the write policies are rewritten the same way.

-- Programs I can edit: coach and owner or co-coach.
create function public.my_editable_programs() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select p.id from public.programs p
  where public.is_coach()
    and (p.owner_id = auth.uid()
         or exists (select 1 from public.program_coaches c where c.program_id = p.id and c.coach_id = auth.uid()))
$$;

-- Workouts I can edit (= can_edit_workout): library templates for any coach, dated ones of my programs.
create function public.my_editable_workouts() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select w.id from public.workouts w where w.date is null and public.is_coach()
  union all
  select w.id from public.workouts w where w.date is not null and w.program_id in (select public.my_editable_programs())
$$;

-- Published workouts of my programs (= assigned_to_me).
create function public.my_assigned_workouts() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select w.id from public.workouts w
  join public.program_members m on m.program_id = w.program_id and m.user_id = auth.uid()
  where public.is_member() and w.date is not null and w.publish_at <= now()
$$;

-- Blocks I can open (= can_see_block): blocks of workouts I edit, or of my workouts up to my level.
-- p_ranked_only keeps only the blocks of programs whose leaderboard is on (others' scores visible).
create function public.my_visible_blocks(p_ranked_only boolean default false) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select b.id from public.workout_blocks b
  where not p_ranked_only and b.workout_id in (select public.my_editable_workouts())
  union
  select b.id from public.workout_blocks b
  join public.workouts w on w.id = b.workout_id
  join public.programs p on p.id = w.program_id
  join public.program_members m on m.program_id = w.program_id and m.user_id = auth.uid()
  where public.is_member() and w.date is not null and w.publish_at <= now()
    and public.block_min_level(b.params) <= m.level
    and (not p_ranked_only or p.leaderboard_enabled)
$$;

-- Blocks I can edit.
create function public.my_editable_blocks() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select b.id from public.workout_blocks b where b.workout_id in (select public.my_editable_workouts())
$$;

-- Teams I scored with.
create function public.my_teams() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select team_id from public.results where athlete_id = auth.uid() and team_id is not null
$$;

revoke execute on function public.my_editable_programs(), public.my_editable_workouts(), public.my_assigned_workouts(),
  public.my_visible_blocks(boolean), public.my_editable_blocks(), public.my_teams() from anon, public;
grant execute on function public.my_editable_programs(), public.my_editable_workouts(), public.my_assigned_workouts(),
  public.my_visible_blocks(boolean), public.my_editable_blocks(), public.my_teams() to authenticated;

-- workouts
drop policy "workouts: read" on public.workouts;
create policy "workouts: read" on public.workouts for select to authenticated using (
  (date is null and (select public.is_coach()))
  or program_id in (select public.my_editable_programs())
  or id in (select public.my_assigned_workouts())
);
drop policy "workouts: insert" on public.workouts;
create policy "workouts: insert" on public.workouts for insert to authenticated with check (
  (date is null and program_id is null and (select public.is_coach()))
  or (date is not null and program_id in (select public.my_editable_programs()))
);
drop policy "workouts: update" on public.workouts;
create policy "workouts: update" on public.workouts for update to authenticated using (
  (date is null and (select public.is_coach())) or program_id in (select public.my_editable_programs())
) with check (
  (date is null and program_id is null and (select public.is_coach()))
  or (date is not null and program_id in (select public.my_editable_programs()))
);
drop policy "workouts: delete" on public.workouts;
create policy "workouts: delete" on public.workouts for delete to authenticated using (
  (date is null and (select public.is_coach())) or program_id in (select public.my_editable_programs())
);

-- workout_blocks
drop policy "workout_blocks: read" on public.workout_blocks;
create policy "workout_blocks: read" on public.workout_blocks for select to authenticated using (
  id in (select public.my_visible_blocks())
);
drop policy "workout_blocks: write" on public.workout_blocks;
create policy "workout_blocks: write" on public.workout_blocks for all to authenticated
  using (workout_id in (select public.my_editable_workouts()))
  with check (workout_id in (select public.my_editable_workouts()));

-- block_items
drop policy "block_items: read" on public.block_items;
create policy "block_items: read" on public.block_items for select to authenticated using (
  block_id in (select public.my_visible_blocks())
);
drop policy "block_items: write" on public.block_items;
create policy "block_items: write" on public.block_items for all to authenticated
  using (block_id in (select public.my_editable_blocks()))
  with check (block_id in (select public.my_editable_blocks()));

-- results (the insert/update checks run once per written row: unchanged apart from auth.uid())
drop policy "results: read" on public.results;
create policy "results: read" on public.results for select to authenticated using (
  athlete_id = (select auth.uid())
  or workout_id in (select public.my_editable_workouts())
  or block_id in (select public.my_visible_blocks(true))
);
drop policy "results: read my team" on public.results;
create policy "results: read my team" on public.results for select to authenticated using (
  team_id in (select public.my_teams())
);
drop policy "results: editors delete" on public.results;
create policy "results: editors delete" on public.results for delete to authenticated using (
  workout_id in (select public.my_editable_workouts())
);
drop policy "results: delete own" on public.results;
create policy "results: delete own" on public.results for delete to authenticated using (athlete_id = (select auth.uid()));

-- result_claps: the score must be readable (results RLS covers own, leaderboard and team scores, so the
-- separate team clause was redundant).
drop policy "claps: read on visible scores" on public.result_claps;
create policy "claps: read on visible scores" on public.result_claps for select to authenticated using (
  from_user = (select auth.uid()) or exists (select 1 from public.results r where r.id = result_claps.result_id)
);

-- block_skips
drop policy "skips: read" on public.block_skips;
create policy "skips: read" on public.block_skips for select to authenticated using (
  athlete_id = (select auth.uid()) or (select public.is_coach())
);

-- profiles, programs, members
drop policy "profiles: read own or members" on public.profiles;
create policy "profiles: read own or members" on public.profiles for select to authenticated using (
  id = (select auth.uid()) or ((select public.is_member()) and role is not null)
);
drop policy "programs: members read" on public.programs;
create policy "programs: members read" on public.programs for select to authenticated using ((select public.is_member()));
drop policy "program_members: own or coach read" on public.program_members;
create policy "program_members: own or coach read" on public.program_members for select to authenticated using (
  user_id = (select auth.uid()) or (select public.is_coach())
);
drop policy "program_members: editors write" on public.program_members;
create policy "program_members: editors write" on public.program_members for all to authenticated
  using (program_id in (select public.my_editable_programs()))
  with check (program_id in (select public.my_editable_programs()));

-- library
drop policy "exercises: members read" on public.exercises;
create policy "exercises: members read" on public.exercises for select to authenticated using ((select public.is_member()));
drop policy "exercises: coach write" on public.exercises;
create policy "exercises: coach write" on public.exercises for all to authenticated
  using ((select public.is_coach())) with check ((select public.is_coach()));
drop policy "exercise_sections: members read" on public.exercise_sections;
create policy "exercise_sections: members read" on public.exercise_sections for select to authenticated using ((select public.is_member()));
drop policy "exercise_sections: coach write" on public.exercise_sections;
create policy "exercise_sections: coach write" on public.exercise_sections for all to authenticated
  using ((select public.is_coach())) with check ((select public.is_coach()));
drop policy "sections: coach all" on public.library_sections;
create policy "sections: coach all" on public.library_sections for all to authenticated
  using ((select public.is_coach())) with check ((select public.is_coach()));

-- records, usage
drop policy "records: own or coach read" on public.personal_records;
create policy "records: own or coach read" on public.personal_records for select to authenticated using (
  athlete_id = (select auth.uid()) or (select public.is_coach())
);
drop policy "usage_events: admin read" on public.usage_events;
create policy "usage_events: admin read" on public.usage_events for select to authenticated using ((select public.is_admin()));
