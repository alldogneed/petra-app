/**
 * Meta WhatsApp statuses webhook — the delivery "eyes" of the system.
 *
 * GET  — Meta's one-time verification handshake (hub.challenge echo).
 * POST — message status updates (sent / delivered / read / failed) keyed by
 *        wamid; updates WhatsAppMessageLog so silent drops become visible.
 *        A `failed` status triggers a throttled email alert to the platform
 *        owner — this is how we catch Meta-side drops (frequency capping,
 *        template pauses) that return "accepted" at send time.
 *
 * Statuses arrive for EVERY WABA subscribed to our Meta app — the platform WABA
 * and each business WABA connected via Embedded Signup. `value.metadata.phone_number_id`
 * tells which number sent the message; rows missing `businessId` are back-filled
 * from the WhatsAppConnection table (findBusinessIdByPhoneNumberId).
 *
 * Public route: /api/webhooks/ prefix is exempt from auth in middleware;
 * authenticity is enforced via the verify token on GET, by the optional
 * X-Hub-Signature-256 check on POST (when META_APP_SECRET is set), and by
 * accepting only wamids we actually sent (log rows are created at send time).
 */

import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import prisma from "@/lib/prisma";
import { findBusinessIdByPhoneNumberId } from "@/lib/whatsapp-connections";

export const dynamic = "force-dynamic";

// Later statuses must not be overwritten by out-of-order webhook deliveries.
const STATUS_RANK: Record<string, number> = {
  accepted: 0,
  sent: 1,
  delivered: 2,
  read: 3,
  failed: 4, // terminal — always record a failure
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const expected = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  if (mode === "subscribe" && expected && token === expected && challenge) {
    return new Response(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

interface MetaStatus {
  id?: string; // wamid
  status?: string;
  recipient_id?: string;
  errors?: Array<{ code?: number; title?: string; message?: string; error_data?: { details?: string } }>;
}

interface MetaChangeValue {
  metadata?: { phone_number_id?: string; display_phone_number?: string };
  statuses?: MetaStatus[];
  /** Inbound customer messages (business numbers) — acknowledged, not stored. */
  messages?: unknown[];
}

/**
 * Optional webhook signature check. Meta signs the RAW body with the app secret:
 * X-Hub-Signature-256: sha256=<hex hmac>. Enforced only when META_APP_SECRET is set
 * (keeps current accept-all behavior on deployments without Embedded Signup).
 */
function verifySignature(rawBody: string, header: string | null): boolean {
  const secret = process.env.META_APP_SECRET?.trim();
  if (!secret) return true;
  if (!header || !header.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const provided = header.slice("sha256=".length).trim().toLowerCase();
  if (provided.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(provided, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  // Raw text first — the signature is computed over the exact bytes Meta sent.
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ received: true });
  }

  if (!verifySignature(rawBody, request.headers.get("x-hub-signature-256"))) {
    console.warn("[whatsapp-status] rejected webhook: bad X-Hub-Signature-256");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ received: true });
  }

  try {
    const entries = (body as { entry?: Array<{ changes?: Array<{ value?: MetaChangeValue }> }> })?.entry ?? [];
    // Keep each status paired with the sending number (metadata lives on the change value).
    const items: Array<{ status: MetaStatus; phoneNumberId: string | null }> = [];
    for (const e of entries) {
      for (const c of e.changes ?? []) {
        const phoneNumberId = c.value?.metadata?.phone_number_id ?? null;
        for (const status of c.value?.statuses ?? []) items.push({ status, phoneNumberId });
        // Inbound customer replies (value.messages) on business numbers: out of scope for now —
        // we only acknowledge them (200) so Meta stops retrying. Content is NOT stored.
      }
    }

    // phone_number_id → businessId, resolved once per request per number.
    const businessIdCache = new Map<string, string | null>();
    const businessIdFor = async (phoneNumberId: string | null): Promise<string | null> => {
      if (!phoneNumberId) return null;
      if (!businessIdCache.has(phoneNumberId)) {
        businessIdCache.set(phoneNumberId, await findBusinessIdByPhoneNumberId(phoneNumberId));
      }
      return businessIdCache.get(phoneNumberId) ?? null;
    };

    for (const { status: s, phoneNumberId } of items) {
      if (!s.id || !s.status) continue;
      const newRank = STATUS_RANK[s.status] ?? -1;
      if (newRank < 0) continue;

      const existing = await prisma.whatsAppMessageLog.findUnique({ where: { wamid: s.id } });
      if (!existing) continue; // not a message we logged (or pre-rollout)
      if ((STATUS_RANK[existing.status] ?? 0) >= newRank && s.status !== "failed") continue;

      // Back-fill tenant attribution for rows logged without it (cheap, optional).
      const businessId = existing.businessId ?? (await businessIdFor(phoneNumberId));

      const err = s.errors?.[0];
      await prisma.whatsAppMessageLog.update({
        where: { wamid: s.id },
        data: {
          status: s.status,
          ...(!existing.businessId && businessId ? { businessId } : {}),
          ...(!existing.phoneNumberId && phoneNumberId ? { phoneNumberId } : {}),
          ...(err ? {
            errorCode: err.code != null ? String(err.code) : null,
            errorMessage: [err.title, err.message, err.error_data?.details].filter(Boolean).join(" | ").slice(0, 500) || null,
          } : {}),
        },
      });

      if (s.status === "failed") {
        console.error("[whatsapp-status] delivery FAILED:", s.id, existing.context, err?.code, err?.title);
        alertDeliveryFailure(existing.context, existing.templateName, err).catch(() => {});
      }
    }
  } catch (err) {
    console.error("[whatsapp-status] processing error:", err);
  }

  // Always 200 — Meta retries aggressively on errors
  return NextResponse.json({ received: true });
}

/** Throttled (1h) email to the platform owner when Meta reports a delivery failure. */
async function alertDeliveryFailure(
  context: string | null,
  templateName: string | null,
  err?: { code?: number; title?: string; message?: string; error_data?: { details?: string } }
): Promise<void> {
  try {
    const { claimOnce } = await import("@/lib/rate-limit");
    const fresh = await claimOnce("whatsapp-delivery-failure", 60 * 60);
    if (!fresh) return;

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return;

    const detail = [err?.code, err?.title, err?.message, err?.error_data?.details].filter(Boolean).join(" | ");
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "Petra <noreply@petra-app.com>",
        to: ["alldogneed@gmail.com"],
        subject: "🔴 Petra: הודעת וואטסאפ נכשלה במסירה",
        html: `<div dir="rtl" style="font-family: Arial, sans-serif;">
          <p>Meta דיווח על כשל מסירה של הודעת וואטסאפ.</p>
          <p><b>הקשר:</b> ${context ?? "לא ידוע"}<br/>
          <b>תבנית:</b> ${templateName ?? "טקסט חופשי"}<br/>
          <b>שגיאה:</b> ${detail || "ללא פירוט"}</p>
          <p style="color:#64748b; font-size:13px;">התראה זו נשלחת לכל היותר פעם בשעה. פירוט מלא בטבלת WhatsAppMessageLog.</p>
        </div>`,
      }),
    });
  } catch (e) {
    console.error("[whatsapp-status] failure alert error:", e);
  }
}
