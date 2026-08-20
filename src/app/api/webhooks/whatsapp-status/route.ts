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
 * Public route: /api/webhooks/ prefix is exempt from auth in middleware;
 * authenticity is enforced via the verify token on GET and by accepting only
 * wamids we actually sent (log rows are created at send time).
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

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

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ received: true });
  }

  try {
    const entries = (body as { entry?: Array<{ changes?: Array<{ value?: { statuses?: MetaStatus[] } }> }> })?.entry ?? [];
    const statuses: MetaStatus[] = entries.flatMap(
      (e) => e.changes?.flatMap((c) => c.value?.statuses ?? []) ?? []
    );

    for (const s of statuses) {
      if (!s.id || !s.status) continue;
      const newRank = STATUS_RANK[s.status] ?? -1;
      if (newRank < 0) continue;

      const existing = await prisma.whatsAppMessageLog.findUnique({ where: { wamid: s.id } });
      if (!existing) continue; // not a message we logged (or pre-rollout)
      if ((STATUS_RANK[existing.status] ?? 0) >= newRank && s.status !== "failed") continue;

      const err = s.errors?.[0];
      await prisma.whatsAppMessageLog.update({
        where: { wamid: s.id },
        data: {
          status: s.status,
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
