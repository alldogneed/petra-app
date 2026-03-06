export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/prisma";

/**
 * GET /api/cron/birthday-reminders
 * Schedules WhatsApp birthday messages for pets with birthdays in the next 3 days.
 * Idempotent — skips if a PENDING reminder already exists for the same pet birthday year.
 * Called daily via Vercel Cron.
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
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

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

      const daysUntil = Math.round(
        (thisYearBday.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)
      );

      // Only schedule if birthday is in the next 3 days
      if (daysUntil > 3) continue;

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

      // Send at 09:00 on the birthday day (local Israel time, UTC+2)
      const sendAt = new Date(thisYearBday);
      sendAt.setHours(7, 0, 0, 0); // 07:00 UTC = 09:00 Israel

      // Build Hebrew birthday message
      const ageText = age === 1 ? "שנה" : `${age} שנים`;
      const body = `יום הולדת שמח ל-${pet.name}! 🎂🐾 ${pet.name} מלא/ה ${ageText} היום. מאחלים בריאות, שמחה והרבה עצמות! – הצוות שלנו 💛`;

      await prisma.scheduledMessage.create({
        data: {
          businessId: pet.customer?.businessId ?? "",
          customerId: pet.customer?.id ?? "",
          channel: "whatsapp",
          templateKey: "pet_birthday",
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
