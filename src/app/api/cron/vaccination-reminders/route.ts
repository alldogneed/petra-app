export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/prisma";

const DAY_MS = 24 * 60 * 60 * 1000;
function addDays(d: Date, n: number) { return new Date(d.getTime() + n * DAY_MS); }

// Vaccine definitions: type, label, how to get lastDate, how to compute expiry
type VaxDef = {
  type: string;
  label: string;
  getLastDate: (h: HealthRow) => Date | null;
  getExpiry: (h: HealthRow) => Date | null;
};

type HealthRow = {
  id: string;
  rabiesLastDate: Date | null;
  rabiesValidUntil: Date | null;
  rabiesUnknown: boolean;
  dhppLastDate: Date | null;
  dhppPuppy1Date: Date | null;
  dhppPuppy2Date: Date | null;
  dhppPuppy3Date: Date | null;
  parkWormDate: Date | null;
  dewormingLastDate: Date | null;
  fleaTickExpiryDate: Date | null;
  pet: {
    id: string;
    name: string;
    customer: { id: string; name: string; phone: string; businessId: string };
  };
};

const VAX_DEFS: VaxDef[] = [
  {
    type: "rabies",
    label: "כלבת",
    getLastDate: (h) => h.rabiesLastDate,
    getExpiry: (h) => (!h.rabiesUnknown && h.rabiesValidUntil) ? h.rabiesValidUntil : null,
  },
  {
    type: "dhpp",
    label: "משושה בוגר (DHPP)",
    getLastDate: (h) => h.dhppLastDate,
    getExpiry: (h) => h.dhppLastDate ? addDays(h.dhppLastDate, 365) : null,
  },
  {
    type: "dhppPuppy1",
    label: "משושה גורים מנה 1",
    getLastDate: (h) => h.dhppPuppy1Date,
    getExpiry: (h) => h.dhppPuppy1Date ? addDays(h.dhppPuppy1Date, 14) : null,
  },
  {
    type: "dhppPuppy2",
    label: "משושה גורים מנה 2",
    getLastDate: (h) => h.dhppPuppy2Date,
    getExpiry: (h) => h.dhppPuppy2Date ? addDays(h.dhppPuppy2Date, 14) : null,
  },
  {
    type: "dhppPuppy3",
    label: "משושה גורים מנה 3",
    getLastDate: (h) => h.dhppPuppy3Date,
    getExpiry: (h) => h.dhppPuppy3Date ? addDays(h.dhppPuppy3Date, 365) : null,
  },
  {
    type: "parkWorm",
    label: "תולעת הפארק",
    getLastDate: (h) => h.parkWormDate,
    getExpiry: (h) => h.parkWormDate ? addDays(h.parkWormDate, 90) : null,
  },
  {
    type: "deworming",
    label: "תילוע",
    getLastDate: (h) => h.dewormingLastDate,
    getExpiry: (h) => h.dewormingLastDate ? addDays(h.dewormingLastDate, 180) : null,
  },
  {
    type: "fleaTick",
    label: "קרציות ופרעושים",
    getLastDate: (h) => h.fleaTickExpiryDate,
    getExpiry: (h) => h.fleaTickExpiryDate ?? null,
  },
];

/**
 * GET /api/cron/vaccination-reminders
 * Daily cron — sends WhatsApp reminders + creates internal Tasks + SystemMessages
 * for expiring/expired vaccinations.
 */
