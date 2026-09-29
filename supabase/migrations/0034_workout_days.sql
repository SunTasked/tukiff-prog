-- Multi-day workouts ("challenge de la semaine"): a workout lasts `days` days from its date.
-- Shown on home every day of that range; results stay one per block, so it is scored once.
alter table public.workouts add column days int not null default 1 check (days between 1 and 7);

-- Home: a workout is returned when its range overlaps [p_from, p_to]; `days` returned for display.
drop function public.my_workouts(date, date);

create function public.my_workouts(p_from date, p_to date)
returns table (id uuid, title text, date date, days int, program_id uuid, program_name text, publish_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select w.id, w.title, w.date, w.days, p.id, p.name, w.publish_at
  from public.workouts w join public.programs p on p.id = w.program_id
  where w.date <= p_to and w.date + (w.days - 1) >= p_from
    and (public.assigned_to_me(w.id)
         or ((w.publish_at is null or w.publish_at > now()) and public.can_edit_program(w.program_id)))
  order by w.date, p.name, w.created_at
$$;

revoke execute on function public.my_workouts(date, date) from anon, public;
grant execute on function public.my_workouts(date, date) to authenticated;

-- Copies (scheduling a template, duplicating) keep the duration.
create or replace function public.copy_workout(p_src uuid, p_date date, p_publish_at timestamptz, p_program uuid)
returns uuid
language plpgsql set search_path = '' as $$
declare
  v_id uuid := gen_random_uuid();
  b record;
  nb uuid;
begin
  insert into public.workouts (id, title, notes, date, days, publish_at, program_id)
    select v_id, title, notes, p_date, days, p_publish_at, coalesce(p_program, program_id) from public.workouts where id = p_src;
  if not found then
    raise exception 'workout_not_found';
  end if;
  for b in select * from public.workout_blocks where workout_id = p_src order by position loop
    nb := gen_random_uuid();
    insert into public.workout_blocks (id, workout_id, position, kind, title, format, params, notes)
      values (nb, v_id, b.position, b.kind, b.title, b.format, b.params, b.notes);
    insert into public.block_items
      (block_id, position, exercise_id, label, reps, load_kg, load_kg_f, pct_1rm, distance_m, calories, duration_s, notes, levels)
      select nb, position, exercise_id, label, reps, load_kg, load_kg_f, pct_1rm, distance_m, calories, duration_s, notes, levels
      from public.block_items where block_id = b.id;
  end loop;
  return v_id;
end $$;

-- save_workout: persists days (1 when absent).
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
      set title = trim(p->>'title'), notes = nullif(trim(p->>'notes'), ''),
          days = coalesce((p->>'days')::int, 1), updated_at = now()
      where id = v_id;
  else
    insert into public.workouts (id, title, notes, date, days, program_id)
      values (v_id, trim(p->>'title'), nullif(trim(p->>'notes'), ''), (p->>'date')::date,
              coalesce((p->>'days')::int, 1), (p->>'program_id')::uuid);
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
      (block_id, position, exercise_id, label, reps, load_kg, load_kg_f, pct_1rm, distance_m, calories, duration_s, notes, levels)
    select b_id, i.ordinality, (i.value->>'exercise_id')::uuid, nullif(trim(i.value->>'label'), ''),
           nullif(trim(i.value->>'reps'), ''), (i.value->>'load_kg')::numeric, (i.value->>'load_kg_f')::numeric,
           (i.value->>'pct_1rm')::numeric,
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
