-- Records are entered from the library: gymnastics records (V-up, Plank…) hold one best value in the exercise's unit
-- (reps or seconds) instead of a rep max + load; benchmark records are linked to a library session and one of its
-- scored blocks, the blocks of one session being entered together (same entry_id). Athletes read the library.

alter table public.personal_records
  add column value numeric check (value > 0),
  add column entry_id uuid not null default gen_random_uuid(),
  add column workout_id uuid references public.workouts on delete set null,
  add column block_id uuid references public.workout_blocks on delete set null;
create index on public.personal_records (workout_id);

-- Free-text benchmark records (before the library link) are dropped: few, and nothing to attach them to.
delete from public.personal_records where benchmark_name is not null;

alter table public.personal_records drop constraint personal_records_check;
alter table public.personal_records add constraint personal_records_check check (
  (exercise_id is not null and benchmark_name is null and (
    (rep_max is not null and load_kg is not null and value is null)
    or (rep_max is null and load_kg is null and value is not null)))
  or (exercise_id is null and benchmark_name is not null and score_type is not null and value is null)
);
alter table public.personal_records drop constraint personal_records_score_type_check;
alter table public.personal_records add constraint personal_records_score_type_check
  check (score_type in ('time', 'rounds_reps', 'reps', 'load'));

-- Library, read-only for every member (writes stay coach-only; access levels only exist inside a program).
create function public.library_blocks() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select b.id from public.workout_blocks b join public.workouts w on w.id = b.workout_id
  where w.date is null and public.is_member()
$$;
revoke execute on function public.library_blocks() from anon, public;
grant execute on function public.library_blocks() to authenticated;

create policy "workouts: library read" on public.workouts for select to authenticated
  using (date is null and (select public.is_member()));
create policy "workout_blocks: library read" on public.workout_blocks for select to authenticated
  using (id in (select public.library_blocks()));
create policy "block_items: library read" on public.block_items for select to authenticated
  using (block_id in (select public.library_blocks()));
create policy "sections: members read" on public.library_sections for select to authenticated
  using ((select public.is_member()));
