export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { runSupportSlaCheck } from "@/services/support-tickets";

/**
 * GET /api/cron/support-sla — tickets waiting on the Petra team past SUPPORT_SLA_HOURS
 * → one WhatsApp + email digest to the platform owner. Each ticket is alerted once
 * per waiting period. New tickets/replies are alerted instantly elsewhere; this is the net.
 */
export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await runSupportSlaCheck());
  } catch (err) {
    console.error("[cron/support-sla] failed:", err);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
