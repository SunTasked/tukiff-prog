-- Lift hierarchy: a record on a variant also counts for its parent lifts (a Power Snatch is a Snatch).
-- Transitive, same rep max, computed in the app. Fed here (no editing screen); Hang variants only count among Hang lifts.
create table public.exercise_links (
  exercise_id uuid not null references public.exercises on delete cascade,
  parent_id uuid not null references public.exercises on delete cascade,
  primary key (exercise_id, parent_id),
  check (exercise_id <> parent_id)
);
alter table public.exercise_links enable row level security;
create policy "exercise_links: members read" on public.exercise_links for select to authenticated
  using ((select public.is_member()));

insert into public.exercise_links (exercise_id, parent_id)
select c.id, p.id
from (values
  ('Squat Snatch', 'Snatch'),
  ('Power Snatch', 'Snatch'),
  ('Squat Clean', 'Clean'),
  ('Power Clean', 'Clean'),
  ('Clean & Jerk', 'Clean'),
  ('Hang Squat Clean', 'Hang Clean'),
  ('Hang Power Clean', 'Hang Clean'),
  ('Strict Press', 'Shoulder-to-Overhead'),
  ('Push Press', 'Shoulder-to-Overhead'),
  ('Push Jerk', 'Shoulder-to-Overhead'),
  ('Split Jerk', 'Shoulder-to-Overhead'),
  ('Strict Press', 'Push Press'),
  ('Snatch', 'Ground-to-Overhead'),
  ('Clean & Jerk', 'Ground-to-Overhead'),
  ('Squat Snatch', 'Overhead Squat')
) v (child, parent)
join public.exercises c on c.name = v.child
join public.exercises p on p.name = v.parent
on conflict do nothing;
