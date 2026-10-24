-- 5-minute trigger for the AllDog answered-call retry queue (Supabase pg_cron + pg_net).
-- Same mechanism and Vault secret as prisma/cron_send_reminders.sql (run that file's STEP 1 first).
-- GitHub Actions (.github/workflows/cron.yml) is only a fallback: it starts every 40-120 min.
-- Idempotent: re-running replaces the job. The endpoint answers {skipped:"disabled"} while
-- ALLDOG_CALL_SUMMARIES_ENABLED is off.

create extension if not exists pg_net;
create extension if not exists pg_cron;

select cron.schedule(
  'petra-alldog-call-retry',
  '*/5 * * * *',
  $job$
    select net.http_get(
      url := 'https://petra-app.com/api/cron/alldog-call-retry',
      headers := jsonb_build_object(
        'Authorization',
        'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'petra_cron_secret' limit 1)
      ),
      timeout_milliseconds := 60000
    );
  $job$
);

-- Check:   select jobid, jobname, schedule, active from cron.job where jobname = 'petra-alldog-call-retry';
--          select status_code, left(content, 300), created from net._http_response order by created desc limit 10;
-- Remove:  select cron.unschedule('petra-alldog-call-retry');
