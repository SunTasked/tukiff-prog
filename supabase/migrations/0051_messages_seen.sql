-- Last release whose notes the user has read on the Messages page (e.g. '1.1.0'); null = never opened.
-- Kept on the profile rather than on the device so it follows the user across devices and PWA re-installs.
alter table public.profiles add column messages_seen text;
grant update (messages_seen) on public.profiles to authenticated;
