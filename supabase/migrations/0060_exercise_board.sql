-- Box leaderboard of a movement: every member's records on it and on its variants (lift hierarchy, records are otherwise own-only).
-- The best per athlete (inheritance, rep max) is picked client-side.
create function public.exercise_board(p_exercise uuid)
returns table (exercise_id uuid, athlete_id uuid, rep_max int, load_kg numeric, value numeric, date date,
               gender text, first_name text, last_name text, display_name text)
language sql stable security definer set search_path = '' as $$
  with recursive lifts (id) as (
    select p_exercise
    union
    select l.exercise_id from public.exercise_links l join lifts on l.parent_id = lifts.id
  )
  select r.exercise_id, r.athlete_id, r.rep_max, r.load_kg, r.value, r.date,
         p.gender, p.first_name, p.last_name, p.display_name
  from public.personal_records r
  join public.profiles p on p.id = r.athlete_id
  where r.exercise_id in (select id from lifts) and (select public.is_member())
$$;
revoke execute on function public.exercise_board(uuid) from anon, public;
grant execute on function public.exercise_board(uuid) to authenticated;

-- Movements with at least one record (anyone's), counting the parent lifts of a variant: PR list filter and podium icon.
create function public.exercises_scored() returns setof uuid
language sql stable security definer set search_path = '' as $$
  with recursive lifts (id) as (
    select distinct r.exercise_id from public.personal_records r
    where r.exercise_id is not null and (select public.is_member())
    union
    select l.parent_id from public.exercise_links l join lifts on l.exercise_id = lifts.id
  )
  select id from lifts
$$;
revoke execute on function public.exercises_scored() from anon, public;
grant execute on function public.exercises_scored() to authenticated;
