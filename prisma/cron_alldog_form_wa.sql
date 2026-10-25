-- Every-minute trigger for AllDog item 34 (the bot's first WhatsApp to website-form leads, sent
-- 3–5 min after the lead). Same mechanism + Vault secret as prisma/cron_alldog_call_retry.sql.
-- Idempotent: re-running replaces the job. The endpoint answers {skipped:"disabled"} while
-- ALLDOG_FORM_WA_ENABLED is off, so the job may be created before the switch is turned on.

create extension if not exists pg_net;
create extension if not exists pg_cron;

select cron.schedule(
  'petra-alldog-form-wa',
  '* * * * *',
  $job$
    select net.http_get(
      url := 'https://petra-app.com/api/cron/alldog-form-wa',
      headers := jsonb_build_object(
        'Authorization',
        'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'petra_cron_secret' limit 1)
      ),
      timeout_milliseconds := 30000
    );
  $job$
);

-- Check:   select jobid, jobname, schedule, active from cron.job where jobname = 'petra-alldog-form-wa';
-- Remove:  select cron.unschedule('petra-alldog-form-wa');
