-- M3: programs, scheduling (dated copies of workouts), assignments, publication.

create table public.programs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 60),
  description text,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);
create unique index programs_name_key on public.programs (lower(trim(name))) where archived_at is null;

-- Which programs an athlete has access to.
create table public.program_members (
  program_id uuid not null references public.programs on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (program_id, user_id)
);
create index on public.program_members (user_id);

-- Programs granted when an invitation is accepted.
create table public.invitation_programs (
  invitation_id uuid not null references public.invitations on delete cascade,
  program_id uuid not null references public.programs on delete cascade,
  primary key (invitation_id, program_id)
);

-- null = draft; visible to assignees once publish_at <= now().
alter table public.workouts add column publish_at timestamptz;
create index on public.workouts (date) where date is not null;

-- Target of a scheduled workout: a program, an athlete, or everyone (both null).
create table public.workout_assignments (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts on delete cascade,
  program_id uuid references public.programs on delete cascade,
  athlete_id uuid references public.profiles on delete cascade,
  check (num_nonnulls(program_id, athlete_id) <= 1)
);
create unique index workout_assignments_target_key on public.workout_assignments
  (workout_id, coalesce(program_id, athlete_id, '00000000-0000-0000-0000-000000000000'));

-- Visibility ------------------------------------------------------------------

