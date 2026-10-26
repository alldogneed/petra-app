export const dynamic = "force-dynamic";
// Up to 4 recordings per run: download + ElevenLabs Scribe each.
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth, verifyCronAuthWithVault } from "@/lib/cron-auth";
import { allDogBusinessId } from "@/lib/alldog/config";
import { runBackfillBatch, seedBackfill } from "@/lib/alldog/transcript-backfill";

/**
 * GET /api/cron/alldog-transcribe-backfill[?seed=1]
 *
 * AllDog item 36 — one-time transcription of past PayCall recordings (29/7–24/10/2026) into
 * AllDogCallTranscriptBackfill, for sales analysis. No leads / CallLog / tasks / messages /
 * alerts. `?seed=1` fills the table with the answered calls of the window (pending) and stops.
 * Returns counts only. Remove this route (separate PR) once `left` is 0; the table stays.
 * Auth: CRON_SECRET / CRON_SECRET_DB or the pg_cron Vault secret.
 */
export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request) && !(await verifyCronAuthWithVault(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!allDogBusinessId()) return NextResponse.json({ ok: true, skipped: "disabled" });
  try {
    if (request.nextUrl.searchParams.get("seed") === "1") return NextResponse.json({ ok: true, ...(await seedBackfill()) });
    return NextResponse.json({ ok: true, ...(await runBackfillBatch()) });
  } catch (err) {
    console.error("CRON alldog-transcribe-backfill error:", err instanceof Error ? err.name : "error");
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
