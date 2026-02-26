/**
 * Invoice job queue processor.
 *
 * Mirrors sync-jobs.ts pattern: up to 3 attempts with exponential backoff.
 * Called from /api/invoicing/process-jobs.
 */

import { prisma } from "../prisma";
import { InvoicingService } from "./invoicing-service";
import type { DocumentType } from "./types";

const MAX_ATTEMPTS = 3;

const BACKOFF_MS = [
  1 * 60 * 1000, // 1 minute
  5 * 60 * 1000, // 5 minutes
  30 * 60 * 1000, // 30 minutes
];

/**
 * Enqueue a document issuance job. Deduplicates by payment+action.
 */
export async function enqueueInvoiceJob(params: {
  businessId: string;
  paymentId: string;
  customerId: string;
  action: "issue_document" | "credit_note";
  docType?: number;
  payloadJson?: string;
}): Promise<void> {
  // Deduplicate: skip if a queued/processing job already exists for same payment+action
  const existing = await prisma.invoiceJob.findFirst({
    where: {
      paymentId: params.paymentId,
      action: params.action,
      status: { in: ["queued", "processing"] },
    },
  });
  if (existing) return;

  await prisma.invoiceJob.create({
    data: {
      businessId: params.businessId,
      paymentId: params.paymentId,
      customerId: params.customerId,
      action: params.action,
      docType: params.docType,
      payloadJson: params.payloadJson ?? "{}",
      status: "queued",
      nextRunAt: new Date(),
    },
  });
}

/**
 * Process all due invoice jobs.
 * Returns counts of processed/failed/skipped.
 */
export async function processPendingInvoiceJobs(): Promise<{
  processed: number;
  failed: number;
  skipped: number;
}> {
  const now = new Date();

  const jobs = await prisma.invoiceJob.findMany({
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
    await prisma.invoiceJob.update({
      where: { id: job.id },
      data: { status: "processing" },
    });

    try {
      // Verify payment still exists
      const payment = await prisma.payment.findUnique({
        where: { id: job.paymentId },
        select: { id: true, status: true },
      });

      if (!payment) {
        await prisma.invoiceJob.update({
          where: { id: job.id },
          data: { status: "done", lastError: "Payment not found — skipped" },
        });
        skipped++;
        continue;
      }

      // Skip if payment is no longer paid
      if (job.action === "issue_document" && payment.status !== "paid") {
        await prisma.invoiceJob.update({
          where: { id: job.id },
          data: {
            status: "done",
            lastError: `Skipped: payment status is ${payment.status}`,
          },
        });
        skipped++;
        continue;
      }

      // Issue document
      const result = await InvoicingService.issue(
        job.businessId,
        job.paymentId,
        job.docType ? { docType: job.docType as DocumentType } : undefined
      );

      await prisma.invoiceJob.update({
        where: { id: job.id },
        data: {
          status: "done",
          attempts: job.attempts + 1,
          resultJson: JSON.stringify(result),
        },
      });

      processed++;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const newAttempts = job.attempts + 1;

      // Client errors (400/401) → fail immediately
      const isClientError =
        errorMsg.includes("(400)") ||
        errorMsg.includes("(401)") ||
        errorMsg.includes("(403)") ||
        errorMsg.includes("לא תקין");

      if (newAttempts >= MAX_ATTEMPTS || isClientError) {
        await prisma.invoiceJob.update({
          where: { id: job.id },
          data: {
            status: "failed",
            attempts: newAttempts,
            lastError: errorMsg,
          },
        });
        failed++;
      } else {
        // Retry with backoff
        const backoffMs =
          BACKOFF_MS[newAttempts - 1] ?? BACKOFF_MS[BACKOFF_MS.length - 1];
        const nextRunAt = new Date(Date.now() + backoffMs);

        await prisma.invoiceJob.update({
          where: { id: job.id },
          data: {
            status: "queued",
            attempts: newAttempts,
            lastError: errorMsg,
            nextRunAt,
          },
        });
      }
    }
  }

  return { processed, failed, skipped };
}
