-- Profile gender (separate men / women leaderboards) and profile picture.
-- Existing accounts are men; new accounts choose during onboarding (null until then).
alter table public.profiles add column gender text check (gender in ('male', 'female'));
update public.profiles set gender = 'male';
alter table public.profiles add column avatar_url text;

grant update (gender, avatar_url) on public.profiles to authenticated;

-- Public bucket: one file per user at <user id>/avatar.jpg, writable only by its owner.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1048576, array['image/jpeg'])
on conflict (id) do nothing;

-- Upsert (replace the picture) also needs select on the row.
create policy "avatars: owner select" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: owner insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: owner update" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
