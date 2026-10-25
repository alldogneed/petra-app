export const dynamic = "force-dynamic";
// Each attempt = recording download + transcription + summary (tens of seconds).
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth, verifyCronAuthWithVault } from "@/lib/cron-auth";
import { isCallSummariesEnabled, isWaBotEnabled } from "@/lib/alldog/config";

/**
 * GET /api/cron/alldog-call-retry
 *
 * Runs the due attempts of the answered-call retry queue (src/lib/alldog/call-retry.ts):
 * +3 min, +10 min, +30 min, +2 h (final). Every 5 minutes from Supabase pg_cron
 * (prisma/cron_alldog_call_retry.sql) with the GitHub workflow as a fallback
 * (Vercel Hobby crons are daily only). Safe to overlap: each call row is claimed first.
 * The same run also summarizes AllDog WhatsApp-bot conversations quiet for 30+ minutes into their
 * lead journal (src/lib/alldog-bot/summary.ts, Or item 27i) — one CallLog per conversation.
 * Auth: CRON_SECRET / CRON_SECRET_DB or the pg_cron Vault secret.
 */
export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request) && !(await verifyCronAuthWithVault(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const calls = isCallSummariesEnabled()
      ? await (await import("@/lib/alldog/call-retry")).processDueRetries({ budgetMs: 200_000, limit: 20 })
      : { skipped: "disabled" };
    const bot = isWaBotEnabled()
      ? await (await import("@/lib/alldog-bot/summary")).summarizeIdleConversations({ budgetMs: 40_000, limit: 10 })
      : { skipped: "disabled" };
    // Item 32: automatic WhatsApp after a missed call — the messages held for 08:00 / after Shabbat.
    const { isMissedCallWaEnabled } = await import("@/lib/alldog/missed-call-rules");
    const missedCallWa = isMissedCallWaEnabled()
      ? await (await import("@/lib/alldog/missed-call-wa")).processDueMissedCallMessages({ limit: 20 })
      : { skipped: "disabled" };
    // Item 34 fallback: the website-form queue normally runs every minute (/api/cron/alldog-form-wa).
    const { isFormWaEnabled } = await import("@/lib/alldog/form-lead-rules");
    const formLeadWa = isFormWaEnabled()
      ? await (await import("@/lib/alldog/form-lead-wa")).processDueFormLeadMessages({ limit: 20 })
      : { skipped: "disabled" };
    return NextResponse.json({ ok: true, ...calls, botSummaries: bot, missedCallWa, formLeadWa, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error("CRON alldog-call-retry error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
