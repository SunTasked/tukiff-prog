-- Records of exercises not measured in load (V-up, Plank, Run, Row…): one best value in the exercise's unit
-- (reps or seconds) instead of a rep max + load.
alter table public.personal_records add column value numeric check (value > 0);
alter table public.personal_records drop constraint personal_records_check;
alter table public.personal_records add constraint personal_records_check check (
  (exercise_id is not null and benchmark_name is null and (
    (rep_max is not null and load_kg is not null and value is null)
    or (rep_max is null and load_kg is null and value is not null)))
  or (exercise_id is null and benchmark_name is not null and score_type is not null and value is null)
);
