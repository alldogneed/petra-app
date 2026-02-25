import { NextRequest, NextResponse } from "next/server";
import { processPendingSyncJobs } from "@/lib/sync-jobs";

/**
 * GET /api/integrations/google/process-jobs  (pass secret via x-cron-secret header)
 * Processes pending Google Calendar sync jobs.
 * Should be called by a cron scheduler (Vercel Cron, external service, etc.)
 */
export async function GET(request: NextRequest) {
  try {
    const secret = request.headers.get("x-cron-secret") || new URL(request.url).searchParams.get("secret");

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
