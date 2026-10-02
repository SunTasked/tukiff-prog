-- Claps notification on the Messages page: nothing is stored but the moment the user last read their claps.
-- Existing users start from now, so the first notification is not every clap ever received.
alter table public.profiles add column claps_seen_at timestamptz not null default now();
grant update (claps_seen_at) on public.profiles to authenticated;

-- Members who clapped my scores (team scores included: a team clap is stored on one teammate's row) since I last read them.
create function public.new_clappers() returns int
language sql stable security definer set search_path = '' as $$
  select count(distinct c.from_user)::int
  from public.result_claps c
  join public.results r on r.id = c.result_id
  where c.created_at > (select claps_seen_at from public.profiles where id = (select auth.uid()))
    and c.from_user <> (select auth.uid())
    and (r.athlete_id = (select auth.uid())
      or r.team_id in (select team_id from public.results where athlete_id = (select auth.uid()) and team_id is not null))
$$;
revoke execute on function public.new_clappers() from anon, public;
grant execute on function public.new_clappers() to authenticated;

-- Compliments drawn at random after the claps message, managed by admins in Communauté.
-- text_female: the women's version when the text depends on gender (null = same text for everyone).
create table public.clap_compliments (
  id uuid primary key default gen_random_uuid(),
  text text not null check (length(trim(text)) > 0),
  text_female text,
  created_at timestamptz not null default now()
);
alter table public.clap_compliments enable row level security;
create policy "clap_compliments: read" on public.clap_compliments for select to authenticated using (true);
create policy "clap_compliments: admin insert" on public.clap_compliments for insert to authenticated with check ((select public.is_admin()));
create policy "clap_compliments: admin update" on public.clap_compliments for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "clap_compliments: admin delete" on public.clap_compliments for delete to authenticated using ((select public.is_admin()));

insert into public.clap_compliments (text, text_female) values
  ('Grosse machine va', null),
  ('C''est qui le patron ?!', 'C''est qui la patronne ?!'),
  ('Ti é un tigre !', null),
  ('Ok monsieur', 'Ok madame'),
  ('Chargééé !!!', null),
  ('Va falloir arrêter les produits, ça commence à se voir.', null),
  ('🔥🔥🔥', null),
  ('Fort et famous en plus', 'Forte et famous en plus');
