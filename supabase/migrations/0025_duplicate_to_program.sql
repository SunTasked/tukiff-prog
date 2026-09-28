-- Duplicate workouts into another program. The selection must come from a single program;
-- p_program null keeps it (same program, other date).
drop function public.duplicate_workouts(uuid[], int);

create function public.duplicate_workouts(p_ids uuid[], p_days int, p_program uuid default null) returns int
language plpgsql set search_path = '' as $$
declare
  w record;
  n int := 0;
begin
  if (select count(distinct program_id) from public.workouts where id = any (p_ids) and date is not null) > 1 then
    raise exception 'Les séances à dupliquer doivent venir d’une seule programmation.';
  end if;
  for w in select id, date, publish_at from public.workouts where id = any (p_ids) and date is not null order by date loop
    perform public.copy_workout(w.id, w.date + p_days, w.publish_at + p_days * interval '1 day', p_program);
    n := n + 1;
  end loop;
  return n;
end $$;

revoke execute on function public.duplicate_workouts(uuid[], int, uuid) from anon, public;
grant execute on function public.duplicate_workouts(uuid[], int, uuid) to authenticated;
