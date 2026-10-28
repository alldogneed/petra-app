export const dynamic = "force-dynamic";
/**
 * GET/POST /api/owner/alldog-test-alert?kind=bot_reply|wa_send|transcription|webhook|call_summary|all
 *
 * Manual check of the AllDog failure alerts (item 31): simulates a failure of the given kind and
 * sends Or a test alert ("🧪 בדיקה: …") through the real path (alertAllDogFailure →
 * notifyOwnerAllDog → WhatsApp template + email). Nothing is sent to customers. Platform admins
 * only (open the URL in a logged-in browser). At most one test per kind per minute.
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePlatformPermission, isGuardError } from "@/lib/auth-guards";
import { PLATFORM_PERMS } from "@/lib/permissions";
import { alertAllDogFailure, FAILURE_KIND_TITLES, type AllDogFailureKind } from "@/lib/alldog/failure-alerts";

/** A realistic error per kind, so the alert shows the Hebrew reason Or would really get. */
const SAMPLE_ERRORS: Record<AllDogFailureKind, string> = {
  bot_reply: '400 {"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API."}}',
  wa_send: "401 190 Error validating access token: Session has expired",
  transcription: "ElevenLabs STT failed: HTTP 401 quota_exceeded",
  webhook: "חתימה לא תקינה (X-Hub-Signature-256) — ההודעה נדחתה (401)",
  call_summary: "גם הניסיון האחרון (שעתיים) לא הפיק סיכום",
  bot_summary: '400 {"type":"error","error":{"type":"invalid_request_error","message":"Schema is too complex for compilation."}}',
};
const KINDS = Object.keys(FAILURE_KIND_TITLES) as AllDogFailureKind[];

async function handle(request: NextRequest) {
  const guard = await requirePlatformPermission(request, PLATFORM_PERMS.SETTINGS_WRITE);
  if (isGuardError(guard)) return guard;

  const kindParam = request.nextUrl.searchParams.get("kind") ?? "bot_reply";
  const kinds = kindParam === "all" ? KINDS : KINDS.filter((k) => k === kindParam);
  if (!kinds.length) {
    return NextResponse.json({ error: `kind must be one of: ${KINDS.join(", ")}, all` }, { status: 400 });
  }
  const results: Record<string, "sent" | "throttled"> = {};
  for (const kind of kinds) {
    const sent = await alertAllDogFailure({
      kind,
      error: SAMPLE_ERRORS[kind],
      detail: "התראת ניסיון — לא הייתה תקלה אמיתית",
      phone: "0500000000",
      test: true,
    });
    results[kind] = sent ? "sent" : "throttled";
  }
  return NextResponse.json({ ok: true, results });
}

export const GET = handle;
export const POST = handle;
