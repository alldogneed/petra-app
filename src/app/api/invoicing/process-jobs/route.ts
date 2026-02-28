export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { processPendingInvoiceJobs } from "@/lib/invoicing/invoicing-jobs";
import crypto from "crypto";

// GET /api/invoicing/process-jobs — cron endpoint for retry queue
export async function GET(request: NextRequest) {
  // Protect with CRON_SECRET using timing-safe comparison
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  let authorized = false;
  if (cronSecret && authHeader) {
    const expectedAuth = `Bearer ${cronSecret}`;
    try {
      authorized = crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(expectedAuth));
    } catch {
      // Different buffer lengths → no match
    }
  }
  if (!authorized) {
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
