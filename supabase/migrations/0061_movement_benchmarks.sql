-- Movements shown as benchmarks, in a category of their own ("Force", "Haltéro", "Gym suspendue"), with the box leaderboard of their
-- records (exercise pages have none). Fed here like benchmarks (no editing screen).
alter table public.exercises add column benchmark_category text
  constraint exercises_benchmark_category_check check (benchmark_category in ('Force', 'Haltéro', 'Gym suspendue'));

update public.exercises e set benchmark_category = v.category
from (values
  ('Back Squat', 'Force'), ('Front Squat', 'Force'), ('Overhead Squat', 'Force'), ('Deadlift', 'Force'),
  ('Bench Press', 'Force'), ('Strict Press', 'Force'), ('Push Press', 'Force'), ('Thruster', 'Force'),
  ('Clean', 'Haltéro'), ('Power Clean', 'Haltéro'), ('Clean & Jerk', 'Haltéro'), ('Snatch', 'Haltéro'),
  ('Power Snatch', 'Haltéro'), ('Push Jerk', 'Haltéro'),
  ('Toes-to-Bar', 'Gym suspendue'), ('Chest-to-Bar Pull-up', 'Gym suspendue'), ('Bar Muscle-up', 'Gym suspendue'),
  ('Ring Muscle-up', 'Gym suspendue')
) v(name, category)
where e.name = v.name;
