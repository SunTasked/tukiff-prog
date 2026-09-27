-- Library sections (e.g. "Benchmark CrossFit", "Hyrox", "Haltéro"): one section per library template,
-- shared by all coaches like the library itself.
create table public.library_sections (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 60),
  created_at timestamptz not null default now()
);
create unique index library_sections_name_key on public.library_sections (lower(trim(name)));

alter table public.library_sections enable row level security;
create policy "sections: coach all" on public.library_sections
  for all to authenticated using (public.is_coach()) with check (public.is_coach());

-- Deleting a section leaves its templates unsectioned. Scheduled copies never have a section.
alter table public.workouts add column section_id uuid references public.library_sections on delete set null;
alter table public.workouts add constraint section_only_on_templates check (section_id is null or date is null);
