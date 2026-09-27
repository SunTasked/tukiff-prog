-- Push notifications removed (too intrusive for now). Reverts 0013 / 0014.
select cron.unschedule('notify-published-workouts');
drop function public.claim_notifications();
drop table public.push_subscriptions;
alter table public.workouts drop column notified_at;
delete from vault.secrets where name = 'notify_secret';
