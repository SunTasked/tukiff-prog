-- M5: web push. Subscriptions per device, and a job that notifies members when workouts get published.

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;
create policy "push: own" on public.push_subscriptions
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Workouts already published before this feature are never notified.
alter table public.workouts add column notified_at timestamptz;
update public.workouts set notified_at = now() where publish_at <= now();

-- Marks newly published workouts as notified and returns who must be told (one row per member and workout).
-- Workouts published more than a day ago are marked without notifying (e.g. job down for a while).
create function public.claim_notifications()
returns table (user_id uuid, workout_id uuid, title text, date date)
language sql security definer set search_path = '' as $$
  with claimed as (
    update public.workouts w set notified_at = now()
    where w.date is not null and w.publish_at <= now() and w.notified_at is null
    returning w.id, w.title, w.date, w.publish_at
  )
  select distinct p.id, c.id, c.title, c.date
  from claimed c
  join public.workout_assignments a on a.workout_id = c.id
  join public.profiles p on p.role is not null and (
    (a.program_id is null and a.athlete_id is null)
    or a.athlete_id = p.id
    or exists (select 1 from public.program_members m where m.program_id = a.program_id and m.user_id = p.id)
  )
  where c.publish_at > now() - interval '1 day'
$$;
revoke execute on function public.claim_notifications() from public, anon, authenticated;
grant execute on function public.claim_notifications() to service_role;

-- Every 5 minutes, call the notify Edge Function with the shared secret stored in Vault.
create extension if not exists pg_net;
select cron.schedule('notify-published-workouts', '*/5 * * * *', $job$
  select net.http_post(
    url := 'https://adhodztyfvtcbederial.supabase.co/functions/v1/notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-notify-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'notify_secret')
    ),
    body := '{}'::jsonb
  )
$job$);
