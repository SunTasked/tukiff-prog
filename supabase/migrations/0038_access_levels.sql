-- Access levels inside a program: each member has a level (0 = Free, 1 = Premium), each block a minimum
-- level (workout_blocks.params.min_level, absent = 0; kept in params so every copy function carries it).
-- A block above my level is not readable at all (content never sent to the phone): only its title comes back
-- through locked_blocks(), to show it closed with a lock. Program coaches always see everything.
alter table public.program_members add column level smallint not null default 0 check (level between 0 and 9);

create function public.block_min_level(p_params jsonb) returns int
language sql immutable set search_path = '' as $$
  select coalesce((p_params->>'min_level')::int, 0)
$$;

-- My level in the program of a workout (0 when not a member).
create function public.my_level(p_workout uuid) returns int
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select m.level from public.workouts w
    join public.program_members m on m.program_id = w.program_id and m.user_id = auth.uid()
    where w.id = p_workout
  ), 0)
$$;

create function public.can_see_block(p_block uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select public.can_edit_workout(b.workout_id)
      or (public.assigned_to_me(b.workout_id) and public.block_min_level(b.params) <= public.my_level(b.workout_id))
    from public.workout_blocks b where b.id = p_block
  ), false)
$$;

drop policy "workout_blocks: read" on public.workout_blocks;
create policy "workout_blocks: read" on public.workout_blocks for select to authenticated using (
  public.can_edit_workout(workout_id)
  or (public.assigned_to_me(workout_id) and public.block_min_level(params) <= public.my_level(workout_id))
);

drop policy "block_items: read" on public.block_items;
create policy "block_items: read" on public.block_items for select to authenticated using (public.can_see_block(block_id));

-- Others' scores and reactions on a locked block are hidden too. Inserting a score, a skip or a reaction
-- already requires reading the block (the insert policies select from workout_blocks under RLS).
drop policy "results: read" on public.results;
create policy "results: read" on public.results for select to authenticated using (
  athlete_id = auth.uid()
  or public.can_edit_workout(workout_id)
  or (public.can_see_workout(workout_id) and public.leaderboard_on(workout_id) and public.can_see_block(block_id))
);

drop policy "reactions: read" on public.block_reactions;
create policy "reactions: read" on public.block_reactions for select to authenticated using (public.can_see_block(block_id));

-- Blocks of my workouts I can't open: position and title only.
create function public.locked_blocks(p_workouts uuid[])
returns table (id uuid, workout_id uuid, "position" int, kind text, title text)
language sql stable security definer set search_path = '' as $$
  select b.id, b.workout_id, b.position, b.kind, b.title
  from public.workout_blocks b
  where b.workout_id = any (p_workouts)
    and public.assigned_to_me(b.workout_id)
    and not public.can_edit_workout(b.workout_id)
    and public.block_min_level(b.params) > public.my_level(b.workout_id)
  order by b.workout_id, b.position
$$;

revoke execute on function public.locked_blocks(uuid[]) from anon, public;
grant execute on function public.locked_blocks(uuid[]) to authenticated;
