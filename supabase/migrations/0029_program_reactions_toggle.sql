-- Emoji reactions can be turned off per program (owner setting). Off = hidden for everyone
-- in that program and new reactions refused; existing ones are kept and come back if turned on again.
alter table public.programs add column reactions_enabled boolean not null default true;

drop policy "reactions: insert own" on public.block_reactions;
create policy "reactions: insert own" on public.block_reactions
  for insert to authenticated with check (
    user_id = auth.uid()
    and public.assigned_to_me(workout_id)
    and exists (select 1 from public.workout_blocks b where b.id = block_id and b.workout_id = block_reactions.workout_id)
    and exists (
      select 1 from public.workouts w join public.programs p on p.id = w.program_id
      where w.id = block_reactions.workout_id and p.reactions_enabled
    )
  );
