-- 0006's check let (exercise_id null, label null) through: a null CHECK result passes.
delete from public.block_items where exercise_id is null and coalesce(trim(label), '') = '';
alter table public.block_items drop constraint block_items_check;
alter table public.block_items
  add constraint block_items_exercise_or_label check (exercise_id is not null or coalesce(trim(label), '') <> '');
