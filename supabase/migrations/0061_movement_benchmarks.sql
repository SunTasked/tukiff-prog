-- Movements shown as benchmarks, in a category of their own ("Haltéro", "Gym suspendue"), with the box leaderboard of their
-- records (exercise pages have none). Fed here like benchmarks (no editing screen).
alter table public.exercises add column benchmark_category text
  constraint exercises_benchmark_category_check check (benchmark_category in ('Haltéro', 'Gym suspendue'));

update public.exercises e set benchmark_category = v.category
from (values
  ('Back Squat', 'Haltéro'), ('Front Squat', 'Haltéro'), ('Deadlift', 'Haltéro'), ('Bench Press', 'Haltéro'),
  ('Strict Press', 'Haltéro'), ('Push Press', 'Haltéro'), ('Push Jerk', 'Haltéro'), ('Overhead Squat', 'Haltéro'),
  ('Clean', 'Haltéro'), ('Power Clean', 'Haltéro'), ('Clean & Jerk', 'Haltéro'), ('Snatch', 'Haltéro'),
  ('Power Snatch', 'Haltéro'), ('Thruster', 'Haltéro'),
  ('Toes-to-Bar', 'Gym suspendue'), ('Chest-to-Bar Pull-up', 'Gym suspendue'), ('Bar Muscle-up', 'Gym suspendue'),
  ('Ring Muscle-up', 'Gym suspendue')
) v(name, category)
where e.name = v.name;