export async function GET(request: NextRequest) {
  const secret = request.headers.get("x-cron-secret");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || !secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const a = Buffer.from(secret);
  const b = Buffer.from(cronSecret);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // WhatsApp reminders at 30 and 7 days
    const WINDOWS = [
      { daysAhead: 30, suffix: "30d", priority: "HIGH" },
      { daysAhead: 7, suffix: "7d", priority: "URGENT" },
    ];

    let scheduled = 0;
    let skipped = 0;
    let tasksCreated = 0;
    let sysMessagesCreated = 0;

    // Fetch all health records with relevant fields
    const healths = await prisma.dogHealth.findMany({
      where: { pet: { customer: { businessId: { not: undefined } } } },
      select: {
        id: true,
        rabiesLastDate: true, rabiesValidUntil: true, rabiesUnknown: true,
        dhppLastDate: true,
        dhppPuppy1Date: true, dhppPuppy2Date: true, dhppPuppy3Date: true,
        parkWormDate: true,
        dewormingLastDate: true,
        fleaTickExpiryDate: true,
        pet: {
          select: {
            id: true, name: true,
            customer: { select: { id: true, name: true, phone: true, businessId: true } },
          },
        },
      },
    });

    for (const h of healths) {
      const businessId = h.pet.customer.businessId;

      for (const def of VAX_DEFS) {
        const expiry = def.getExpiry(h as HealthRow);
        if (!expiry) continue;

        const lastDate = def.getLastDate(h as HealthRow);
        const daysUntil = Math.round((expiry.getTime() - today.getTime()) / DAY_MS);
        const isExpired = expiry < today;

        const expiryKey = `${expiry.getFullYear()}-${String(expiry.getMonth() + 1).padStart(2, "0")}`;
        const petId = h.pet.id;
        const petName = h.pet.name;
        const customerName = h.pet.customer.name;
        const customerId = h.pet.customer.id;
        const formattedExpiry = expiry.toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" });

        // ── WhatsApp reminder (30d + 7d windows) ─────────────────────────────
        for (const { daysAhead, suffix } of WINDOWS) {
          const windowStart = addDays(today, daysAhead - 1);
          const windowEnd = addDays(today, daysAhead + 1);
          if (expiry < windowStart || expiry > windowEnd) continue;

          const relatedEntityId = `vacc-${def.type}-${petId}-${expiryKey}-${suffix}`;
          const existing = await prisma.scheduledMessage.findFirst({
            where: { relatedEntityType: "VACCINATION", relatedEntityId, status: { in: ["PENDING", "SENT"] } },
          });
          if (existing) { skipped++; continue; }

          const urgency = daysAhead <= 7 ? "בעוד שבוע" : "בעוד 30 יום";
          const body = `שלום ${customerName}, תזכורת: ${def.label} של ${petName} פוקע/ת ${urgency} (${formattedExpiry}). אנחנו ממליצים לחדש בהקדם. 🐾💉`;
          const sendAt = new Date(today); sendAt.setHours(7, 0, 0, 0);

          await prisma.scheduledMessage.create({
            data: {
              businessId, customerId,
              channel: "whatsapp",
              templateKey: "vaccination_reminder",
              payloadJson: JSON.stringify({ body, petName, vaccineType: def.type, daysUntil: daysAhead }),
              sendAt, status: "PENDING",
              relatedEntityType: "VACCINATION",
              relatedEntityId,
            },
          });
          scheduled++;
        }

        // ── Internal Task (30d window, or immediately if expired) ─────────────
        const taskWindow = isExpired || daysUntil <= 30;
        if (taskWindow) {
          const taskEntityId = `task-vacc-${def.type}-${petId}-${expiryKey}`;
          const existingTask = await prisma.task.findFirst({
            where: {
              businessId,
              relatedEntityType: "VACCINATION",
              relatedEntityId: taskEntityId,
              status: "OPEN",
            },
          });
          if (!existingTask) {
            const priority = (isExpired || daysUntil <= 7) ? "URGENT" : "HIGH";
            const title = isExpired
              ? `חיסון ${def.label} פג תוקף — ${petName}`
              : `חיסון ${def.label} עומד לפוג — ${petName}`;
            const description = isExpired
              ? `חיסון ${def.label} של ${petName} (${customerName}) פג תוקפו ב-${formattedExpiry}. יש לתאם חידוש.`
              : `חיסון ${def.label} של ${petName} (${customerName}) יפוג ב-${formattedExpiry} (בעוד ${daysUntil} ימים).`;

            await prisma.task.create({
              data: {
                businessId,
                title,
                description,
                category: "HEALTH",
                priority,
                status: "OPEN",
                dueDate: expiry,
                relatedEntityType: "VACCINATION",
                relatedEntityId: taskEntityId,
              },
            });
            tasksCreated++;
          }
        }

        // ── Bell / SystemMessage (expired or ≤7 days) ─────────────────────────
        if (isExpired || daysUntil <= 7) {
          const sysEntityId = `sys-vacc-${def.type}-${petId}-${expiryKey}`;
          const existingSys = await prisma.systemMessage.findFirst({
            where: { businessId, actionLabel: sysEntityId },
          });
          if (!existingSys) {
            const title = isExpired
              ? `חיסון פג תוקף: ${petName}`
              : `חיסון עומד לפוג: ${petName}`;
            const content = isExpired
              ? `חיסון ${def.label} של ${petName} (${customerName}) פג תוקפו ב-${formattedExpiry}`
              : `חיסון ${def.label} של ${petName} (${customerName}) יפוג ב-${formattedExpiry} (${daysUntil} ימים)`;

            await prisma.systemMessage.create({
              data: {
                businessId,
                title,
                content,
                type: isExpired ? "error" : "warning",
                icon: "syringe",
                actionUrl: `/customers/${customerId}`,
                // Reuse actionLabel field as dedup key (it's not shown in UI for our use)
                actionLabel: sysEntityId,
                expiresAt: addDays(today, 14),
              },
            });
            sysMessagesCreated++;
          }
        }
      }
    }

    return NextResponse.json({ ok: true, scheduled, skipped, tasksCreated, sysMessagesCreated, timestamp: now.toISOString() });
  } catch (error) {
    console.error("CRON vaccination-reminders error:", error);
    return NextResponse.json({ error: "Failed to process vaccination reminders" }, { status: 500 });
  }
}
