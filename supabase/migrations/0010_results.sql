-- M4: results (one per athlete and block). The score type is derived from the block format (src/domain/scoring.ts).

create table public.results (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references public.workout_blocks on delete cascade,
  workout_id uuid not null references public.workouts on delete cascade,
  athlete_id uuid not null default auth.uid() references public.profiles on delete cascade,
  level text not null default 'rx' check (level in ('elite', 'rx', 'scaled', 'foundation')),
  time_s int check (time_s >= 0),
  capped boolean not null default false,
  rounds int check (rounds >= 0),
  reps int check (reps >= 0),
  load_kg numeric check (load_kg >= 0),
  comment text check (char_length(comment) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (block_id, athlete_id)
);
create index on public.results (workout_id);

create function public.shares_scores(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select share_scores from public.profiles where id = p_user), false)
$$;

alter table public.results enable row level security;

-- Own results, all results for coaches, others' results only with their consent.
create policy "results: read" on public.results
  for select to authenticated using (
    athlete_id = auth.uid()
    or public.is_coach()
    or (public.shares_scores(athlete_id) and public.can_see_workout(workout_id))
  );

-- Write only my own results, on a published workout assigned to me, for a block of that workout.
create policy "results: insert own" on public.results
  for insert to authenticated with check (
    athlete_id = auth.uid()
    and public.assigned_to_me(workout_id)
    and exists (select 1 from public.workout_blocks b where b.id = block_id and b.workout_id = results.workout_id)
  );
create policy "results: update own" on public.results
  for update to authenticated
  using (athlete_id = auth.uid())
  with check (
    athlete_id = auth.uid()
    and public.assigned_to_me(workout_id)
    and exists (select 1 from public.workout_blocks b where b.id = block_id and b.workout_id = results.workout_id)
  );
create policy "results: delete own" on public.results
  for delete to authenticated using (athlete_id = auth.uid());

create function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger results_touch before update on public.results
  for each row execute function public.touch_updated_at();
