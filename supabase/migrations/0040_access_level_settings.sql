-- Access levels of a program, above "Base" (level 0, always there): [{name, preview}], element i = level i + 1.
-- Levels stack (level 2 sees what level 1 sees). preview: blocks of that level show greyed and locked to the lower
-- levels; off, they are not shown at all. Replaces the names-only column of 0039.
alter table public.programs drop column access_levels;
alter table public.programs add column access_levels jsonb not null default '[]'
  check (jsonb_typeof(access_levels) = 'array' and jsonb_array_length(access_levels) <= 9);

-- Programs already using a level get one: "Premium", with previews (the behavior until now).
update public.programs p set access_levels = '[{"name": "Premium", "preview": true}]'
where exists (select 1 from public.program_members m where m.program_id = p.id and m.level > 0)
   or exists (
     select 1 from public.workouts w join public.workout_blocks b on b.workout_id = w.id
     where w.program_id = p.id and public.block_min_level(b.params) > 0
   );

create function public.level_preview(p_workout uuid, p_level int) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select (p.access_levels -> (p_level - 1) ->> 'preview')::boolean
    from public.workouts w join public.programs p on p.id = w.program_id
    where w.id = p_workout
  ), true)
$$;

-- Locked blocks: only those of a level that allows previews.
create or replace function public.locked_blocks(p_workouts uuid[])
returns table (id uuid, workout_id uuid, "position" int, kind text, title text)
language sql stable security definer set search_path = '' as $$
  select b.id, b.workout_id, b.position, b.kind, b.title
  from public.workout_blocks b
  where b.workout_id = any (p_workouts)
    and public.assigned_to_me(b.workout_id)
    and not public.can_edit_workout(b.workout_id)
    and public.block_min_level(b.params) > public.my_level(b.workout_id)
    and public.level_preview(b.workout_id, public.block_min_level(b.params))
  order by b.workout_id, b.position
$$;

-- Deleting a level (owner): its blocks and members go down one level, the levels above shift down.
create function public.delete_access_level(p_program uuid, p_level int) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.owns_program(p_program) then
    raise exception 'forbidden';
  end if;
  if p_level < 1 or p_level > (select jsonb_array_length(access_levels) from public.programs where id = p_program) then
    raise exception 'unknown_level';
  end if;
  update public.programs set access_levels = access_levels - (p_level - 1) where id = p_program;
  update public.workout_blocks b
  set params = case
    when public.block_min_level(b.params) = 1 then b.params - 'min_level'
    else jsonb_set(b.params, '{min_level}', to_jsonb(public.block_min_level(b.params) - 1))
  end
  from public.workouts w
  where w.id = b.workout_id and w.program_id = p_program and public.block_min_level(b.params) >= p_level;
  update public.program_members set level = level - 1 where program_id = p_program and level >= p_level;
end $$;

revoke execute on function public.delete_access_level(uuid, int) from anon, public;
grant execute on function public.delete_access_level(uuid, int) to authenticated;
