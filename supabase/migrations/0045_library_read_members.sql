-- Athletes browse the library (templates only, read-only). Every member reads all templates, their blocks,
-- items and sections; writes stay coach-only (the existing insert / update / delete policies are unchanged).
-- Access levels do not apply to templates: they only exist inside a program.

create function public.is_library_workout(p_workout uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.workouts where id = p_workout and date is null and program_id is null)
$$;

create policy "workouts: library read" on public.workouts for select to authenticated
  using (date is null and program_id is null and public.is_member());

create policy "workout_blocks: library read" on public.workout_blocks for select to authenticated
  using (public.is_member() and public.is_library_workout(workout_id));

create policy "block_items: library read" on public.block_items for select to authenticated
  using (public.is_member() and public.is_library_workout((select workout_id from public.workout_blocks b where b.id = block_id)));

create policy "sections: members read" on public.library_sections for select to authenticated
  using (public.is_member());
