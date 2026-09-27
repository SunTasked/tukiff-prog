-- pg_net's default 5 s timeout is shorter than the notify function's cold start.
select cron.schedule('notify-published-workouts', '*/5 * * * *', $job$
  select net.http_post(
    url := 'https://adhodztyfvtcbederial.supabase.co/functions/v1/notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-notify-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'notify_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  )
$job$);
