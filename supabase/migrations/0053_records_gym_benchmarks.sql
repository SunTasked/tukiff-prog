-- Gymnastics records (V-up, Pull-up, Plank…): one best value in the exercise's unit
-- (reps or seconds) instead of a rep max + load.
alter table public.personal_records add column value numeric check (value > 0);
alter table public.personal_records drop constraint personal_records_check;
alter table public.personal_records add constraint personal_records_check check (
  (exercise_id is not null and benchmark_name is null and (
    (rep_max is not null and load_kg is not null and value is null)
    or (rep_max is null and load_kg is null and value is not null)))
  or (exercise_id is null and benchmark_name is not null and score_type is not null and value is null)
);

-- Benchmark records are picked from the library (templates), which athletes cannot read: one row per scored block
-- (a benchmark can have several scores, e.g. a heavy squat then Cindy), with its score type.
alter table public.personal_records drop constraint personal_records_score_type_check;
alter table public.personal_records add constraint personal_records_score_type_check
  check (score_type in ('time', 'rounds_reps', 'reps', 'load'));

create function public.record_benchmarks()
returns table (id uuid, title text, section_id uuid, section_name text, block_position int, block_title text, score_type text)
language sql stable security definer set search_path = '' as $$
  select w.id, w.title, s.id, s.name, wb.position, wb.title, t.score_type
  from public.workouts w
  left join public.library_sections s on s.id = w.section_id
  join public.workout_blocks wb on wb.workout_id = w.id
  cross join lateral (select coalesce(wb.params->>'score', case wb.format
    when 'for_time' then 'time' when 'amrap' then 'rounds_reps' when 'tabata' then 'reps' when 'sets_reps' then 'load'
    else 'none' end) as score_type) t
  where w.date is null and t.score_type <> 'none' and (select public.is_member())
$$;
revoke execute on function public.record_benchmarks() from anon, public;
grant execute on function public.record_benchmarks() to authenticated;
