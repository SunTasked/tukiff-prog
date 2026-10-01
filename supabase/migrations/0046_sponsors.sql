-- Block sponsors ("powered by" + logo under the block title). The list is managed by admins
-- (Communauté); coaches pick one per block (workout_blocks.params.sponsor_id, carried by copies).
-- Removing a sponsor archives it so past blocks keep their logo.
create table public.sponsors (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 60),
  logo_url text,
  -- Logo drawn for a dark background (light logo); false = shown on a light pill.
  logo_dark boolean not null default false,
  link text check (link ~ '^https?://'),
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.sponsors enable row level security;

create policy "sponsors: read" on public.sponsors
  for select to authenticated using (true);
create policy "sponsors: admin insert" on public.sponsors
  for insert to authenticated with check (public.is_admin());
create policy "sponsors: admin update" on public.sponsors
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Public bucket: one PNG per sponsor at <sponsor id>.png, written by admins.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sponsors', 'sponsors', true, 524288, array['image/png'])
on conflict (id) do nothing;

create policy "sponsors: admin select" on storage.objects
  for select to authenticated using (bucket_id = 'sponsors' and public.is_admin());
create policy "sponsors: admin insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'sponsors' and public.is_admin());
create policy "sponsors: admin update" on storage.objects
  for update to authenticated using (bucket_id = 'sponsors' and public.is_admin());
