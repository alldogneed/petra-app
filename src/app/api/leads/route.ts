export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { logCurrentUserActivity } from "@/lib/activity-log";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { hasFeatureWithOverrides } from "@/lib/feature-flags";
import { sendWhatsAppMessage, sendWhatsAppTemplate } from "@/lib/whatsapp";
import { toWhatsAppPhone } from "@/lib/utils";
import { shouldSyncContacts, upsertLeadContact } from "@/lib/google-contacts";
import { prisma } from "@/lib/prisma";
import { listLeads, createLead, ServiceError } from "@/services/clients";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const leads = await listLeads(authResult.businessId, prisma);
    return NextResponse.json(leads);
  } catch (error) {
    console.error("Error fetching leads:", error);
    return NextResponse.json({ error: "Failed to fetch leads" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = rateLimit("api:leads:create", ip, RATE_LIMITS.API_WRITE);
    if (!rl.allowed) {
      return NextResponse.json({ error: "יותר מדי בקשות. נסה שוב מאוחר יותר." }, { status: 429 });
    }

    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json();
    const { name, phone, email, city, address, requestedService, source, stage, notes, customerId } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Missing required field: name" }, { status: 400 });
    }

    let result;
    try {
      result = await createLead(authResult.businessId, prisma, {
        name, phone, email, city, address, requestedService, source, stage, notes, customerId,
      });
    } catch (e) {
      if (e instanceof ServiceError) {
        const status = e.code === "CONFLICT" ? 409 : e.code === "NOT_FOUND" ? 404 : 400;
        return NextResponse.json({ error: e.message, ...(e.details as object | null ?? {}) }, { status });
      }
      throw e;
    }

    const { lead, existingCustomer, duplicateLead, business } = result;
    logCurrentUserActivity("CREATE_LEAD");

    // ── Side effect: WhatsApp notification to business owner (PRO+ only) ──
    const bizOverrides = (business?.featureOverrides as Record<string, unknown> | null) ?? null;
    const canNotify = hasFeatureWithOverrides(
      business?.tier ?? "free",
      "lead_notifications",
      bizOverrides as Record<string, boolean> | null
    );
    // Re-use the business data the service already fetched
    if (business && canNotify) {
      const serviceParam = lead.requestedService || "לא צוין";
      const phoneParam = lead.phone || "לא צוין";
      const cityParam = (lead as { city?: string | null }).city || "לא צוין";
      const SOURCE_LABELS: Record<string, string> = {
        manual: "הוספה ידנית", facebook: "פייסבוק", instagram: "אינסטגרם",
        website: "אתר אינטרנט", google: "גוגל", tiktok: "טיקטוק",
        referral: "המלצה מלקוח", signage: "שלט", other: "אחר",
      };
      const sourceParam = SOURCE_LABELS[lead.source] ?? lead.source ?? "לא צוין";
      const msg = `ליד חדש נכנס לפטרה!\n\nשם: ${lead.name}\nטלפון: ${phoneParam}\nשירות: ${serviceParam}\nאזור: ${cityParam}\nמקור: ${sourceParam}\n\nכנס לניהול הלידים בפטרה לפרטים.`;

      const extraPhones = Array.isArray(bizOverrides?.lead_notification_phones)
        ? (bizOverrides!.lead_notification_phones as string[])
        : [];
      const uniquePhones = [...new Set(
        [...(business.phone ? [business.phone] : []), ...extraPhones]
          .map(toWhatsAppPhone)
          .filter((p): p is string => !!p)
      )];

      await Promise.allSettled(
        uniquePhones.map(async (p) => {
          try {
            const res = await sendWhatsAppTemplate({
              to: p, templateName: "petra_biz_lead_alert",
              bodyParams: [lead.name, phoneParam, serviceParam, cityParam, sourceParam],
            });
            if (!res.success) await sendWhatsAppMessage({ to: p, body: msg });
          } catch {
            await sendWhatsAppMessage({ to: p, body: msg }).catch((err) =>
              console.error("Lead notification WA (fallback) failed:", err)
            );
          }
        })
      );
    }

    // ── Side effect: Google Contacts sync ──
    if (lead.phone || lead.email) {
      shouldSyncContacts(authResult.businessId).then(async (enabled) => {
        if (!enabled) return;
        const resourceName = await upsertLeadContact({
          id: lead.id, name: lead.name, phone: lead.phone ?? null,
          email: lead.email ?? null, notes: lead.notes ?? null,
          requestedService: lead.requestedService ?? null,
          city: (lead as { city?: string | null }).city ?? null,
          googleContactId: null, businessId: lead.businessId,
        });
        if (resourceName) {
          await prisma.lead.update({ where: { id: lead.id }, data: { googleContactId: resourceName } });
        }
      }).catch((err) => console.error("Google Contacts sync (lead create) failed:", err));
    }

    return NextResponse.json({ ...lead, existingCustomer, duplicateLead }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }
    console.error("Error creating lead:", error);
    return NextResponse.json({ error: "Failed to create lead" }, { status: 500 });
  }
}
