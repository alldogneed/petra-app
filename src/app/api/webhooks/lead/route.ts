export const dynamic = 'force-dynamic';
/**
 * POST /api/webhooks/lead
 *
 * Public webhook endpoint for receiving leads from external websites.
 *
 * Auth (in order of priority):
 *   1. Per-business API key: x-api-key = pk_... (stored in Business.webhookApiKey)
 *      → businessId resolved automatically, no need to send it in the body
 *   2. Legacy: x-api-key = MAKE_WEBHOOK_SECRET + businessId in body / WEBHOOK_BUSINESS_ID env
 *
 * Body (at least name/fullName/firstName or phone required):
 *   name        – full name (OR firstName + lastName, OR fullName)
 *   firstName   – first name
 *   lastName    – last name
 *   fullName    – alias for name
 *   phone       – phone number
 *   email       – email address
 *   source      – lead source label. Defaults to "website"
 *   notes       – free-text
 *   petName     – pet name (appended to notes)
 *   petBreed / breed – pet breed (appended to notes)
 *   city        – city (appended to notes)
 *   service     – requested service (appended to notes)
 *   businessId  – only needed for legacy auth
 *   timestamp   – ignored
 */

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import prisma from "@/lib/prisma";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { getFirstLeadStageId } from "@/lib/lead-stages";
import { hasFeatureWithOverrides } from "@/lib/feature-flags";
import { sendWhatsAppMessage, sendWhatsAppTemplate } from "@/lib/whatsapp";
import { toWhatsAppPhone } from "@/lib/utils";

