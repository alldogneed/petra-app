export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * GET /api/cron/vaccination-reminders
 * Schedules WhatsApp reminders for pets with vaccinations expiring in ~30 days.
 * Also sends a second reminder when the vaccination is 7 days away.
 * Idempotent — uses relatedEntityId for deduplication.
 * Called daily via Vercel Cron.
 */
export async function GET(request: NextRequest) {
  const secret = request.headers.get("x-cron-secret");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || !secret || secret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Check for vaccinations expiring in 30 days and 7 days
    const WINDOWS = [
      { daysAhead: 30, suffix: "30d" },
      { daysAhead: 7, suffix: "7d" },
    ];

    let scheduled = 0;
    let skipped = 0;

    for (const { daysAhead, suffix } of WINDOWS) {
      // Target window: expiry is on exactly `daysAhead` days from today (±1 day tolerance)
      const windowStart = new Date(today.getTime() + (daysAhead - 1) * 24 * 60 * 60 * 1000);
      const windowEnd = new Date(today.getTime() + (daysAhead + 1) * 24 * 60 * 60 * 1000);

      // ─── Rabies vaccinations ─────────────────────────────────────────────────
      const rabiesHealths = await prisma.dogHealth.findMany({
        where: {
          rabiesUnknown: false,
          rabiesValidUntil: { gte: windowStart, lte: windowEnd },
          pet: { customer: { businessId: { not: undefined } } },
        },
        select: {
          id: true,
          rabiesValidUntil: true,
          pet: {
            select: {
              id: true,
              name: true,
              customer: { select: { id: true, name: true, phone: true, businessId: true } },
            },
          },
        },
      });

      for (const h of rabiesHealths) {
        if (!h.rabiesValidUntil) continue;
        const expiry = new Date(h.rabiesValidUntil);
        const expiryKey = `${expiry.getFullYear()}-${String(expiry.getMonth() + 1).padStart(2, "0")}`;
        const relatedEntityId = `vacc-rabies-${h.pet.id}-${expiryKey}-${suffix}`;

        const existing = await prisma.scheduledMessage.findFirst({
          where: {
            relatedEntityType: "VACCINATION",
            relatedEntityId,
            status: { in: ["PENDING", "SENT"] },
          },
        });

        if (existing) { skipped++; continue; }

        const formattedExpiry = expiry.toLocaleDateString("he-IL", {
          day: "numeric", month: "long", year: "numeric",
        });

        const urgency = daysAhead <= 7 ? "בעוד שבוע" : "בעוד 30 יום";
        const body = `שלום ${h.pet.customer.name}, תזכורת: חיסון הכלבת של ${h.pet.name} פג תוקף ${urgency} (${formattedExpiry}). אנחנו ממליצים לחדש את החיסון בהקדם. 🐾💉`;

        // Send at 09:00 Israel time (07:00 UTC)
        const sendAt = new Date(today);
        sendAt.setHours(7, 0, 0, 0);

        await prisma.scheduledMessage.create({
          data: {
            businessId: h.pet.customer.businessId,
            customerId: h.pet.customer.id,
            channel: "whatsapp",
            templateKey: "vaccination_reminder",
            payloadJson: JSON.stringify({ body, petName: h.pet.name, vaccineType: "rabies", daysUntil: daysAhead }),
            sendAt,
            status: "PENDING",
            relatedEntityType: "VACCINATION",
            relatedEntityId,
          },
        });

        scheduled++;
      }

      // ─── DHPP vaccinations (estimated 1-year validity from dhppLastDate) ─────
      const dhppCutoffFrom = new Date(windowStart.getTime() - 365 * 24 * 60 * 60 * 1000);
      const dhppCutoffTo = new Date(windowEnd.getTime() - 365 * 24 * 60 * 60 * 1000);

      const dhppHealths = await prisma.dogHealth.findMany({
        where: {
          dhppLastDate: { gte: dhppCutoffFrom, lte: dhppCutoffTo },
          pet: { customer: { businessId: { not: undefined } } },
        },
        select: {
          id: true,
          dhppLastDate: true,
          pet: {
            select: {
              id: true,
              name: true,
              customer: { select: { id: true, name: true, phone: true, businessId: true } },
            },
          },
        },
      });

      for (const h of dhppHealths) {
        if (!h.dhppLastDate) continue;
        const expiry = new Date(new Date(h.dhppLastDate).getTime() + 365 * 24 * 60 * 60 * 1000);
        const expiryKey = `${expiry.getFullYear()}-${String(expiry.getMonth() + 1).padStart(2, "0")}`;
        const relatedEntityId = `vacc-dhpp-${h.pet.id}-${expiryKey}-${suffix}`;

        const existing = await prisma.scheduledMessage.findFirst({
          where: {
            relatedEntityType: "VACCINATION",
            relatedEntityId,
            status: { in: ["PENDING", "SENT"] },
          },
        });

        if (existing) { skipped++; continue; }

        const formattedExpiry = expiry.toLocaleDateString("he-IL", {
          day: "numeric", month: "long", year: "numeric",
        });

        const urgency = daysAhead <= 7 ? "בעוד שבוע" : "בעוד 30 יום";
        const body = `שלום ${h.pet.customer.name}, תזכורת: חיסון ה-DHPP של ${h.pet.name} פג תוקף ${urgency} (${formattedExpiry}). אנחנו ממליצים לחדש את החיסון בהקדם. 🐾💉`;

        const sendAt = new Date(today);
        sendAt.setHours(7, 0, 0, 0);

        await prisma.scheduledMessage.create({
          data: {
            businessId: h.pet.customer.businessId,
            customerId: h.pet.customer.id,
            channel: "whatsapp",
            templateKey: "vaccination_reminder",
            payloadJson: JSON.stringify({ body, petName: h.pet.name, vaccineType: "dhpp", daysUntil: daysAhead }),
            sendAt,
            status: "PENDING",
            relatedEntityType: "VACCINATION",
            relatedEntityId,
          },
        });

        scheduled++;
      }
    }

    return NextResponse.json({
      ok: true,
      scheduled,
      skipped,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error("CRON vaccination-reminders error:", error);
    return NextResponse.json({ error: "Failed to process vaccination reminders" }, { status: 500 });
  }
}
