-- Members only see active members (role set), plus their own profile.
drop policy "profiles: read own or as member" on public.profiles;
create policy "profiles: read own or members" on public.profiles
  for select to authenticated
  using (id = auth.uid() or (public.is_member() and role is not null));
