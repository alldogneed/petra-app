/**
 * AllDog WhatsApp bot webhook — the AllDog number's own Meta app ("Alldog-center").
 * Separate from /api/webhooks/whatsapp-status (Petra's platform app); nothing here
 * touches WhatsAppConnection or the platform number.
 *
 * GET  — Meta verification handshake: hub.verify_token must equal ALLDOG_WA_VERIFY_TOKEN.
 * POST — X-Hub-Signature-256 must match ALLDOG_WA_APP_SECRET (fail closed when unset);
 *        only messages to ALLDOG_WA_PHONE_NUMBER_ID are handled, and only while
 *        ALLDOG_WA_BOT_ENABLED is on. Messages are stored, Meta gets 200 at once,
 *        the bot answers after the response (src/lib/alldog-bot/inbound.ts).
 *
 * Public route: the /api/webhooks/ prefix is exempt from session auth in middleware.
 */
import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { runAfterResponse } from "@/lib/wait-until";
import { isWaBotEnabled } from "@/lib/alldog/config";
import { readEnv } from "@/lib/read-env";

export const dynamic = "force-dynamic";
// 6s quiet period + model + up to two messages with a typing pause.
export const maxDuration = 60;

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const expected = readEnv("ALLDOG_WA_VERIFY_TOKEN");
  const token = sp.get("hub.verify_token") ?? "";
  const challenge = sp.get("hub.challenge");
  if (sp.get("hub.mode") === "subscribe" && expected && challenge && safeEqual(token, expected)) {
    return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

/** Meta signs the RAW body with the app secret: X-Hub-Signature-256: sha256=<hex>. */
function verifyAllDogSignature(rawBody: string, header: string | null): boolean {
  const secret = readEnv("ALLDOG_WA_APP_SECRET");
  if (!secret || !header || !header.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const provided = header.slice("sha256=".length).trim().toLowerCase();
  return /^[0-9a-f]{64}$/.test(provided) && safeEqual(provided, expected);
}

export async function POST(request: NextRequest) {
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ received: true });
  }
  if (!readEnv("ALLDOG_WA_APP_SECRET")) {
    console.error("[alldog-whatsapp] ALLDOG_WA_APP_SECRET not configured");
    return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  }
  if (!verifyAllDogSignature(rawBody, request.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const phoneNumberId = readEnv("ALLDOG_WA_PHONE_NUMBER_ID");
  if (!isWaBotEnabled() || !phoneNumberId) return NextResponse.json({ received: true, ignored: "disabled" });

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ received: true });
  }

  try {
    const { ingestWebhookPayload, processInbound } = await import("@/lib/alldog-bot/inbound");
    const pending = await ingestWebhookPayload(body, phoneNumberId);
    for (const item of pending) await runAfterResponse(processInbound(item));
  } catch (err) {
    console.error("[alldog-whatsapp] processing error:", err instanceof Error ? err.message : err);
  }
  // Always 200 once authenticated — Meta retries aggressively on errors.
  return NextResponse.json({ received: true });
}
