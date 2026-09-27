-- Exercise sections (e.g. "Ergos", "Haltéro"): one section per exercise, managed by coaches like library sections.
create table public.exercise_sections (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 60),
  created_at timestamptz not null default now()
);
create unique index exercise_sections_name_key on public.exercise_sections (lower(trim(name)));

alter table public.exercise_sections enable row level security;
create policy "exercise_sections: members read" on public.exercise_sections
  for select to authenticated using (public.is_member());
create policy "exercise_sections: coach write" on public.exercise_sections
  for all to authenticated using (public.is_coach()) with check (public.is_coach());

-- Deleting a section leaves its exercises unsectioned.
alter table public.exercises add column section_id uuid references public.exercise_sections on delete set null;
create index on public.exercises (section_id);

-- Initial sections for the default exercises (names matched case-insensitively; missing ones ignored).
insert into public.exercise_sections (name) values
  ('Basic fitness'), ('Gymnastique'), ('Force'), ('Haltéro'), ('Haltères & KB'), ('Ergos'), ('Course & portés'), ('Gainage')
on conflict do nothing;

update public.exercises e set section_id = s.id
from (values
  ('Basic fitness', array['Air Squat', 'Push-up', 'Burpee', 'Burpee Over the Bar', 'Box Jump', 'Box Jump Over', 'Step-up',
    'Lunge', 'Sit-up', 'V-up', 'Single-Under', 'Double-Under', 'Wall Ball']),
  ('Gymnastique', array['Pull-up', 'Chest-to-Bar Pull-up', 'Jumping Pull-up', 'Ring Row', 'Toes-to-Bar', 'Knees-to-Elbows',
    'Bar Muscle-up', 'Ring Muscle-up', 'Ring Dip', 'Handstand Push-up', 'Handstand Walk', 'Rope Climb', 'Pistol', 'GHD Sit-up']),
  ('Force', array['Back Squat', 'Front Squat', 'Overhead Squat', 'Deadlift', 'Strict Press', 'Push Press', 'Bench Press',
    'Front Rack Lunge', 'Thruster']),
  ('Haltéro', array['Power Clean', 'Squat Clean', 'Hang Power Clean', 'Hang Squat Clean', 'Clean & Jerk', 'Power Snatch',
    'Squat Snatch', 'Hang Power Snatch', 'Push Jerk', 'Split Jerk', 'Sumo Deadlift High Pull']),
  ('Haltères & KB', array['Dumbbell Snatch', 'Dumbbell Thruster', 'Devil Press', 'Goblet Squat', 'Kettlebell Swing']),
  ('Ergos', array['Row', 'Assault Bike', 'Echo Bike', 'Ski Erg']),
  ('Course & portés', array['Run', 'Shuttle Run', 'Farmer Carry', 'Sled Push', 'Walking Lunge']),
  ('Gainage', array['Plank', 'Hollow Hold', 'L-Sit', 'Wall Sit'])
) as m(section, names)
join public.exercise_sections s on lower(s.name) = lower(m.section)
where lower(trim(e.name)) in (select lower(n) from unnest(m.names) n)
  and e.section_id is null;
