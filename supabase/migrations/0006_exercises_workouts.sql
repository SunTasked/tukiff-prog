-- M2: exercise library and workouts (blocks + items).

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 80),
  description text,
  video_url text check (video_url ~ '^https?://'),
  measure text not null default 'reps' check (measure in ('reps', 'load', 'distance', 'time', 'calories')),
  created_by uuid default auth.uid() references public.profiles on delete set null,
  created_at timestamptz not null default now()
);
create unique index exercises_name_key on public.exercises (lower(trim(name)));

create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 120),
  notes text,
  date date, -- null = library template (calendar in M3)
  created_by uuid default auth.uid() references public.profiles on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workout_blocks (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts on delete cascade,
  position int not null,
  kind text not null check (kind in ('warmup', 'strength', 'skill', 'metcon', 'accessory', 'cooldown')),
  title text,
  format text not null check (format in ('for_time', 'amrap', 'emom', 'tabata', 'sets_reps', 'none')),
  params jsonb not null default '{}',
  notes text
);
create index on public.workout_blocks (workout_id);

create table public.block_items (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references public.workout_blocks on delete cascade,
  position int not null,
  exercise_id uuid references public.exercises on delete restrict,
  label text, -- free text when no exercise
  reps text,  -- free text: "10", "21-15-9", "max"
  load_kg numeric check (load_kg >= 0),
  pct_1rm numeric check (pct_1rm > 0 and pct_1rm <= 200),
  distance_m numeric check (distance_m >= 0),
  calories numeric check (calories >= 0),
  duration_s int check (duration_s >= 0),
  notes text,
  -- Overrides of the RX prescription: {"elite"|"scaled"|"foundation": {reps, load_kg, exercise_id, note}}
  levels jsonb not null default '{}',
  check (exercise_id is not null or char_length(trim(label)) > 0)
);
create index on public.block_items (block_id);
create index on public.block_items (exercise_id);

-- RLS -------------------------------------------------------------------------
alter table public.exercises enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_blocks enable row level security;
alter table public.block_items enable row level security;

create policy "exercises: members read" on public.exercises
  for select to authenticated using (public.is_member());
create policy "exercises: coach write" on public.exercises
  for all to authenticated using (public.is_coach()) with check (public.is_coach());

-- Athlete read access to workouts comes with assignments (M3).
create policy "workouts: coach all" on public.workouts
  for all to authenticated using (public.is_coach()) with check (public.is_coach());
create policy "workout_blocks: coach all" on public.workout_blocks
  for all to authenticated using (public.is_coach()) with check (public.is_coach());
create policy "block_items: coach all" on public.block_items
  for all to authenticated using (public.is_coach()) with check (public.is_coach());

-- Saves a whole workout tree in one transaction (security invoker: RLS applies).
-- Block ids are kept (results will reference them in M4); items are replaced.
create function public.save_workout(p jsonb) returns uuid
language plpgsql set search_path = '' as $$
declare
  v_id uuid := coalesce((p->>'id')::uuid, gen_random_uuid());
  b jsonb;
  b_pos int;
  b_id uuid;
  b_ids uuid[] := '{}';
begin
  insert into public.workouts (id, title, notes)
  values (v_id, trim(p->>'title'), nullif(trim(p->>'notes'), ''))
  on conflict (id) do update
    set title = excluded.title, notes = excluded.notes, updated_at = now();

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

revoke execute on function public.save_workout(jsonb) from anon, public;
grant execute on function public.save_workout(jsonb) to authenticated;
