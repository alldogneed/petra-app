export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyCronAuth, verifyCronAuthWithVault } from "@/lib/cron-auth";
import { syncPendingLeadsToGoogleContacts } from "@/lib/google-contacts";

/**
 * GET /api/cron/google-contacts-sync
 *
 * Safety net for rule #42: every business with Google Contacts sync on gets its next chunk
 * (≤ 50) of leads from the LAST 30 DAYS without a Google contact created — the same function as the owner's
 * "סנכרן לידים קיימים" button. Catches leads whose per-lead sync failed or was never hooked
 * (bot / PayCall leads before 16/11/2026). Hourly from Supabase pg_cron
 * (prisma/cron_google_contacts_sync.sql). Auth: CRON_SECRET or the pg_cron Vault secret.
 */
export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request) && !(await verifyCronAuthWithVault(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const businesses = await prisma.business.findMany({
      where: { googleContactsSync: true },
      select: { id: true },
      take: 200,
    });
    // Recent leads only: the history backfill stays the owner's choice (the button).
    const createdAfter = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const started = Date.now();
    const results: Array<{ businessId: string } & Record<string, unknown>> = [];
    for (const b of businesses) {
      if (Date.now() - started > 45_000) break;
      const r = await syncPendingLeadsToGoogleContacts(b.id, { createdAfter }).catch((err) => ({
        ok: false as const,
        reason: err instanceof Error ? err.message : String(err),
      }));
      results.push({ businessId: b.id, ...r });
    }
    return NextResponse.json({ ok: true, businesses: businesses.length, results, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error("CRON google-contacts-sync error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
