export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { processPendingSyncJobs } from "@/lib/sync-jobs";
import { verifyCronAuth } from "@/lib/cron-auth";

/**
 * GET /api/integrations/google/process-jobs
 * Processes pending Google Calendar sync jobs.
 * Called every 5 minutes via Vercel Cron.
 */
export async function GET(request: NextRequest) {
  try {
    if (!verifyCronAuth(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await processPendingSyncJobs();

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error processing sync jobs:", error);
    return NextResponse.json({ error: "Failed to process jobs" }, { status: 500 });
  }
}
