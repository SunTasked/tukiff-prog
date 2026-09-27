-- Editing the scoring content of a block invalidates its results: the editor warns the coach
-- and passes the block ids in p.reset_blocks; they are cleared in the same transaction.

create policy "results: coach delete" on public.results
  for delete to authenticated using (public.is_coach());

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

  delete from public.results
    where workout_id = v_id
      and block_id in (select (jsonb_array_elements_text(coalesce(p->'reset_blocks', '[]')))::uuid);
  delete from public.workout_blocks where workout_id = v_id and id <> all (b_ids);
  return v_id;
end $$;
