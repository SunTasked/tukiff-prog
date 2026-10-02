-- Messages page (release notes).
-- Last release whose notes the user has read on the Messages page (e.g. '1.1.0'); null = never opened.
-- Kept on the profile rather than on the device so it follows the user across devices and PWA re-installs.
-- notify_updates = false: the user opted out of the red dot for new releases (the Messages page stays reachable).
alter table public.profiles add column messages_seen text, add column notify_updates boolean not null default true;
grant update (messages_seen, notify_updates) on public.profiles to authenticated;
