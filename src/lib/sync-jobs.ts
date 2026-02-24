/**
 * Google Calendar sync job queue processor.
 *
 * Jobs are stored in SyncJob table.
 * Retry strategy: up to 3 attempts with exponential backoff (1 min, 5 min, 30 min).
 * This module is called from the API route /api/integrations/google/process-jobs.
 */

import { prisma } from "./prisma";
import {
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  findConnectedUsersForBusiness,
} from "./google-calendar";

const MAX_ATTEMPTS = 3;

// Exponential backoff delays in milliseconds
const BACKOFF_MS = [
  1 * 60 * 1000,   // 1 minute
  5 * 60 * 1000,   // 5 minutes
  30 * 60 * 1000,  // 30 minutes
];

type SyncAction = "create" | "update" | "delete";

/**
 * Enqueue a sync job for a booking.
 * Creates a job for EVERY connected business member (so all connected calendars sync).
 * Deduplicates: if a pending/queued job exists for the same booking+action+user, skip.
 * For "delete", cancels any existing pending create/update jobs.
 */
export async function enqueueSyncJob(
  bookingId: string,
  businessId: string,
  action: SyncAction
): Promise<void> {
  // Find all connected users for this business
  const connectedUsers = await findConnectedUsersForBusiness(businessId);
  const syncableUsers = connectedUsers.filter((u) => u.gcalSyncEnabled);
  if (syncableUsers.length === 0) return; // No connected users → skip

  // For delete: cancel any pending create/update jobs for this booking
  if (action === "delete") {
    await prisma.syncJob.updateMany({
      where: {
        bookingId,
        status: { in: ["queued", "processing"] },
        action: { in: ["create", "update"] },
      },
      data: { status: "failed", lastError: "Superseded by delete action" },
    });
  }

  for (const user of syncableUsers) {
    // Deduplicate: avoid duplicate queued jobs for same action+user
    const existing = await prisma.syncJob.findFirst({
      where: {
        bookingId,
        userId: user.id,
        action,
        status: { in: ["queued", "processing"] },
      },
    });
    if (existing) continue;

    await prisma.syncJob.create({
      data: {
        businessId,
        userId: user.id,
        bookingId,
        action,
        status: "queued",
        nextRunAt: new Date(),
      },
    });
  }

  // Mark booking as pending sync
  await prisma.booking.update({
    where: { id: bookingId },
    data: { gcalSyncStatus: "pending" },
  });
}

/**
 * Process all due sync jobs.
 * Should be called from a cron endpoint or background worker.
 * Returns counts of processed/failed jobs.
 */
export async function processPendingSyncJobs(): Promise<{
  processed: number;
  failed: number;
  skipped: number;
}> {
  const now = new Date();

  // Fetch due jobs (limit batch size to 50)
  const jobs = await prisma.syncJob.findMany({
    where: {
      status: "queued",
      nextRunAt: { lte: now },
    },
    orderBy: { nextRunAt: "asc" },
    take: 50,
  });

  let processed = 0;
  let failed = 0;
  let skipped = 0;

  for (const job of jobs) {
    // Mark as processing
    await prisma.syncJob.update({
      where: { id: job.id },
      data: { status: "processing" },
    });

    try {
      // Verify booking still exists
      const booking = await prisma.booking.findUnique({
        where: { id: job.bookingId },
        select: { id: true, status: true, businessId: true },
      });

      if (!booking) {
        await prisma.syncJob.update({
          where: { id: job.id },
          data: { status: "done", lastError: "Booking not found — skipped" },
        });
        skipped++;
        continue;
      }

      // Skip create/update if booking is no longer confirmed/completed
      if (
        ["create", "update"].includes(job.action) &&
        !["confirmed", "completed"].includes(booking.status)
      ) {
        await prisma.syncJob.update({
          where: { id: job.id },
          data: {
            status: "done",
            lastError: `Skipped: booking status is ${booking.status}`,
          },
        });
        await prisma.booking.update({
          where: { id: booking.id },
          data: { gcalSyncStatus: "disabled" },
        });
        skipped++;
        continue;
      }

      // Execute the sync action
      switch (job.action as SyncAction) {
        case "create":
          await createCalendarEvent(job.userId, job.bookingId);
          break;
        case "update":
          await updateCalendarEvent(job.userId, job.bookingId);
          break;
        case "delete":
          await deleteCalendarEvent(job.userId, job.bookingId);
          break;
      }

      await prisma.syncJob.update({
        where: { id: job.id },
        data: { status: "done", attempts: job.attempts + 1 },
      });

      processed++;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const newAttempts = job.attempts + 1;

      if (newAttempts >= MAX_ATTEMPTS) {
        // Permanently failed
        await prisma.syncJob.update({
          where: { id: job.id },
          data: {
            status: "failed",
            attempts: newAttempts,
            lastError: errorMsg,
          },
        });

        // Mark booking sync as failed
        await prisma.booking.update({
          where: { id: job.bookingId },
          data: {
            gcalSyncStatus: "failed",
            gcalSyncError: errorMsg,
          },
        });

        failed++;
      } else {
        // Retry with exponential backoff
        const backoffMs = BACKOFF_MS[newAttempts - 1] ?? BACKOFF_MS[BACKOFF_MS.length - 1];
        const nextRunAt = new Date(Date.now() + backoffMs);

        await prisma.syncJob.update({
          where: { id: job.id },
          data: {
            status: "queued",
            attempts: newAttempts,
            lastError: errorMsg,
            nextRunAt,
          },
        });

        await prisma.booking.update({
          where: { id: job.bookingId },
          data: {
            gcalSyncStatus: "pending",
            gcalSyncError: errorMsg,
          },
        });
      }
    }
  }

  return { processed, failed, skipped };
}

/**
 * Retry a specific failed booking sync — creates a fresh job.
 */
export async function retryBookingSync(
  bookingId: string,
  businessId: string
): Promise<void> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { status: true, gcalEventId: true },
  });

  if (!booking) throw new Error("Booking not found");

  const action: SyncAction =
    booking.status === "cancelled" || booking.status === "declined"
      ? "delete"
      : booking.gcalEventId
        ? "update"
        : "create";

  // Cancel existing failed jobs
  await prisma.syncJob.updateMany({
    where: { bookingId, status: "failed" },
    data: { status: "done", lastError: "Superseded by manual retry" },
  });

  await enqueueSyncJob(bookingId, businessId, action);
}