export async function POST(request: NextRequest) {
  // ── Rate limiting ─────────────────────────────────────────────────────────
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = rateLimit("webhook:lead", ip, RATE_LIMITS.WEBHOOK_LEAD);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const apiKey = request.headers.get("x-api-key");
  if (!apiKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

  // ── Auth: try per-business key first ──────────────────────────────────────
  let businessId: string | undefined;
  let businessMeta: { phone: string | null; tier: string; featureOverrides: unknown } | null = null;

  if (apiKey.startsWith("pk_")) {
    const business = await prisma.business.findUnique({
      where: { webhookApiKey: apiKey },
      select: { id: true, webhookApiKeyCreatedAt: true, phone: true, tier: true, featureOverrides: true },
    });
    if (!business) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Check webhook key expiry (90 days)
    if (business.webhookApiKeyCreatedAt) {
      const ageMs = Date.now() - new Date(business.webhookApiKeyCreatedAt).getTime();
      if (ageMs > 90 * 24 * 60 * 60 * 1000) {
        return NextResponse.json({ error: "API key expired — please regenerate" }, { status: 401 });
      }
    }
    businessId = business.id;
    businessMeta = { phone: business.phone, tier: business.tier, featureOverrides: business.featureOverrides };
  } else {
    // Legacy: validate against MAKE_WEBHOOK_SECRET
    const secret = process.env.MAKE_WEBHOOK_SECRET;
    if (!secret) {
      return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
    }
    let authorized = false;
    try {
      const a = Buffer.from(apiKey.padEnd(secret.length, "\0"));
      const b = Buffer.from(secret.padEnd(apiKey.length, "\0"));
      authorized = apiKey.length === secret.length && timingSafeEqual(a, b);
    } catch {
      authorized = false;
    }
    if (!authorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Only use env var — never accept businessId from request body (IDOR risk)
    businessId = process.env.WEBHOOK_BUSINESS_ID || undefined;
    if (!businessId) {
      return NextResponse.json(
        { error: "WEBHOOK_BUSINESS_ID env var is required for legacy auth" },
        { status: 400 }
      );
    }
    businessMeta = await prisma.business.findUnique({
      where: { id: businessId },
      select: { phone: true, tier: true, featureOverrides: true },
    }) ?? null;
  }

  // ── Resolve fields ────────────────────────────────────────────────────────
  const firstName = str(body.firstName);
  const lastName = str(body.lastName);
  const name =
    str(body.name) ||
    str(body.fullName) ||
    [firstName, lastName].filter(Boolean).join(" ");

  const phone = str(body.phone) || undefined;
  const email = str(body.email) || undefined;
  const source = str(body.source) || "website";
  const petName = str(body.petName) || undefined;
  const petBreed = str(body.petBreed) || str(body.breed) || undefined;
  const city = str(body.city) || undefined;
  const service = str(body.service) || undefined;
  const rawNotes = str(body.notes) || undefined;

  if (!name && !phone) {
    return NextResponse.json(
      { error: "At least one of: name, fullName, firstName, phone is required" },
      { status: 400 }
    );
  }

  // Build notes
  const notesParts: string[] = [];
  if (rawNotes) notesParts.push(rawNotes);
  if (city) notesParts.push(`עיר: ${city}`);
  if (service) notesParts.push(`שירות מבוקש: ${service}`);
  if (petName) notesParts.push(`שם כלב: ${petName}`);
  if (petBreed) notesParts.push(`גזע: ${petBreed}`);
  const notes = notesParts.length > 0 ? notesParts.join("\n") : undefined;

  // ── Create lead ───────────────────────────────────────────────────────────
  try {
    const firstStageId = await getFirstLeadStageId(businessId as string);

    const lead = await prisma.lead.create({
      data: {
        businessId,
        name: name || phone || "ליד מהאתר",
        phone: phone || undefined,
        email: email || undefined,
        source,
        stage: firstStageId,
        city: city || undefined,
        requestedService: service || undefined,
        notes: notes || undefined,
      },
      select: { id: true, name: true, stage: true, createdAt: true },
    });

    // Fire-and-forget: WhatsApp notification (same logic as POST /api/leads)
    const bizOverrides = (businessMeta?.featureOverrides as Record<string, unknown> | null) ?? null;
    const canNotify = hasFeatureWithOverrides(businessMeta?.tier ?? "free", "lead_notifications", bizOverrides as Record<string, boolean> | null);
    if (canNotify) {
      const phoneParam = phone || "לא צוין";
      const serviceParam = service || "לא צוין";
      const cityParam = city || "לא צוין";
      const SOURCE_LABELS: Record<string, string> = {
        manual: "הוספה ידנית", facebook: "פייסבוק", instagram: "אינסטגרם",
        website: "אתר אינטרנט", google: "גוגל", tiktok: "טיקטוק",
        referral: "המלצה מלקוח", signage: "שלט", other: "אחר",
      };
      const sourceParam = SOURCE_LABELS[source] ?? source ?? "לא צוין";
      const msg = `ליד חדש נכנס לפטרה!\n\nשם: ${lead.name}\nטלפון: ${phoneParam}\nשירות: ${serviceParam}\nאזור: ${cityParam}\nמקור: ${sourceParam}\n\nכנס לניהול הלידים בפטרה לפרטים.`;

      const extraPhones = Array.isArray(bizOverrides?.lead_notification_phones)
        ? (bizOverrides!.lead_notification_phones as string[])
        : [];
      const allPhones = [
        ...(businessMeta?.phone ? [businessMeta.phone] : []),
        ...extraPhones,
      ].map(toWhatsAppPhone).filter((p): p is string => !!p);
      const uniquePhones = [...new Set(allPhones)];

      for (const p of uniquePhones) {
        sendWhatsAppTemplate({
          to: p,
          templateName: "petra_biz_lead_alert",
          bodyParams: [lead.name, phoneParam, serviceParam, cityParam, sourceParam],
        }).catch(() => {
          sendWhatsAppMessage({ to: p, body: msg }).catch(() => {});
        });
      }
    }

    return NextResponse.json(
      { success: true, leadId: lead.id, name: lead.name, stage: lead.stage },
      { status: 201 }
    );
  } catch (error) {
    console.error("[webhook/lead] DB error:", error);
    return NextResponse.json({ error: "Failed to create lead" }, { status: 500 });
  }
}
