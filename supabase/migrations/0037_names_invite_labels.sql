-- Member first / last name (shown on the member page; the nickname stays everywhere else),
-- invitation label (who a link is for), and the member email readable by admins only.
alter table public.profiles
  add column first_name text check (char_length(first_name) between 1 and 40),
  add column last_name text check (char_length(last_name) between 1 and 40);
grant update (first_name, last_name) on public.profiles to authenticated;

alter table public.invitations add column label text check (char_length(label) between 1 and 60);

-- Emails live in auth.users: exposed to admins only, one member at a time.
create function public.member_email(p_user uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return (select email from auth.users where id = p_user);
end $$;

revoke execute on function public.member_email(uuid) from anon, public;
grant execute on function public.member_email(uuid) to authenticated;
