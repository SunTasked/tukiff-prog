-- Home "athlete view": program editors (owner + contributing coaches) also get the program's
-- not-yet-published workouts, so they can check how athletes will see them. Athletes never do.
-- publish_at is returned so the app can flag those workouts.

drop function public.my_workouts(date, date);

create function public.my_workouts(p_from date, p_to date)
returns table (id uuid, title text, date date, program_id uuid, program_name text, publish_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select w.id, w.title, w.date, p.id, p.name, w.publish_at
  from public.workouts w join public.programs p on p.id = w.program_id
  where w.date between p_from and p_to
    and (public.assigned_to_me(w.id)
         or ((w.publish_at is null or w.publish_at > now()) and public.can_edit_program(w.program_id)))
  order by w.date, p.name, w.created_at
$$;

revoke execute on function public.my_workouts(date, date) from anon, public;
grant execute on function public.my_workouts(date, date) to authenticated;
