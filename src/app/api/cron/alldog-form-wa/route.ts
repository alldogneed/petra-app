export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth, verifyCronAuthWithVault } from "@/lib/cron-auth";

/**
 * GET /api/cron/alldog-form-wa
 *
 * AllDog item 34: sends the bot's first WhatsApp to website-form leads whose 3–5 minute delay is
 * over (src/lib/alldog/form-lead-wa.ts). Every minute from Supabase pg_cron
 * (prisma/cron_alldog_form_wa.sql); /api/cron/alldog-call-retry runs the same queue every 5 min as
 * a fallback. Safe to overlap: each row is claimed first. Auth: CRON_SECRET or the pg_cron Vault secret.
 */
export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request) && !(await verifyCronAuthWithVault(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { isFormWaEnabled } = await import("@/lib/alldog/form-lead-rules");
    if (!isFormWaEnabled()) return NextResponse.json({ ok: true, skipped: "disabled" });
    const { processDueFormLeadMessages } = await import("@/lib/alldog/form-lead-wa");
    const result = await processDueFormLeadMessages({ limit: 20 });
    return NextResponse.json({ ok: true, ...result, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error("CRON alldog-form-wa error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
