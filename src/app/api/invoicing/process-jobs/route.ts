export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { processPendingInvoiceJobs } from "@/lib/invoicing/invoicing-jobs";

// GET /api/invoicing/process-jobs — cron endpoint for retry queue
export async function GET(request: NextRequest) {
  // Protect with CRON_SECRET
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processPendingInvoiceJobs();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Process invoice jobs error:", error);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
