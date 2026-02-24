import { NextRequest, NextResponse } from "next/server";
import { processPendingSyncJobs } from "@/lib/sync-jobs";

/**
 * GET /api/integrations/google/process-jobs?secret=CRON_SECRET
 * Processes pending Google Calendar sync jobs.
 * Should be called by a cron scheduler (Vercel Cron, external service, etc.)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get("secret");

    // Verify CRON_SECRET
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await processPendingSyncJobs();

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error processing sync jobs:", error);
    return NextResponse.json({ error: "Failed to process jobs" }, { status: 500 });
  }
}
