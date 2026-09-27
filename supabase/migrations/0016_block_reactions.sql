-- Emoji reactions on blocks: one per member and block, visible to everyone who sees the workout.
create table public.block_reactions (
  block_id uuid not null references public.workout_blocks on delete cascade,
  workout_id uuid not null references public.workouts on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key (block_id, user_id)
);
create index on public.block_reactions (workout_id);

alter table public.block_reactions enable row level security;

create policy "reactions: read" on public.block_reactions
  for select to authenticated using (public.can_see_workout(workout_id));
create policy "reactions: insert own" on public.block_reactions
  for insert to authenticated with check (
    user_id = auth.uid()
    and public.assigned_to_me(workout_id)
    and exists (select 1 from public.workout_blocks b where b.id = block_id and b.workout_id = block_reactions.workout_id)
  );
create policy "reactions: update own" on public.block_reactions
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and public.assigned_to_me(workout_id));
create policy "reactions: delete own" on public.block_reactions
  for delete to authenticated using (user_id = auth.uid());
