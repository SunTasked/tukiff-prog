-- Block titles become mandatory: untitled blocks get their format summary as title
-- (same text as formatSummary in src/domain/workout.ts), or their former category for "Libre" blocks.
create function pg_temp.short_duration(s int) returns text language sql immutable as $$
  select case
    when s / 60 = 0 then s || '"'
    when s % 60 = 0 then (s / 60) || ''''
    else (s / 60) || '''' || lpad((s % 60)::text, 2, '0')
  end
$$;

create function pg_temp.format_summary(format text, p jsonb) returns text language plpgsql immutable as $$
declare
  n int;
  interval_s int;
begin
  case format
    when 'for_time' then
      n := nullif((p->>'rounds')::numeric, 0)::int;
      return case when n > 1 then n || ' rounds ' else '' end || 'For Time'
        || coalesce(' · cap ' || pg_temp.short_duration(nullif((p->>'time_cap_s')::numeric, 0)::int), '');
    when 'amrap' then
      return 'AMRAP' || coalesce(' ' || pg_temp.short_duration(nullif((p->>'duration_s')::numeric, 0)::int), '');
    when 'emom' then
      interval_s := coalesce(nullif((p->>'interval_s')::numeric, 0)::int, 60);
      n := nullif((p->>'rounds')::numeric, 0)::int;
      return case when interval_s = 60 then 'EMOM' else 'E' || pg_temp.short_duration(interval_s) || 'MOM' end
        || coalesce(' ' || pg_temp.short_duration(interval_s * n), '');
    when 'tabata' then
      return 'Tabata ' || coalesce((p->>'rounds')::numeric::int, 8) || ' × ' || coalesce((p->>'work_s')::numeric::int, 20)
        || '"/' || coalesce((p->>'rest_s')::numeric::int, 10) || '"';
    when 'sets_reps' then
      n := nullif((p->>'sets')::numeric, 0)::int;
      return coalesce(n || ' séries', 'Séries');
    else
      return null;
  end case;
end
$$;

update public.workout_blocks
set title = coalesce(
  pg_temp.format_summary(format, params),
  case kind
    when 'warmup' then 'Échauffement'
    when 'strength' then 'Force'
    when 'skill' then 'Skill'
    when 'metcon' then 'Metcon'
    when 'accessory' then 'Accessoires'
    when 'cooldown' then 'Retour au calme'
  end
)
where coalesce(trim(title), '') = '';
