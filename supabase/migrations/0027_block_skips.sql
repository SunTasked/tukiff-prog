-- "Je passe": a member marks a block they won't do. Kept apart from results so leaderboards,
-- records and stats are untouched. Entering a score removes the skip (done by the app).
create table public.block_skips (
  block_id uuid not null references public.workout_blocks on delete cascade,
  workout_id uuid not null references public.workouts on delete cascade,
  athlete_id uuid not null default auth.uid() references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (block_id, athlete_id)
);
create index on public.block_skips (workout_id);

alter table public.block_skips enable row level security;

create policy "skips: read" on public.block_skips
  for select to authenticated using (athlete_id = auth.uid() or public.is_coach());
create policy "skips: insert own" on public.block_skips
  for insert to authenticated with check (
    athlete_id = auth.uid()
    and public.assigned_to_me(workout_id)
    and exists (select 1 from public.workout_blocks b where b.id = block_id and b.workout_id = block_skips.workout_id)
  );
create policy "skips: delete own" on public.block_skips
  for delete to authenticated using (athlete_id = auth.uid());
