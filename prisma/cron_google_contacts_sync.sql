-- Hourly safety net for Google Contacts lead sync (CLAUDE.md rule #42).
-- Same Vault secret as prisma/cron_send_reminders.sql. Idempotent: re-running replaces the job.
create extension if not exists pg_net;
create extension if not exists pg_cron;

select cron.schedule(
  'petra-google-contacts-sync',
  '17 * * * *',
  $job$
    select net.http_get(
      url := 'https://petra-app.com/api/cron/google-contacts-sync',
      headers := jsonb_build_object(
        'Authorization',
        'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'petra_cron_secret' limit 1)
      ),
      timeout_milliseconds := 60000
    );
  $job$
);

-- Remove: select cron.unschedule('petra-google-contacts-sync');
