-- ============================================================
-- Petra App — Enable Row Level Security on ALL public tables
-- Run this once in the Supabase SQL Editor:
--   https://supabase.com/dashboard/project/ipeshpbikcfcwkvkztxn/sql/new
--
-- WHY: Supabase exposes all public tables via PostgREST.
-- Without RLS, any anon client can read/write every table.
-- With RLS enabled (no permissive policies), PostgREST
-- anon/authenticated roles are blocked. Prisma uses the
-- service_role key which BYPASSES RLS by design — so the
-- app continues to work exactly as before.
-- ============================================================

ALTER TABLE "public"."PlatformUser"                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."BusinessUser"                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."AdminSession"                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."PasswordResetToken"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."FeatureFlag"                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ActivityLog"                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."IpWhitelist"                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Customer"                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Pet"                           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Business"                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."User"                          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Appointment"                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Room"                          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."CallLog"                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Payment"                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."MessageTemplate"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Lead"                          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."LeadStage"                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Task"                          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."TaskTemplate"                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."TaskRecurrenceRule"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."TaskAuditLog"                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."TimelineEvent"                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."PriceList"                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."PriceListItem"                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ImportBatch"                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ImportRowIssue"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."SystemMessage"                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."AvailabilityRule"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."AvailabilityBlock"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."BookingDog"                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Order"                         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Booking"                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."OrderLine"                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."OnboardingProgress"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."TrainingProgram"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."TrainingGoal"                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."TrainingProgramSession"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."TrainingHomework"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."TrainingGroup"                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."TrainingGroupSession"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."TrainingGroupParticipant"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."SyncJob"                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."OnboardingProfile"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."IntakeForm"                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."AnalyticsEvent"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ExportJob"                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."DogHealth"                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."DogBehavior"                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."InvoicingSettings"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ScheduledMessage"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ServiceDogProfile"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."InvoiceWebhookLog"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ServiceDogRecipient"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ServiceDogPlacement"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ServiceDogMedicalProtocol"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ServiceDogTrainingLog"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ServiceDogComplianceEvent"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ServiceDogIDCard"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."InvoiceDocument"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."AuditLog"                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Service"                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."BoardingStay"                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."AutomationRule"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."TrainingGroupAttendance"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."DogMedication"                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."InvoiceJob"                    ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- DONE. No policies needed — service_role bypasses RLS.
-- PostgREST anon/authenticated access is now fully blocked.
-- Run the Supabase linter again to verify all ERRORs are gone.
-- ============================================================
