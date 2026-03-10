export const dynamic = "force-dynamic";
/**
 * POST /api/cron/service-dog-meeting-reminders
 * Runs daily (02:00 IL time). Finds all SCHEDULED service-dog meetings
 * happening in the next 24–48 hours and creates ScheduledMessage records.
 * The WhatsApp messages will be sent by the send-reminders cron once
 * Meta Business Verification is approved.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyCronAuth } from "@/lib/cron-auth";
import { scheduleServiceDogMeetingReminder } from "@/lib/reminder-service";
import { toWhatsAppPhone } from "@/lib/utils";

export async function POST(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    // Look for meetings happening in the next 24–48 hours (reminder fires 24h before)
    const windowStart = new Date(now.getTime() + 20 * 60 * 60 * 1000); // 20h from now
    const windowEnd   = new Date(now.getTime() + 50 * 60 * 60 * 1000); // 50h from now

    // Fetch all recipients with meetings
    const recipients = await prisma.serviceDogRecipient.findMany({
      select: {
        id: true,
        businessId: true,
        name: true,
        phone: true,
        meetings: true,
        customer: { select: { phone: true } },
      },
    });

    let scheduled = 0;
    let skipped = 0;

    for (const recipient of recipients) {
      const phone =
        (recipient.phone ? toWhatsAppPhone(recipient.phone) : null) ??
        (recipient.customer?.phone ? toWhatsAppPhone(recipient.customer.phone) : null);

      if (!phone) { skipped++; continue; }

      let meetings: unknown[] = [];
      try {
        meetings = Array.isArray(recipient.meetings) ? recipient.meetings : JSON.parse(String(recipient.meetings) || "[]");
      } catch { continue; }

      for (const m of meetings as Record<string, unknown>[]) {
        if (m.status !== "SCHEDULED") continue;
        if (!m.date) continue;

        const meetingDate = new Date(String(m.date));
        if (isNaN(meetingDate.getTime())) continue;
        if (meetingDate < windowStart || meetingDate > windowEnd) continue;

        const result = await scheduleServiceDogMeetingReminder({
          meetingId: String(m.id ?? ""),
          recipientId: recipient.id,
          businessId: recipient.businessId,
          recipientName: recipient.name,
          recipientPhone: phone,
          meetingDate,
          meetingType: String(m.type ?? "OTHER"),
          trainerName: String(m.trainerName ?? ""),
        });

        if (result) scheduled++;
        else skipped++;
      }
    }

    console.log(`[service-dog-meeting-reminders] scheduled=${scheduled} skipped=${skipped}`);
    return NextResponse.json({ ok: true, scheduled, skipped });
  } catch (error) {
    console.error("service-dog-meeting-reminders cron error:", error);
    return NextResponse.json({ error: "שגיאה" }, { status: 500 });
  }
}
