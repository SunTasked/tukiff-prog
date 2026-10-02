-- Messages page (release notes) and notification preferences.
-- messages_seen: last release whose notes the user has read on the Messages page (e.g. '1.1.0'); null = never opened.
-- Kept on the profile rather than on the device so it follows the user across devices and PWA re-installs.
-- notifications: opt-outs, {"all": false} turns everything off, {"<category>": false} one category
-- (updates for now; claps, new WODs, leaderboards later). A missing key means on, so new categories need no migration.
alter table public.profiles
  add column messages_seen text,
  add column notifications jsonb not null default '{}';
grant update (messages_seen, notifications) on public.profiles to authenticated;
