-- Team WODs (workout_blocks.params.team_size = 2..4): one result row per teammate with an account, all sharing
-- team_id and the same score. Teammates without an account are only names in team_guests ([{name, gender}], same
-- on every row of the team). Written and deleted through the RPCs below, by any teammate.
alter table public.results
  add column team_id uuid,
  add column team_guests jsonb check (team_guests is null or jsonb_typeof(team_guests) = 'array');
create index results_team_id_idx on public.results (team_id) where team_id is not null;

create function public.in_my_team(p_team uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.results where team_id = p_team and athlete_id = auth.uid())
$$;

-- My teammates' rows, even when the program's leaderboard is off.
create policy "results: read my team" on public.results for select to authenticated
  using (team_id is not null and public.in_my_team(team_id));

-- Program members (other than me) who can enter a score on this block: candidates for my team.
create function public.team_candidates(p_block uuid)
returns table (id uuid, first_name text, last_name text, display_name text, gender text, avatar_url text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.first_name, p.last_name, p.display_name, p.gender, p.avatar_url
  from public.workout_blocks b
  join public.workouts w on w.id = b.workout_id
  join public.program_members m on m.program_id = w.program_id
  join public.profiles p on p.id = m.user_id
  where b.id = p_block
    and public.can_see_block(p_block)
    and p.id <> auth.uid()
    and p.role is not null
    and public.block_min_level(b.params) <= m.level
$$;

create function internal.athlete_name(p_user uuid) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce(nullif(trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), ''), display_name, 'Un équipier')
  from public.profiles where id = p_user
$$;

-- Creates (p_team null) or replaces my team's score. Every teammate must be able to score the block and have no
-- other score on it (else an error naming them); teammates removed from the team lose the score. Returns team_id.
create function public.save_team_result(
  p_block uuid,
  p_team uuid,
  p_members uuid[],
  p_guests jsonb,
  p_time_s numeric,
  p_capped boolean,
  p_rounds int,
  p_reps int,
  p_load_kg numeric,
  p_rx boolean,
  p_comment text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_workout uuid;
  v_params jsonb;
  v_team uuid := coalesce(p_team, gen_random_uuid());
  v_members uuid[] := array(select distinct m from unnest(array_append(coalesce(p_members, '{}'), auth.uid())) m);
  v_guests jsonb := coalesce(p_guests, '[]');
  v_user uuid;
begin
  select workout_id, params into v_workout, v_params from public.workout_blocks where id = p_block;
  if v_workout is null or not public.can_see_block(p_block) then raise exception 'Bloc introuvable.'; end if;
  if cardinality(v_members) + jsonb_array_length(v_guests) not between 2 and 4 then
    raise exception 'Une équipe compte 2 à 4 athlètes.';
  end if;
  if p_team is not null and not exists (
    select 1 from public.results where team_id = p_team and block_id = p_block and athlete_id = auth.uid()
  ) then
    raise exception 'Tu ne fais pas partie de cette équipe.';
  end if;

  foreach v_user in array v_members loop
    if not exists (
      select 1 from public.workouts w
      join public.program_members m on m.program_id = w.program_id and m.user_id = v_user
      join public.profiles p on p.id = v_user and p.role is not null
      where w.id = v_workout and w.date is not null and w.publish_at <= now()
        and public.block_min_level(v_params) <= m.level
    ) then
      raise exception '% n''a pas accès à ce bloc.', internal.athlete_name(v_user);
    end if;
    if exists (
      select 1 from public.results
      where block_id = p_block and athlete_id = v_user and team_id is distinct from p_team
        -- My own solo score becomes the team's.
        and not (v_user = auth.uid() and team_id is null)
    ) then
      raise exception '% a déjà un score sur ce bloc.', internal.athlete_name(v_user);
    end if;
  end loop;

  delete from public.results where block_id = p_block and team_id = p_team and athlete_id <> all (v_members);
  insert into public.results (block_id, workout_id, athlete_id, team_id, team_guests, time_s, capped, rounds, reps, load_kg, rx, comment)
  select p_block, v_workout, m, v_team, nullif(v_guests, '[]'::jsonb), p_time_s, coalesce(p_capped, false), p_rounds, p_reps, p_load_kg,
    coalesce(p_rx, true), nullif(trim(p_comment), '')
  from unnest(v_members) m
  on conflict (block_id, athlete_id) do update set
    team_id = excluded.team_id, team_guests = excluded.team_guests, time_s = excluded.time_s, capped = excluded.capped,
    rounds = excluded.rounds, reps = excluded.reps, load_kg = excluded.load_kg, rx = excluded.rx, comment = excluded.comment;
  -- Scoring clears "Je passe".
  delete from public.block_skips where block_id = p_block and athlete_id = any (v_members);
  return v_team;
end $$;

-- Deletes the score of my team, for every teammate.
create function public.delete_team_result(p_team uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.in_my_team(p_team) then raise exception 'Tu ne fais pas partie de cette équipe.'; end if;
  delete from public.results where team_id = p_team;
end $$;

revoke execute on function public.in_my_team(uuid) from anon, public;
revoke execute on function public.team_candidates(uuid) from anon, public;
revoke execute on function internal.athlete_name(uuid) from anon, public;
revoke execute on function public.save_team_result(uuid, uuid, uuid[], jsonb, numeric, boolean, int, int, numeric, boolean, text) from anon, public;
revoke execute on function public.delete_team_result(uuid) from anon, public;
grant execute on function public.in_my_team(uuid) to authenticated;
grant execute on function public.team_candidates(uuid) to authenticated;
grant execute on function public.save_team_result(uuid, uuid, uuid[], jsonb, numeric, boolean, int, int, numeric, boolean, text) to authenticated;
grant execute on function public.delete_team_result(uuid) to authenticated;
