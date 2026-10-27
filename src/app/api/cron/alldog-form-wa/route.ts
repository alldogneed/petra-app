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
 * a fallback. Safe to overlap: each row is claimed first.
 * The same run sends the bot's one reminder + partial closing (src/lib/alldog-bot/nudge.ts, Or 27/10). Auth: CRON_SECRET or the pg_cron Vault secret.
 */
export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request) && !(await verifyCronAuthWithVault(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { isFormWaEnabled } = await import("@/lib/alldog/form-lead-rules");
    const result = isFormWaEnabled()
      ? await (await import("@/lib/alldog/form-lead-wa")).processDueFormLeadMessages({ limit: 20 })
      : { skipped: "disabled" };
    // Or, 27/10: the bot's one reminder (4–6 min of silence) + the partial closing (2 h later).
    const nudges = await (await import("@/lib/alldog-bot/nudge")).processDueNudges({ budgetMs: 25_000, limit: 30 });
    return NextResponse.json({ ok: true, ...result, nudges, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error("CRON alldog-form-wa error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
