-- Program ownership. A program has an owner coach and optional contributor coaches;
-- only they see and edit its scheduled workouts. A scheduled workout belongs to exactly one program
-- (replaces workout_assignments: "everyone" / single-athlete targets become programs).
-- Library templates (date null, program null) stay shared by all coaches.

-- Ownership -------------------------------------------------------------------------
alter table public.programs add column owner_id uuid default auth.uid() references public.profiles on delete set null;
update public.programs set owner_id = (select id from public.profiles where role = 'coach' order by created_at limit 1)
  where owner_id is null;

create table public.program_coaches (
  program_id uuid not null references public.programs on delete cascade,
  coach_id uuid not null references public.profiles on delete cascade,
  primary key (program_id, coach_id)
);
alter table public.program_coaches enable row level security;

create function public.can_edit_program(p_program uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_coach() and exists (
    select 1 from public.programs p
    where p.id = p_program
      and (p.owner_id = auth.uid()
           or exists (select 1 from public.program_coaches c where c.program_id = p.id and c.coach_id = auth.uid()))
  )
$$;

create function public.owns_program(p_program uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.programs where id = p_program and owner_id = auth.uid())
$$;

-- Workouts belong to one program ------------------------------------------------------
alter table public.workouts add column program_id uuid references public.programs on delete cascade;
update public.workouts w set program_id = (
  select a.program_id from public.workout_assignments a
  where a.workout_id = w.id and a.program_id is not null order by a.program_id limit 1
) where w.date is not null;
delete from public.workouts where date is not null and program_id is null;
alter table public.workouts add constraint scheduled_in_program check (date is null or program_id is not null);
create index on public.workouts (program_id, date);

-- Functions that used workout_assignments.
drop function public.my_workouts(date, date);
drop function public.duplicate_week(date, date);
drop function public.schedule_workout(uuid, date);
drop function public.duplicate_workout(uuid, date);
drop function public.copy_workout(uuid, date, timestamptz, boolean);
drop table public.workout_assignments;

create or replace function public.assigned_to_me(p_workout uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_member() and exists (
    select 1 from public.workouts w
    join public.program_members m on m.program_id = w.program_id and m.user_id = auth.uid()
    where w.id = p_workout and w.date is not null and w.publish_at <= now()
  )
$$;

-- Editing rights on a workout: library templates -> any coach; scheduled -> program editors.
create function public.can_edit_workout(p_workout uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select case when w.date is null then public.is_coach() else public.can_edit_program(w.program_id) end
    from public.workouts w where w.id = p_workout
  ), false)
$$;

create or replace function public.can_see_workout(p_workout uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.can_edit_workout(p_workout) or public.assigned_to_me(p_workout)
$$;

-- Policies --------------------------------------------------------------------------------
drop policy "workouts: coach all" on public.workouts;
drop policy "workouts: assignees read" on public.workouts;
drop policy "workout_blocks: coach all" on public.workout_blocks;
drop policy "workout_blocks: assignees read" on public.workout_blocks;
drop policy "block_items: coach all" on public.block_items;
drop policy "block_items: assignees read" on public.block_items;

create policy "workouts: read" on public.workouts for select to authenticated using (
  (date is null and public.is_coach()) or public.can_edit_program(program_id) or public.assigned_to_me(id)
);
create policy "workouts: insert" on public.workouts for insert to authenticated with check (
  (date is null and program_id is null and public.is_coach()) or (date is not null and public.can_edit_program(program_id))
);
create policy "workouts: update" on public.workouts for update to authenticated
  using ((date is null and public.is_coach()) or public.can_edit_program(program_id))
  with check ((date is null and program_id is null and public.is_coach()) or (date is not null and public.can_edit_program(program_id)));
create policy "workouts: delete" on public.workouts for delete to authenticated using (
  (date is null and public.is_coach()) or public.can_edit_program(program_id)
);

create policy "workout_blocks: read" on public.workout_blocks for select to authenticated
  using (public.can_see_workout(workout_id));
create policy "workout_blocks: write" on public.workout_blocks for all to authenticated
  using (public.can_edit_workout(workout_id)) with check (public.can_edit_workout(workout_id));

create policy "block_items: read" on public.block_items for select to authenticated
  using (public.can_see_workout((select workout_id from public.workout_blocks b where b.id = block_id)));
create policy "block_items: write" on public.block_items for all to authenticated
  using (public.can_edit_workout((select workout_id from public.workout_blocks b where b.id = block_id)))
  with check (public.can_edit_workout((select workout_id from public.workout_blocks b where b.id = block_id)));

-- Programs: names readable by members (athlete pages, home panels); owner renames / archives.
drop policy "programs: coach write" on public.programs;
create policy "programs: coach create" on public.programs for insert to authenticated
  with check (public.is_coach() and owner_id = auth.uid());
create policy "programs: owner update" on public.programs for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "programs: owner delete" on public.programs for delete to authenticated using (owner_id = auth.uid());

create policy "program_coaches: coach read" on public.program_coaches for select to authenticated using (public.is_coach());
create policy "program_coaches: owner write" on public.program_coaches for all to authenticated
  using (public.owns_program(program_id)) with check (public.owns_program(program_id));

drop policy "program_members: coach write" on public.program_members;
create policy "program_members: editors write" on public.program_members for all to authenticated
  using (public.can_edit_program(program_id)) with check (public.can_edit_program(program_id));

drop policy "invitation_programs: coach all" on public.invitation_programs;
create policy "invitation_programs: coach read" on public.invitation_programs for select to authenticated using (public.is_coach());
create policy "invitation_programs: editors write" on public.invitation_programs for all to authenticated
  using (public.can_edit_program(program_id)) with check (public.can_edit_program(program_id));

-- Results: coaches see the results of the programs they edit (not all results anymore).
drop policy "results: read" on public.results;
create policy "results: read" on public.results for select to authenticated using (
  athlete_id = auth.uid()
  or public.can_edit_workout(workout_id)
  or (public.shares_scores(athlete_id) and public.can_see_workout(workout_id))
);
drop policy "results: coach delete" on public.results;
create policy "results: editors delete" on public.results for delete to authenticated using (public.can_edit_workout(workout_id));

-- Scheduling RPCs (security invoker: RLS applies) -------------------------------------------
create function public.copy_workout(p_src uuid, p_date date, p_publish_at timestamptz, p_program uuid)
returns uuid
language plpgsql set search_path = '' as $$
declare
  v_id uuid := gen_random_uuid();
  b record;
  nb uuid;
begin
  insert into public.workouts (id, title, notes, date, publish_at, program_id)
    select v_id, title, notes, p_date, p_publish_at, coalesce(p_program, program_id) from public.workouts where id = p_src;
  if not found then
    raise exception 'workout_not_found';
  end if;
  for b in select * from public.workout_blocks where workout_id = p_src order by position loop
    nb := gen_random_uuid();
    insert into public.workout_blocks (id, workout_id, position, kind, title, format, params, notes)
      values (nb, v_id, b.position, b.kind, b.title, b.format, b.params, b.notes);
    insert into public.block_items
      (block_id, position, exercise_id, label, reps, load_kg, pct_1rm, distance_m, calories, duration_s, notes, levels)
      select nb, position, exercise_id, label, reps, load_kg, pct_1rm, distance_m, calories, duration_s, notes, levels
      from public.block_items where block_id = b.id;
  end loop;
  return v_id;
end $$;

-- Library template -> dated draft in a program.
create function public.schedule_workout(p_template uuid, p_date date, p_program uuid) returns uuid
language sql set search_path = '' as $$
  select public.copy_workout(p_template, p_date, null, p_program)
$$;

-- Copies workouts shifted by p_days (publication shifted too). Returns the number of copies.
create function public.duplicate_workouts(p_ids uuid[], p_days int) returns int
language plpgsql set search_path = '' as $$
declare
  w record;
  n int := 0;
begin
  for w in select id, date, publish_at from public.workouts where id = any (p_ids) and date is not null order by date loop
    perform public.copy_workout(w.id, w.date + p_days, w.publish_at + p_days * interval '1 day', null);
    n := n + 1;
  end loop;
  return n;
end $$;

-- Moves workouts by p_days (publication shifted too).
create function public.move_workouts(p_ids uuid[], p_days int) returns void
language sql set search_path = '' as $$
  update public.workouts
    set date = date + p_days, publish_at = publish_at + p_days * interval '1 day', updated_at = now()
    where id = any (p_ids) and date is not null
$$;
drop function public.move_workout(uuid, date);

-- save_workout: a new dated workout is created in p.program_id.
create or replace function public.save_workout(p jsonb) returns uuid
language plpgsql set search_path = '' as $$
declare
  v_id uuid := coalesce((p->>'id')::uuid, gen_random_uuid());
  b jsonb;
  b_pos int;
  b_id uuid;
  b_ids uuid[] := '{}';
begin
  if exists (select 1 from public.workouts where id = v_id) then
    update public.workouts
      set title = trim(p->>'title'), notes = nullif(trim(p->>'notes'), ''), updated_at = now()
      where id = v_id;
  else
    insert into public.workouts (id, title, notes, date, program_id)
      values (v_id, trim(p->>'title'), nullif(trim(p->>'notes'), ''), (p->>'date')::date, (p->>'program_id')::uuid);
  end if;

  for b, b_pos in select value, ordinality from jsonb_array_elements(coalesce(p->'blocks', '[]')) with ordinality loop
    b_id := coalesce((b->>'id')::uuid, gen_random_uuid());
    b_ids := b_ids || b_id;

    insert into public.workout_blocks (id, workout_id, position, kind, title, format, params, notes)
    values (b_id, v_id, b_pos, b->>'kind', nullif(trim(b->>'title'), ''), b->>'format',
            coalesce(b->'params', '{}'), nullif(trim(b->>'notes'), ''))
    on conflict (id) do update
      set position = excluded.position, kind = excluded.kind, title = excluded.title,
          format = excluded.format, params = excluded.params, notes = excluded.notes
      where public.workout_blocks.workout_id = v_id;

    delete from public.block_items where block_id = b_id;
    insert into public.block_items
      (block_id, position, exercise_id, label, reps, load_kg, pct_1rm, distance_m, calories, duration_s, notes, levels)
    select b_id, i.ordinality, (i.value->>'exercise_id')::uuid, nullif(trim(i.value->>'label'), ''),
           nullif(trim(i.value->>'reps'), ''), (i.value->>'load_kg')::numeric, (i.value->>'pct_1rm')::numeric,
           (i.value->>'distance_m')::numeric, (i.value->>'calories')::numeric, (i.value->>'duration_s')::int,
           nullif(trim(i.value->>'notes'), ''), coalesce(i.value->'levels', '{}')
    from jsonb_array_elements(coalesce(b->'items', '[]')) with ordinality i;
  end loop;

  delete from public.results
    where workout_id = v_id
      and block_id in (select (jsonb_array_elements_text(coalesce(p->'reset_blocks', '[]')))::uuid);
  delete from public.workout_blocks where workout_id = v_id and id <> all (b_ids);
  return v_id;
end $$;

-- Home screen: my published workouts with their program.
create function public.my_workouts(p_from date, p_to date)
returns table (id uuid, title text, date date, program_id uuid, program_name text)
language sql stable security definer set search_path = '' as $$
  select w.id, w.title, w.date, p.id, p.name
  from public.workouts w join public.programs p on p.id = w.program_id
  where w.date between p_from and p_to and public.assigned_to_me(w.id)
  order by w.date, p.name, w.created_at
$$;

revoke execute on function public.copy_workout(uuid, date, timestamptz, uuid) from anon, public;
revoke execute on function public.schedule_workout(uuid, date, uuid) from anon, public;
revoke execute on function public.duplicate_workouts(uuid[], int) from anon, public;
revoke execute on function public.move_workouts(uuid[], int) from anon, public;
revoke execute on function public.my_workouts(date, date) from anon, public;
grant execute on function public.copy_workout(uuid, date, timestamptz, uuid) to authenticated;
grant execute on function public.schedule_workout(uuid, date, uuid) to authenticated;
grant execute on function public.duplicate_workouts(uuid[], int) to authenticated;
grant execute on function public.move_workouts(uuid[], int) to authenticated;
grant execute on function public.my_workouts(date, date) to authenticated;
