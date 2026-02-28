export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { processPendingSyncJobs } from "@/lib/sync-jobs";
import crypto from "crypto";

/**
 * GET /api/integrations/google/process-jobs  (pass secret via x-cron-secret header)
 * Processes pending Google Calendar sync jobs.
 * Should be called by a cron scheduler (Vercel Cron, external service, etc.)
 */
export async function GET(request: NextRequest) {
  try {
    const secret = request.headers.get("x-cron-secret");
    const cronSecret = process.env.CRON_SECRET;

    // Verify CRON_SECRET using timing-safe comparison to prevent timing attacks
    let authorized = false;
    if (cronSecret && secret) {
      try {
        authorized = crypto.timingSafeEqual(Buffer.from(secret), Buffer.from(cronSecret));
      } catch {
        // Different buffer lengths → no match
      }
    }
    if (!authorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await processPendingSyncJobs();

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error processing sync jobs:", error);
    return NextResponse.json({ error: "Failed to process jobs" }, { status: 500 });
  }
}
