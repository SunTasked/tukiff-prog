-- Benchmarks (library templates: workouts without a date) and their sections are read-only for every user, coaches
-- included: their content is fed through the database (scripts, service role). Only dated workouts stay editable.

create or replace function public.can_edit_workout(p_workout uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select w.date is not null and public.can_edit_program(w.program_id) from public.workouts w where w.id = p_workout
  ), false)
$$;

create or replace function public.my_editable_workouts() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select w.id from public.workouts w where w.date is not null and w.program_id in (select public.my_editable_programs())
$$;

drop policy "workouts: insert" on public.workouts;
create policy "workouts: insert" on public.workouts for insert to authenticated with check (
  date is not null and program_id in (select public.my_editable_programs())
);
drop policy "workouts: update" on public.workouts;
create policy "workouts: update" on public.workouts for update to authenticated
  using (date is not null and program_id in (select public.my_editable_programs()))
  with check (date is not null and program_id in (select public.my_editable_programs()));
drop policy "workouts: delete" on public.workouts;
create policy "workouts: delete" on public.workouts for delete to authenticated using (
  date is not null and program_id in (select public.my_editable_programs())
);

drop policy "sections: coach all" on public.library_sections;
