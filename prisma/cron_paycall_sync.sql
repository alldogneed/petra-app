-- PayCall safety-net sync every 10 minutes (was once a day at 09:00 Israel via vercel.json).
-- Catches calls the realtime webhook missed: missed calls → lead / customer note + task,
-- answered calls ≥ 20 s → summary through the retry queue. Idempotent (call_id), so overlapping
-- with the webhook is safe. Same mechanism + Vault secret as prisma/cron_alldog_call_retry.sql.
-- Re-running replaces the job.

create extension if not exists pg_net;
create extension if not exists pg_cron;

select cron.schedule(
  'petra-paycall-sync',
  '*/10 * * * *',
  $job$
    select net.http_get(
      url := 'https://petra-app.com/api/cron/paycall-sync',
      headers := jsonb_build_object(
        'Authorization',
        'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'petra_cron_secret' limit 1)
      ),
      timeout_milliseconds := 300000
    );
  $job$
);

-- Check:   select jobid, jobname, schedule, active from cron.job where jobname = 'petra-paycall-sync';
-- Remove:  select cron.unschedule('petra-paycall-sync');
