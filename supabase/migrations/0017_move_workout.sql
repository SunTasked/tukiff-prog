-- Move a scheduled workout to another date; a set publication time shifts by the same number of days.
create function public.move_workout(p_id uuid, p_date date) returns void
language sql set search_path = '' as $$
  update public.workouts
    set date = p_date, publish_at = publish_at + (p_date - date) * interval '1 day', updated_at = now()
    where id = p_id and date is not null
$$;
revoke execute on function public.move_workout(uuid, date) from anon, public;
grant execute on function public.move_workout(uuid, date) to authenticated;