-- Published, dated and assigned to the current member (no coach bypass: used for "my workouts").
create function public.assigned_to_me(p_workout uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_member() and exists (
    select 1
    from public.workouts w
    join public.workout_assignments a on a.workout_id = w.id
    where w.id = p_workout
      and w.date is not null
      and w.publish_at <= now()
      and (
        (a.program_id is null and a.athlete_id is null)
        or a.athlete_id = auth.uid()
        or a.program_id in (select program_id from public.program_members where user_id = auth.uid())
      )
  )
$$;

create function public.can_see_workout(p_workout uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_coach() or public.assigned_to_me(p_workout)
$$;

create policy "workouts: assignees read" on public.workouts
  for select to authenticated using (public.assigned_to_me(id));
create policy "workout_blocks: assignees read" on public.workout_blocks
  for select to authenticated using (public.assigned_to_me(workout_id));
create policy "block_items: assignees read" on public.block_items
  for select to authenticated using (
    public.assigned_to_me((select workout_id from public.workout_blocks b where b.id = block_id))
  );

-- RLS -------------------------------------------------------------------------
alter table public.programs enable row level security;
alter table public.program_members enable row level security;
alter table public.invitation_programs enable row level security;
alter table public.workout_assignments enable row level security;

create policy "programs: members read" on public.programs
  for select to authenticated using (public.is_member());
create policy "programs: coach write" on public.programs
  for all to authenticated using (public.is_coach()) with check (public.is_coach());

create policy "program_members: own or coach read" on public.program_members
  for select to authenticated using (user_id = auth.uid() or public.is_coach());
create policy "program_members: coach write" on public.program_members
  for all to authenticated using (public.is_coach()) with check (public.is_coach());

create policy "invitation_programs: coach all" on public.invitation_programs
  for all to authenticated using (public.is_coach()) with check (public.is_coach());

create policy "workout_assignments: read" on public.workout_assignments
  for select to authenticated using (public.can_see_workout(workout_id));
create policy "workout_assignments: coach write" on public.workout_assignments
  for all to authenticated using (public.is_coach()) with check (public.is_coach());

-- Invitations grant programs -----------------------------------------------------
create or replace function public.accept_invitation(p_code text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  inv public.invitations;
  current_role_ text;
  new_role text;
  added int;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select * into inv from public.invitations
  where code = p_code
    and revoked_at is null
    and expires_at > now()
    and (max_uses is null or uses < max_uses)
  for update;

  if not found then
    raise exception 'invalid_invitation';
  end if;

  select role into current_role_ from public.profiles where id = auth.uid();
  new_role := case
    when current_role_ = 'coach' or inv.role = 'coach' then 'coach'
    else 'athlete'
  end;

  update public.profiles
    set role = new_role, enrolled_at = coalesce(enrolled_at, now())
    where id = auth.uid() and role is distinct from new_role;

  insert into public.program_members (program_id, user_id)
    select ip.program_id, auth.uid() from public.invitation_programs ip where ip.invitation_id = inv.id
    on conflict do nothing;
  get diagnostics added = row_count;

  if new_role is distinct from current_role_ or added > 0 then
    update public.invitations set uses = uses + 1 where id = inv.id;
  end if;

  return new_role;
end $$;

-- Scheduling ------------------------------------------------------------------

-- Deep copy of a workout (blocks, items; assignments optional). Security invoker: coach only via RLS.
create function public.copy_workout(p_src uuid, p_date date, p_publish_at timestamptz, p_with_assignments boolean)
returns uuid
language plpgsql set search_path = '' as $$
declare
  v_id uuid := gen_random_uuid();
  b record;
  nb uuid;
begin
  insert into public.workouts (id, title, notes, date, publish_at)
    select v_id, title, notes, p_date, p_publish_at from public.workouts where id = p_src;
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

  if p_with_assignments then
    insert into public.workout_assignments (workout_id, program_id, athlete_id)
      select v_id, program_id, athlete_id from public.workout_assignments where workout_id = p_src;
  else
    insert into public.workout_assignments (workout_id) values (v_id); -- everyone by default
  end if;
  return v_id;
end $$;

-- Library template -> dated draft for everyone.
create function public.schedule_workout(p_template uuid, p_date date) returns uuid
language sql set search_path = '' as $$
  select public.copy_workout(p_template, p_date, null, false)
$$;

-- Copy a scheduled workout to another date; publication shifts by the same number of days.
create function public.duplicate_workout(p_id uuid, p_date date) returns uuid
language sql set search_path = '' as $$
  select public.copy_workout(
    p_id, p_date,
    (select publish_at + (p_date - date) * interval '1 day' from public.workouts where id = p_id),
    true)
$$;

-- Copy every workout of the week starting p_from (Monday) to the week starting p_to.
create function public.duplicate_week(p_from date, p_to date) returns int
language plpgsql set search_path = '' as $$
declare
  w record;
  n int := 0;
begin
  for w in select id, date from public.workouts where date between p_from and p_from + 6 order by date loop
    perform public.duplicate_workout(w.id, w.date + (p_to - p_from));
    n := n + 1;
  end loop;
  return n;
end $$;

-- save_workout: new workouts may be created directly on a date (assigned to everyone).
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
    insert into public.workouts (id, title, notes, date)
      values (v_id, trim(p->>'title'), nullif(trim(p->>'notes'), ''), (p->>'date')::date);
    if p->>'date' is not null then
      insert into public.workout_assignments (workout_id) values (v_id);
    end if;
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

  delete from public.workout_blocks where workout_id = v_id and id <> all (b_ids);
  return v_id;
end $$;

-- Workouts assigned to me and published, in a date range (used by the home screen, coaches included).
create function public.my_workouts(p_from date, p_to date)
returns table (id uuid, title text, date date)
language sql stable security definer set search_path = '' as $$
  select w.id, w.title, w.date from public.workouts w
  where w.date between p_from and p_to and public.assigned_to_me(w.id)
  order by w.date, w.created_at
$$;

revoke execute on function public.copy_workout(uuid, date, timestamptz, boolean) from anon, public;
revoke execute on function public.schedule_workout(uuid, date) from anon, public;
revoke execute on function public.duplicate_workout(uuid, date) from anon, public;
revoke execute on function public.duplicate_week(date, date) from anon, public;
revoke execute on function public.my_workouts(date, date) from anon, public;
grant execute on function public.copy_workout(uuid, date, timestamptz, boolean) to authenticated;
grant execute on function public.schedule_workout(uuid, date) to authenticated;
grant execute on function public.duplicate_workout(uuid, date) to authenticated;
grant execute on function public.duplicate_week(date, date) to authenticated;
grant execute on function public.my_workouts(date, date) to authenticated;
