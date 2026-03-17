export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyCronAuth } from "@/lib/cron-auth";
import { sendTrialReminderEmail } from "@/lib/email";

const TIER_LABEL: Record<string, string> = {
  basic:       "בייסיק",
  pro:         "פרו",
  groomer:     "גרומר+",
  service_dog: "Service Dog",
};

/**
 * GET /api/cron/trial-reminders
 *
 * Runs daily at 07:00. Sends reminder emails to businesses whose free trial
 * ends in exactly 3 days (D-3) or exactly 1 day (D-1).
 *
 * "Exactly N days" = trialEndsAt falls within today+N calendar day (00:00–23:59).
 * This window ensures each business gets at most one reminder per interval.
 *
 * No auto-charge in Phase 1 — reminders only. Users who don't upgrade simply
 * revert to the free tier when effectiveTier is recomputed via auth.ts.
 */
export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();

    // Build date windows for D-3 and D-1
    function dayWindow(daysFromNow: number): { gte: Date; lte: Date } {
      const start = new Date(now);
      start.setDate(now.getDate() + daysFromNow);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);
      return { gte: start, lte: end };
    }

    // Fetch businesses in each reminder window
    const [d3Businesses, d1Businesses] = await Promise.all([
      prisma.business.findMany({
        where: { trialEndsAt: dayWindow(3), status: "active" },
        select: { id: true, name: true, email: true, tier: true, trialEndsAt: true },
      }),
      prisma.business.findMany({
        where: { trialEndsAt: dayWindow(1), status: "active" },
        select: { id: true, name: true, email: true, tier: true, trialEndsAt: true },
      }),
    ]);

    // Fetch owner emails (business.email may be the contact email, or we need the user's email)
    async function getOwnerEmail(businessId: string, fallbackEmail: string | null): Promise<string | null> {
      if (fallbackEmail) return fallbackEmail;
      const membership = await prisma.businessUser.findFirst({
        where: { businessId, role: "owner" },
        include: { user: { select: { email: true } } },
      });
      return membership?.user?.email ?? null;
    }

    let emailsSent = 0;
    let errors = 0;

    async function sendReminder(
      businesses: typeof d3Businesses,
      daysLeft: number
    ) {
      for (const biz of businesses) {
        try {
          const email = await getOwnerEmail(biz.id, biz.email);
          if (!email) continue;

          const tierName = TIER_LABEL[biz.tier] ?? biz.tier;

          await sendTrialReminderEmail({
            to: email,
            name: biz.name,
            tierName,
            daysLeft,
            trialEndsAt: biz.trialEndsAt!,
          });

          // Log the reminder event
          await prisma.subscriptionEvent.create({
            data: {
              businessId: biz.id,
              eventType: `trial_reminder_d${daysLeft}`,
              tier: biz.tier,
              metadata: { email, daysLeft, sentAt: now.toISOString() },
            },
          });

          emailsSent++;
        } catch (err) {
          console.error(`trial-reminders: failed for business ${biz.id}:`, err);
          errors++;
        }
      }
    }

    await sendReminder(d3Businesses, 3);
    await sendReminder(d1Businesses, 1);

    console.log(`trial-reminders: sent ${emailsSent} emails (${errors} errors). D-3: ${d3Businesses.length}, D-1: ${d1Businesses.length}`);

    return NextResponse.json({
      ok: true,
      emailsSent,
      errors,
      d3Count: d3Businesses.length,
      d1Count: d1Businesses.length,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error("trial-reminders cron error:", error);
    return NextResponse.json({ error: "שגיאה בביצוע הcron" }, { status: 500 });
  }
}
