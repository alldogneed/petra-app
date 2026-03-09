export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyCronAuth } from "@/lib/cron-auth";
import { interpolateTemplate } from "@/lib/whatsapp";

/**
 * GET /api/cron/birthday-reminders
 * Schedules WhatsApp birthday messages for pets with birthdays in the next 3 days.
 * Idempotent — skips if a PENDING reminder already exists for the same pet birthday year.
 * Called daily via Vercel Cron.
 */
export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    // Pre-fetch all active birthday rules for all businesses
    const birthdayRules = await prisma.automationRule.findMany({
      where: { trigger: "birthday_reminder", isActive: true },
      include: {
        template: { select: { body: true } },
        business: { select: { phone: true } },
      },
    });
    const ruleByBusiness = new Map(birthdayRules.map(r => [r.businessId, r]));

    // Fetch all pets with birthDate across all businesses
    const pets = await prisma.pet.findMany({
      where: { birthDate: { not: null } },
      select: {
        id: true,
        name: true,
        birthDate: true,
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            businessId: true,
          },
        },
      },
    });

    let scheduled = 0;
    let skipped = 0;

    for (const pet of pets) {
      if (!pet.birthDate) continue;

      const bday = new Date(pet.birthDate);
      // Set birthday to this year
      const thisYearBday = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());

      // If this year's birthday already passed, check next year
      if (thisYearBday < today) {
        thisYearBday.setFullYear(today.getFullYear() + 1);
      }

      const rule = ruleByBusiness.get(pet.customer?.businessId ?? "");
      // triggerOffset for birthday rules = days before the birthday to send (0 = on the birthday)
      const triggerOffset = rule?.triggerOffset ?? 0;

      // Compute sendAt: birthday minus offset days, at 07:00 UTC (= 09:00 Israel)
      const sendAt = new Date(thisYearBday);
      sendAt.setDate(sendAt.getDate() - triggerOffset);
      sendAt.setHours(7, 0, 0, 0);

      // Rolling 3-day window based on when the message should be sent
      const daysUntilSend = Math.round(
        (sendAt.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)
      );
      if (daysUntilSend > 3 || daysUntilSend < -1) continue;

      const age = thisYearBday.getFullYear() - bday.getFullYear();
      const relatedEntityId = `birthday-${pet.id}-${thisYearBday.getFullYear()}`;

      // Idempotency check — skip if already scheduled this year
      const existing = await prisma.scheduledMessage.findFirst({
        where: {
          relatedEntityType: "PET_BIRTHDAY",
          relatedEntityId,
          status: { in: ["PENDING", "SENT"] },
        },
      });

      if (existing) {
        skipped++;
        continue;
      }

      // Build message body: rule template → interpolate, or hardcoded fallback
      const ageText = age === 1 ? "שנה" : `${age} שנים`;
      let body: string;
      if (rule?.template?.body) {
        body = interpolateTemplate(rule.template.body, {
          customerName: pet.customer?.name ?? "",
          petName: pet.name,
          petAge: ageText,
          businessPhone: rule.business?.phone ?? "",
        });
      } else {
        body = `יום הולדת שמח ל-${pet.name}! 🎂🐾 ${pet.name} מלא/ה ${ageText} היום. מאחלים בריאות, שמחה והרבה עצמות! – הצוות שלנו 💛`;
      }

      await prisma.scheduledMessage.create({
        data: {
          businessId: pet.customer?.businessId ?? "",
          customerId: pet.customer?.id ?? "",
          channel: "whatsapp",
          templateKey: rule ? `automation-rule-${rule.id}` : "pet_birthday",
          payloadJson: JSON.stringify({ body, petName: pet.name, age }),
          sendAt,
          status: "PENDING",
          relatedEntityType: "PET_BIRTHDAY",
          relatedEntityId,
        },
      });

      scheduled++;
    }

    return NextResponse.json({
      ok: true,
      petsChecked: pets.length,
      scheduled,
      skipped,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error("CRON birthday-reminders error:", error);
    return NextResponse.json({ error: "Failed to process birthday reminders" }, { status: 500 });
  }
}
