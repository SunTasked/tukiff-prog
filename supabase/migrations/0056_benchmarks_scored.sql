-- Library benchmarks with at least one record (anyone's): a podium icon in the library list.
create function public.benchmarks_scored() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select distinct r.workout_id from public.personal_records r
  where r.workout_id is not null and (select public.is_member())
$$;
revoke execute on function public.benchmarks_scored() from anon, public;
grant execute on function public.benchmarks_scored() to authenticated;
