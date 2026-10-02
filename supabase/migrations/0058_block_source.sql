-- Idempotent: first applied on staging as 0057_block_source.sql (0057 taken by PR #65).
-- Scheduled blocks copied from a library benchmark keep a link to the benchmark block,
-- so an athlete's score can be saved as a benchmark record. Kept through duplications.
alter table public.workout_blocks add column if not exists source_block_id uuid references public.workout_blocks on delete set null;

create or replace function public.copy_workout(p_src uuid, p_date date, p_publish_at timestamptz, p_program uuid)
returns uuid
language plpgsql set search_path = '' as $$
declare
  v_id uuid := gen_random_uuid();
  v_template boolean;
  b record;
  nb uuid;
begin
  select date is null into v_template from public.workouts where id = p_src;
  insert into public.workouts (id, title, notes, date, days, publish_at, program_id)
    select v_id, title, notes, p_date, days, p_publish_at, coalesce(p_program, program_id) from public.workouts where id = p_src;
  if not found then
    raise exception 'workout_not_found';
  end if;
  for b in select * from public.workout_blocks where workout_id = p_src order by position loop
    nb := gen_random_uuid();
    insert into public.workout_blocks (id, workout_id, position, kind, title, format, params, notes, source_block_id)
      values (nb, v_id, b.position, b.kind, b.title, b.format, b.params, b.notes,
              case when v_template then b.id else b.source_block_id end);
    insert into public.block_items
      (block_id, position, exercise_id, label, reps, load_kg, load_kg_f, pct_1rm, distance_m, calories, duration_s, notes, levels)
      select nb, position, exercise_id, label, reps, load_kg, load_kg_f, pct_1rm, distance_m, calories, duration_s, notes, levels
      from public.block_items where block_id = b.id;
  end loop;
  return v_id;
end $$;
