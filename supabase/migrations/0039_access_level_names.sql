-- Names of the access levels, per program (index = program_members.level = block params.min_level).
alter table public.programs add column access_levels text[] not null default '{Free,Premium}'
  check (array_length(access_levels, 1) between 2 and 10);
