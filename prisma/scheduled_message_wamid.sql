-- ScheduledMessage.wamid: Meta message id of the send, joins WhatsAppMessageLog
-- (delivered / read / failed) in /scheduled-messages. Additive, idempotent.
ALTER TABLE "ScheduledMessage" ADD COLUMN IF NOT EXISTS "wamid" TEXT;
