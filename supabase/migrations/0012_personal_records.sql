-- M5: personal records (history kept; the best entry is computed client-side).
-- Either an exercise with a rep max and a load, or a named benchmark with a score.

create table public.personal_records (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null default auth.uid() references public.profiles on delete cascade,
  exercise_id uuid references public.exercises on delete cascade,
  rep_max int check (rep_max between 1 and 20),
  load_kg numeric check (load_kg > 0),
  benchmark_name text check (char_length(trim(benchmark_name)) between 1 and 60),
  score_type text check (score_type in ('time', 'rounds_reps', 'reps')),
  time_s int check (time_s > 0),
  rounds int check (rounds >= 0),
  reps int check (reps >= 0),
  date date not null default current_date,
  notes text check (char_length(notes) <= 300),
  created_at timestamptz not null default now(),
  check (
    (exercise_id is not null and rep_max is not null and load_kg is not null and benchmark_name is null)
    or (exercise_id is null and benchmark_name is not null and score_type is not null)
  )
);
create index on public.personal_records (athlete_id);

alter table public.personal_records enable row level security;

create policy "records: own or coach read" on public.personal_records
  for select to authenticated using (athlete_id = auth.uid() or public.is_coach());
create policy "records: own insert" on public.personal_records
  for insert to authenticated with check (athlete_id = auth.uid() and public.is_member());
create policy "records: own update" on public.personal_records
  for update to authenticated using (athlete_id = auth.uid()) with check (athlete_id = auth.uid());
create policy "records: own delete" on public.personal_records
  for delete to authenticated using (athlete_id = auth.uid());
