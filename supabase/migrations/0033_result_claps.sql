-- Claps on someone else's score: one per member and score, final (no update or delete policy).
-- The athlete who receives them sees who clapped; the others only see the count (clap_counts).
create table public.result_claps (
  result_id uuid not null references public.results on delete cascade,
  workout_id uuid not null references public.workouts on delete cascade,
  from_user uuid not null default auth.uid() references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (result_id, from_user)
);
create index on public.result_claps (workout_id);

alter table public.result_claps enable row level security;

create policy "claps: read mine or received" on public.result_claps for select to authenticated using (
  from_user = auth.uid()
  or exists (select 1 from public.results r where r.id = result_id and r.athlete_id = auth.uid())
);
create policy "claps: insert own" on public.result_claps for insert to authenticated with check (
  from_user = auth.uid()
  and exists (
    select 1 from public.results r
    where r.id = result_id and r.workout_id = result_claps.workout_id and r.athlete_id <> auth.uid()
  )
  and public.can_see_workout(workout_id)
  and public.leaderboard_on(workout_id)
);

-- Clap count per score of a workout, for the scores the caller can see.
create function public.clap_counts(p_workout uuid) returns table (result_id uuid, claps int)
language sql stable security definer set search_path = '' as $$
  select c.result_id, count(*)::int
  from public.result_claps c join public.results r on r.id = c.result_id
  where c.workout_id = p_workout
    and (r.athlete_id = auth.uid() or public.can_edit_workout(p_workout)
      or (public.can_see_workout(p_workout) and public.leaderboard_on(p_workout)))
  group by c.result_id
$$;
