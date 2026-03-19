-- Performance indexes migration
-- Generated 2026-03-19
-- Adds missing indexes for foreign-key columns and common where-clause columns
-- that are not already covered by @@index declarations in the Prisma schema.
-- All statements use CREATE INDEX IF NOT EXISTS to be idempotent.

-- ─── TimelineEvent ────────────────────────────────────────────────────────────
-- No @@index at all in schema — heavily queried by businessId and customerId
CREATE INDEX IF NOT EXISTS idx_timeline_event_business_id
  ON "TimelineEvent" ("businessId");

CREATE INDEX IF NOT EXISTS idx_timeline_event_customer_id
  ON "TimelineEvent" ("customerId");

CREATE INDEX IF NOT EXISTS idx_timeline_event_business_created
  ON "TimelineEvent" ("businessId", "createdAt" DESC);

-- ─── Order ────────────────────────────────────────────────────────────────────
-- Missing: createdAt filter (orders list page uses from/to date range on createdAt)
-- Missing: startAt filter (calendar view uses startFrom/startTo on startAt)
CREATE INDEX IF NOT EXISTS idx_order_business_created
  ON "Order" ("businessId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS idx_order_business_start
  ON "Order" ("businessId", "startAt");

-- ─── Payment ──────────────────────────────────────────────────────────────────
-- Missing: appointmentId FK, boardingStayId FK, customerId
CREATE INDEX IF NOT EXISTS idx_payment_appointment_id
  ON "Payment" ("appointmentId");

CREATE INDEX IF NOT EXISTS idx_payment_boarding_stay_id
  ON "Payment" ("boardingStayId");

CREATE INDEX IF NOT EXISTS idx_payment_customer_id
  ON "Payment" ("customerId");

CREATE INDEX IF NOT EXISTS idx_payment_business_created
  ON "Payment" ("businessId", "createdAt" DESC);

-- ─── Lead ─────────────────────────────────────────────────────────────────────
-- Missing: createdAt standalone (used in analytics/sort), customerId
CREATE INDEX IF NOT EXISTS idx_lead_business_created
  ON "Lead" ("businessId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS idx_lead_customer_id
  ON "Lead" ("customerId");

-- ─── Appointment ──────────────────────────────────────────────────────────────
-- Missing: petId FK, staffId FK (used in calendar staff filtering)
CREATE INDEX IF NOT EXISTS idx_appointment_pet_id
  ON "Appointment" ("petId");

CREATE INDEX IF NOT EXISTS idx_appointment_staff_id
  ON "Appointment" ("staffId");

-- ─── BoardingStay ─────────────────────────────────────────────────────────────
-- Missing: bookingId FK, status standalone for dashboard counts
CREATE INDEX IF NOT EXISTS idx_boarding_stay_booking_id
  ON "BoardingStay" ("bookingId");

CREATE INDEX IF NOT EXISTS idx_boarding_stay_business_status
  ON "BoardingStay" ("businessId", "status");

-- ─── Customer ─────────────────────────────────────────────────────────────────
-- Missing: name for search, phoneNorm for phone lookup
CREATE INDEX IF NOT EXISTS idx_customer_business_name
  ON "Customer" ("businessId", "name");

CREATE INDEX IF NOT EXISTS idx_customer_phone_norm
  ON "Customer" ("phoneNorm");

-- ─── Booking ──────────────────────────────────────────────────────────────────
-- Missing: priceListItemId FK
CREATE INDEX IF NOT EXISTS idx_booking_price_list_item_id
  ON "Booking" ("priceListItemId");

-- ─── TrainingGroupSession ─────────────────────────────────────────────────────
-- Missing: status (used to count upcoming/completed sessions)
CREATE INDEX IF NOT EXISTS idx_training_group_session_status
  ON "TrainingGroupSession" ("trainingGroupId", "status");

-- ─── ScheduledMessage ─────────────────────────────────────────────────────────
-- The cron job queries PENDING messages with sendAt <= now across ALL businesses.
-- A partial index on status=PENDING dramatically speeds up cron queries.
CREATE INDEX IF NOT EXISTS idx_scheduled_message_pending_send
  ON "ScheduledMessage" ("sendAt")
  WHERE "status" = 'PENDING';

-- ─── Task ─────────────────────────────────────────────────────────────────────
-- Missing: dueAt (used in daily-focus section to find overdue tasks)
CREATE INDEX IF NOT EXISTS idx_task_business_due_at
  ON "Task" ("businessId", "dueAt");

-- ─── SyncJob ──────────────────────────────────────────────────────────────────
-- Additional partial index for the cron worker querying queued jobs
CREATE INDEX IF NOT EXISTS idx_sync_job_queued
  ON "SyncJob" ("nextRunAt")
  WHERE "status" IN ('queued', 'processing');

-- ─── InvoiceJob ───────────────────────────────────────────────────────────────
-- Additional partial index for cron querying queued invoice jobs
CREATE INDEX IF NOT EXISTS idx_invoice_job_queued
  ON "InvoiceJob" ("nextRunAt")
  WHERE "status" IN ('queued', 'processing');

-- ─── ServiceDogProfile ────────────────────────────────────────────────────────
-- Missing: currentLocation (used in location filter on dogs list)
CREATE INDEX IF NOT EXISTS idx_service_dog_profile_location
  ON "ServiceDogProfile" ("businessId", "currentLocation");

-- ─── ServiceDogPlacement ──────────────────────────────────────────────────────
-- Missing: serviceDogId FK, recipientId FK (queried heavily on dog detail page)
CREATE INDEX IF NOT EXISTS idx_service_dog_placement_dog_id
  ON "ServiceDogPlacement" ("serviceDogId");

CREATE INDEX IF NOT EXISTS idx_service_dog_placement_recipient_id
  ON "ServiceDogPlacement" ("recipientId");

-- ─── ServiceDogComplianceEvent ────────────────────────────────────────────────
-- Missing: placementId FK
CREATE INDEX IF NOT EXISTS idx_service_dog_compliance_placement_id
  ON "ServiceDogComplianceEvent" ("placementId");

-- ─── ContractRequest ──────────────────────────────────────────────────────────
-- Missing: status (used to filter PENDING/SIGNED/EXPIRED)
CREATE INDEX IF NOT EXISTS idx_contract_request_business_status
  ON "ContractRequest" ("businessId", "status");

-- ─── PendingApproval ──────────────────────────────────────────────────────────
-- Missing: expiresAt (used by cron to expire stale approvals)
CREATE INDEX IF NOT EXISTS idx_pending_approval_expires_at
  ON "PendingApproval" ("expiresAt")
  WHERE "status" = 'PENDING';

-- ─── AdminSession ─────────────────────────────────────────────────────────────
-- Already has @@index([token]), @@index([userId]), @@index([expiresAt]) in schema.
-- Adding a composite for the common lookup pattern (token + expiresAt check):
CREATE INDEX IF NOT EXISTS idx_admin_session_token_expires
  ON "AdminSession" ("token", "expiresAt");
