-- Every-5-minutes trigger for AllDog item 36 (one-time transcription of past PayCall recordings).
-- Same mechanism + Vault secret as prisma/cron_alldog_call_retry.sql. Run only after
-- prisma/alldog_transcript_backfill.sql and after the table was seeded once:
--   GET https://petra-app.com/api/cron/alldog-transcribe-backfill?seed=1  (same Bearer secret)
-- Each run transcribes up to 4 calls (≤ 240 s). Remove the job once the response shows left = 0.

create extension if not exists pg_net;
create extension if not exists pg_cron;

select cron.schedule(
  'petra-alldog-transcribe-backfill',
  '*/5 * * * *',
  $job$
    select net.http_get(
      url := 'https://petra-app.com/api/cron/alldog-transcribe-backfill',
      headers := jsonb_build_object(
        'Authorization',
        'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'petra_cron_secret' limit 1)
      ),
      timeout_milliseconds := 300000
    );
  $job$
);

-- Check:   select status, count(*) from "AllDogCallTranscriptBackfill" group by status;
-- Remove:  select cron.unschedule('petra-alldog-transcribe-backfill');
