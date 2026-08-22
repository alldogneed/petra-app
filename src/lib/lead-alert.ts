/**
 * Multi-channel lead alert — WhatsApp + email + in-app notification.
 *
 * WhatsApp templates alone proved unreliable for owner alerts: Meta
 * frequency-caps MARKETING-category templates per recipient and drops them
 * with no API error, and it silently re-categorized our UTILITY template
 * back to MARKETING. Email and the in-app bell are fully under our control,
 * so a new lead can never again vanish without a trace.
 */

import prisma from "@/lib/prisma";
import { sendWhatsAppMessage, sendWhatsAppTemplate } from "@/lib/whatsapp";
import { toWhatsAppPhone } from "@/lib/utils";

const SOURCE_LABELS: Record<string, string> = {
  manual: "הוספה ידנית", facebook: "פייסבוק", instagram: "אינסטגרם",
  website: "אתר אינטרנט", google: "גוגל", tiktok: "טיקטוק",
  referral: "המלצה מלקוח", signage: "שלט", whatsapp: "וואטסאפ", other: "אחר",
};

// Newest (transactionally-worded UTILITY) first; older templates as fallback.
const LEAD_TEMPLATES = ["petra_lead_notification", "petra_biz_lead_alert"];

export interface LeadAlertInput {
  businessId: string;
  businessPhone: string | null;
  featureOverrides: Record<string, unknown> | null;
  lead: {
    name: string;
    phone: string | null;
    requestedService: string | null;
    city: string | null;
    source: string | null;
  };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Send the alert on every channel. Never throws — each channel logs its own failures. */
export async function sendLeadAlert(input: LeadAlertInput): Promise<void> {
  const { businessId, businessPhone, featureOverrides, lead } = input;

  const phoneParam = lead.phone || "לא צוין";
  const serviceParam = lead.requestedService || "לא צוין";
  const cityParam = lead.city || "לא צוין";
  const sourceParam = SOURCE_LABELS[lead.source ?? ""] ?? lead.source ?? "לא צוין";
  const bodyParams = [lead.name, phoneParam, serviceParam, cityParam, sourceParam];

  const freeText = `ליד חדש נכנס לפטרה!\n\nשם: ${lead.name}\nטלפון: ${phoneParam}\nשירות: ${serviceParam}\nאזור: ${cityParam}\nמקור: ${sourceParam}\n\nכנס לניהול הלידים בפטרה לפרטים.`;

  // ── Channel 1: WhatsApp (template chain, then free-form) ──────────────────
  const extraPhones = Array.isArray(featureOverrides?.lead_notification_phones)
    ? (featureOverrides!.lead_notification_phones as string[])
    : [];
  const uniquePhones = [...new Set(
    [...(businessPhone ? [businessPhone] : []), ...extraPhones]
      .map(toWhatsAppPhone)
      .filter((p): p is string => !!p)
  )];

  const whatsappSends = uniquePhones.map(async (p) => {
    try {
      for (const templateName of LEAD_TEMPLATES) {
        const res = await sendWhatsAppTemplate({ to: p, templateName, bodyParams, businessId, context: "lead_alert" });
        if (res.success) return;
        console.error(`[lead-alert] template ${templateName} failed for`, p, "-", res.error);
      }
      const freeform = await sendWhatsAppMessage({ to: p, body: freeText, businessId, context: "lead_alert" });
      if (!freeform.success) console.error("[lead-alert] free-form fallback failed for", p, "-", freeform.error);
    } catch (err) {
      console.error("[lead-alert] WhatsApp send threw for", p, err);
    }
  });

  // ── Channels 2+3: email + in-app bell for the business owners ─────────────
  const ownersAndBell = (async () => {
    try {
      const owners = await prisma.businessUser.findMany({
        where: { businessId, role: "owner", isActive: true },
        select: { userId: true, user: { select: { email: true } } },
      });
      if (owners.length === 0) return;

      // In-app notification (bell) — always works, no external dependency
      await prisma.notification.createMany({
        data: owners.map((o) => ({
          userId: o.userId,
          title: "ליד חדש נכנס",
          message: `${lead.name} · ${phoneParam} · ${serviceParam}`,
          actionUrl: "/leads",
        })),
      });

      // Email via Resend
      const apiKey = process.env.RESEND_API_KEY;
      const emails = owners.map((o) => o.user.email).filter(Boolean);
      if (apiKey && emails.length > 0) {
        const safe = {
          name: escapeHtml(lead.name), phone: escapeHtml(phoneParam),
          service: escapeHtml(serviceParam), city: escapeHtml(cityParam),
          source: escapeHtml(sourceParam),
        };
        const html = `
          <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #f8fafc; border-radius: 12px;">
            <div style="background: #1e293b; padding: 20px 24px; border-radius: 8px 8px 0 0; text-align: center;">
              <h2 style="color: #fb923c; margin: 0; font-size: 20px;">🐾 ליד חדש נכנס לפטרה</h2>
            </div>
            <div style="background: #ffffff; padding: 24px; border-radius: 0 0 8px 8px; border: 1px solid #e2e8f0;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 4px; color: #64748b; font-size: 13px; width: 110px;">שם</td><td style="padding: 8px 4px; color: #1e293b; font-weight: 600;">${safe.name}</td></tr>
                <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 4px; color: #64748b; font-size: 13px;">טלפון</td><td style="padding: 8px 4px; color: #1e293b;">${safe.phone}</td></tr>
                <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 4px; color: #64748b; font-size: 13px;">שירות מבוקש</td><td style="padding: 8px 4px; color: #1e293b;">${safe.service}</td></tr>
                <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 4px; color: #64748b; font-size: 13px;">אזור</td><td style="padding: 8px 4px; color: #1e293b;">${safe.city}</td></tr>
                <tr><td style="padding: 8px 4px; color: #64748b; font-size: 13px;">מקור</td><td style="padding: 8px 4px; color: #1e293b;">${safe.source}</td></tr>
              </table>
              <div style="margin-top: 20px; text-align: center;">
                <a href="https://petra-app.com/leads" style="display: inline-block; background: #f97316; color: #ffffff; padding: 10px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">לניהול הלידים</a>
              </div>
            </div>
          </div>`;
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: process.env.EMAIL_FROM || "Petra <noreply@petra-app.com>",
            to: emails,
            subject: `ליד חדש: ${lead.name}`,
            html,
          }),
        });
        if (!res.ok) console.error("[lead-alert] email send failed:", await res.text());
      }
    } catch (err) {
      console.error("[lead-alert] email/bell channel failed:", err);
    }
  })();

  await Promise.allSettled([...whatsappSends, ownersAndBell]);
}
