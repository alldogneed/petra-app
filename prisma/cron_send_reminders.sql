-- Reliable 5-minute trigger for the WhatsApp reminder cron (Supabase pg_cron + pg_net).
--
-- Why: GitHub Actions scheduled runs are "best effort" — in Oct 2026 they started only every
-- 40-120 minutes, so reminders went out 1-3 hours late (support ticket, Nadav, 20.10). Vercel
-- Hobby crons are daily only. pg_cron runs inside the database on time.
-- The GitHub workflow (.github/workflows/cron.yml) stays as a fallback; overlapping runs are
-- safe because every message is claimed before it is sent (src/lib/scheduled-message-claim.ts).
--
-- STEP 1 — a dedicated random secret for this caller only (never in git), in Supabase Vault:
--   select vault.create_secret('<random value>', 'petra_cron_secret');
-- The app reads the same Vault row (verifyCronAuthWithVault() in src/lib/cron-auth.ts, 5-min
-- cache), so no deploy env var is needed. Rotate: vault.update_secret(...) — live within 5 min.
--
-- STEP 2 — this file (idempotent: re-running replaces the job):

create extension if not exists pg_net;
create extension if not exists pg_cron;

select cron.schedule(
  'petra-send-reminders',
  '*/5 * * * *',
  $job$
    select net.http_get(
      url := 'https://petra-app.com/api/cron/send-reminders',
      headers := jsonb_build_object(
        'Authorization',
        'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'petra_cron_secret' limit 1)
      ),
      timeout_milliseconds := 60000
    );
  $job$
);

-- Check:   select jobid, jobname, schedule, active from cron.job;
--          select status, return_message, start_time from cron.job_run_details order by start_time desc limit 10;
--          select status_code, left(content, 200), created from net._http_response order by created desc limit 10;
-- Remove:  select cron.unschedule('petra-send-reminders');
