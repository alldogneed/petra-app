export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyCronAuth } from "@/lib/cron-auth";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { sendEmail, brandHeader, brandFooter } from "@/lib/email";
import { toWhatsAppPhone } from "@/lib/utils";

const MIN_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MIN_MS;
/** Zoom link goes out when a class starts within the next 75 minutes */
const ZOOM_WINDOW_MS = 75 * MIN_MS;
/** Membership expiry reminder goes out 3 days before validUntil */
const EXPIRY_WINDOW_MS = 3 * DAY_MS;

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function heTime(d: Date): string {
  return d.toLocaleTimeString("he-IL", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function heDate(d: Date): string {
  return d.toLocaleDateString("he-IL", {
    timeZone: "Asia/Jerusalem",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** WhatsApp first; email as fallback when the WhatsApp send fails. Fire-and-forget. */
function notifyWithEmailFallback(params: {
  phone: string | null;
  email: string;
  body: string;
  emailSubject: string;
  emailHtml: string;
  businessId: string;
  context: string;
}): void {
  const sendFallbackEmail = () => {
    sendEmail({ to: params.email, subject: params.emailSubject, html: params.emailHtml })
      .catch(() => {});
  };
  // Email-only students (enrolled by email, no phone on file) go straight to email.
  if (!params.phone) {
    sendFallbackEmail();
    return;
  }
  sendWhatsAppMessage({
    to: toWhatsAppPhone(params.phone),
    body: params.body,
    businessId: params.businessId,
    context: params.context,
  })
    .then((r) => {
      if (!r.success) sendFallbackEmail();
    })
    .catch(() => sendFallbackEmail());
}

function wrapEmail(innerHtml: string): string {
  return `
    <div dir="rtl" style="font-family:'Heebo',Arial,sans-serif;max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;">
      ${brandHeader()}
      <div style="padding:32px 24px;">
        ${innerHtml}
      </div>
      ${brandFooter()}
    </div>`;
}

/**
 * GET/POST /api/cron/online-class-reminders — runs every 15 minutes.
 * Job 1: send the Zoom link to registered participants ~1h before class start.
 * Job 2: remind active members 3 days before their membership expires.
 * Both use an atomic updateMany claim (sentAt marker) for idempotency —
 * no interactive transactions (PgBouncer).
 */
async function handle(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    let zoomLinksSent = 0;
    let zoomRecipients = 0;
    let expiryRemindersSent = 0;

    // ── Job 1: Zoom link — classes starting within the next 75 minutes ────────
    const upcomingClasses = await prisma.onlineClass.findMany({
      where: {
        startsAt: { gt: now, lte: new Date(now.getTime() + ZOOM_WINDOW_MS) },
        zoomLink: { not: null },
        zoomLinkSentAt: null,
      },
      select: {
        id: true,
        title: true,
        startsAt: true,
        zoomLink: true,
        businessId: true,
        business: { select: { name: true } },
        registrations: {
          where: { status: "registered" },
          select: {
            membership: {
              select: {
                portalUser: { select: { name: true, phone: true, email: true } },
              },
            },
          },
        },
      },
      take: 200,
    });

    for (const cls of upcomingClasses) {
      // Atomic idempotency claim — only one cron run sends for this class
      const claimed = await prisma.onlineClass.updateMany({
        where: { id: cls.id, zoomLinkSentAt: null },
        data: { zoomLinkSentAt: new Date() },
      });
      if (claimed.count !== 1) continue;
      zoomLinksSent++;

      const businessName = cls.business.name;
      const time = heTime(cls.startsAt);
      const body =
        `שלום! תזכורת מ-${businessName}:\n` +
        `השיעור "${cls.title}" מתחיל היום בשעה ${time}.\n` +
        `קישור זום להצטרפות:\n${cls.zoomLink}\n` +
        `נתראה בשיעור! 🐾`;
      const emailHtml = wrapEmail(`
        <h2 style="margin:0 0 8px;font-size:20px;color:#0f172a;">השיעור שלכם מתחיל בקרוב</h2>
        <p style="margin:0 0 16px;font-size:14px;color:#475569;">
          השיעור <strong>${escapeHtml(cls.title)}</strong> של ${escapeHtml(businessName)} מתחיל היום בשעה <strong>${time}</strong>.
        </p>
        <p style="text-align:center;margin:24px 0;">
          <a href="${escapeHtml(cls.zoomLink as string)}" style="background:#f97316;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block;">הצטרפות לשיעור בזום</a>
        </p>`);

      for (const reg of cls.registrations) {
        const u = reg.membership.portalUser;
        zoomRecipients++;
        notifyWithEmailFallback({
          phone: u.phone,
          email: u.email,
          body,
          emailSubject: `קישור זום — ${cls.title}`,
          emailHtml,
          businessId: cls.businessId,
          context: "online_class_zoom_link",
        });
      }
    }

    // ── Job 2: Membership expiry — validUntil within the next 3 days ──────────
    const expiringMemberships = await prisma.membership.findMany({
      where: {
        status: "active",
        validUntil: { gt: now, lte: new Date(now.getTime() + EXPIRY_WINDOW_MS) },
        expiryReminderSentAt: null,
      },
      select: {
        id: true,
        businessId: true,
        validUntil: true,
        portalUser: { select: { name: true, phone: true, email: true } },
        business: {
          select: {
            name: true,
            slug: true,
            brandingSettings: { select: { paymentLinkUrl: true } },
          },
        },
      },
      take: 500,
    });

    for (const m of expiringMemberships) {
      // Atomic idempotency claim — one reminder per membership
      const claimed = await prisma.membership.updateMany({
        where: { id: m.id, expiryReminderSentAt: null },
        data: { expiryReminderSentAt: new Date() },
      });
      if (claimed.count !== 1) continue;
      expiryRemindersSent++;

      const validUntil = m.validUntil as Date;
      const daysLeft = Math.max(1, Math.ceil((validUntil.getTime() - now.getTime()) / DAY_MS));
      const businessName = m.business.name;
      const paymentLinkUrl = m.business.brandingSettings?.paymentLinkUrl ?? null;

      let body =
        `שלום ${m.portalUser.name},\n` +
        `המנוי שלך אצל ${businessName} יפוג בעוד ${daysLeft === 1 ? "יום אחד" : `${daysLeft} ימים`} (${heDate(validUntil)}).\n` +
        `כדי להמשיך ליהנות מהשיעורים והקורסים — מומלץ לחדש בהקדם.`;
      if (paymentLinkUrl) {
        body += `\nקישור לתשלום:\n${paymentLinkUrl}`;
      }

      const emailHtml = wrapEmail(`
        <h2 style="margin:0 0 8px;font-size:20px;color:#0f172a;">המנוי שלכם עומד לפוג</h2>
        <p style="margin:0 0 16px;font-size:14px;color:#475569;">
          שלום ${escapeHtml(m.portalUser.name)}, המנוי שלכם אצל <strong>${escapeHtml(businessName)}</strong>
          יפוג בעוד ${daysLeft === 1 ? "יום אחד" : `${daysLeft} ימים`} (${heDate(validUntil)}).
          כדי להמשיך ליהנות מהשיעורים והקורסים — מומלץ לחדש בהקדם.
        </p>
        ${paymentLinkUrl ? `
        <p style="text-align:center;margin:24px 0;">
          <a href="${escapeHtml(paymentLinkUrl)}" style="background:#f97316;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block;">לחידוש המנוי</a>
        </p>` : ""}`);

      notifyWithEmailFallback({
        phone: m.portalUser.phone,
        email: m.portalUser.email,
        body,
        emailSubject: `המנוי שלך אצל ${businessName} עומד לפוג`,
        emailHtml,
        businessId: m.businessId,
        context: "membership_expiry",
      });
    }

    return NextResponse.json({
      ok: true,
      zoomLinksSent,
      zoomRecipients,
      expiryRemindersSent,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error("CRON online-class-reminders error:", error);
    return NextResponse.json(
      { error: "Failed to process online class reminders" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
