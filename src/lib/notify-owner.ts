/**
 * Owner notification service.
 * Sends a WhatsApp message + email to the Petra owner (Or) whenever a notable
 * event occurs (e.g. new user registration).
 *
 * WhatsApp: sent from Petra's official Meta Cloud API number to the owner's personal number.
 * Email:    sent via Resend to the owner's email address.
 */

const OWNER_WHATSAPP = "972542560964"; // Or's personal WhatsApp
const OWNER_EMAIL = "alldogneed@gmail.com"; // Or's email
const OWNER_NAME = "אור";

// ── WhatsApp ─────────────────────────────────────────────────────────────────

/** One template attempt: the Meta template name + its body params in order. */
interface OwnerTemplateStep {
  name: string;
  params: string[];
}

/** Meta rejects template params with newlines/tabs or empty values. */
const templateSafe = (v: string) => v.replace(/[\r\n\t]+/g, " ").replace(/ {4,}/g, "   ").trim();

/**
 * The generic `petra_owner_alert` template. Its approved text is the NEW-USER message
 * ("נרשם משתמש חדש לפטרה" · שם / אימייל / מסלול / תאריך), so it is right only for
 * registrations. Other alerts list their own template first and keep this one last as a
 * fallback until Meta approves theirs (same idea as the customer template chain).
 */
const LEGACY_OWNER_TEMPLATE = "petra_owner_alert";

async function sendOwnerWhatsApp(message: string, templates?: string[] | OwnerTemplateStep[]): Promise<void> {
  const token = process.env.META_WHATSAPP_TOKEN?.trim();
  const phoneNumberId = process.env.META_PHONE_NUMBER_ID?.trim();

  if (!token || !phoneNumberId) {
    console.warn("[notify-owner] META credentials missing — skipping WhatsApp notification");
    return;
  }

  const send = async (body: object) => {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(errText);
    }
    return res;
  };

  // A bare string[] = params for the legacy template (registrations, payments, …).
  const steps: OwnerTemplateStep[] = !templates?.length
    ? []
    : typeof templates[0] === "string"
      ? [{ name: LEGACY_OWNER_TEMPLATE, params: templates as string[] }]
      : (templates as OwnerTemplateStep[]);

  // Templates first (they work outside the 24h window — business-initiated), in order.
  // An unapproved template is rejected at send time → the next step is tried.
  for (const step of steps) {
    const params = step.params.map(templateSafe);
    if (params.some((v) => !v)) continue; // Meta rejects empty params
    try {
      await send({
        messaging_product: "whatsapp",
        to: OWNER_WHATSAPP,
        type: "template",
        template: {
          name: step.name,
          language: { code: "he" },
          components: [{ type: "body", parameters: params.map((p) => ({ type: "text", text: p })) }],
        },
      });
      return; // template succeeded
    } catch (templateErr) {
      console.warn(`[notify-owner] Template ${step.name} failed, trying the next step:`, templateErr);
    }
  }

  // Fallback: free-form text (works within 24h window only)
  try {
    await send({
      messaging_product: "whatsapp",
      to: OWNER_WHATSAPP,
      type: "text",
      text: { body: message },
    });
  } catch (err) {
    console.error("[notify-owner] WhatsApp free-form send also failed:", err);
    console.error("[notify-owner] TIP: Approve 'petra_owner_alert' template in Meta Business Manager to fix this permanently");
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── Email ─────────────────────────────────────────────────────────────────────

async function sendOwnerEmail(subject: string, html: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[notify-owner] RESEND_API_KEY missing — skipping email notification");
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "Petra <noreply@petra-app.com>",
        to: [OWNER_EMAIL],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[notify-owner] Email send failed:", err);
    }
  } catch (err) {
    console.error("[notify-owner] Email error:", err);
  }
}

// ── WhatsApp-health alert ───────────────────────────────────────────────────

/**
 * Alert the owner that WhatsApp sending is failing (e.g. expired/invalid Meta
 * token) — sent via EMAIL only, because if the token is dead a WhatsApp alert
 * would fail too. Throttled to at most once every 6h so a burst of failed sends
 * doesn't flood the inbox. Fire-and-forget — never throws.
 */
export async function notifyOwnerWhatsAppDown(context: string, errorMsg: string): Promise<void> {
  try {
    const { claimOnce } = await import("./rate-limit");
    const fresh = await claimOnce("whatsapp-send-failure", 6 * 60 * 60); // 6h
    if (!fresh) return; // already alerted recently

    const when = formatDate();
    const subject = "🔴 Petra: שליחת וואטסאפ נכשלת — בדוק את הטוקן";
    const html = `
      <div style="font-family: Arial, sans-serif; direction: rtl; text-align: right; max-width: 560px; margin: 0 auto;">
        <h2 style="color: #dc2626;">⚠️ שליחת וואטסאפ נכשלת</h2>
        <p>היי ${OWNER_NAME}, מערכת פטרה ניסתה לשלוח הודעת וואטסאפ ונכשלה. כל עוד זה קורה, <b>אף לקוח לא מקבל תזכורות/אישורים ואתה לא מקבל התראות לידים</b>.</p>
        <p style="background:#fef2f2; border:1px solid #fecaca; padding:12px; border-radius:8px;">
          <b>מקור:</b> ${escapeHtml(context)}<br/>
          <b>שגיאה:</b> ${escapeHtml(errorMsg).slice(0, 500)}<br/>
          <b>זמן:</b> ${when}
        </p>
        <p><b>סביר שהטוקן של Meta פג.</b> תיקון:</p>
        <ol>
          <li>Meta Business → System Users → <b>petra API</b> → Generate Token (ללא תפוגה, הרשאות whatsapp_business_messaging + whatsapp_business_management)</li>
          <li>עדכן את <code>META_WHATSAPP_TOKEN</code> ב-Vercel (Production) → Redeploy</li>
        </ol>
        <p style="color:#64748b; font-size:13px;">התראה זו נשלחת לכל היותר פעם ב-6 שעות.</p>
      </div>`;
    await sendOwnerEmail(subject, html);
    console.error(`[notify-owner] WhatsApp-down alert emailed (context: ${context})`);
  } catch (err) {
    console.error("[notify-owner] Failed to send WhatsApp-down alert:", err);
  }
}

// ── Support tickets ──────────────────────────────────────────────────────────

const SUPPORT_KIND_LABEL = {
  new: "פנייה חדשה",
  reply: "תגובה חדשה בפנייה",
  reopened: "פנייה נפתחה מחדש",
} as const;

/**
 * New ticket / customer reply / reopened ticket → WhatsApp + email to the owner,
 * right away, so nothing waits for someone to open /owner/support. Never throws.
 */
export async function notifyOwnerSupportActivity(p: {
  kind: keyof typeof SUPPORT_KIND_LABEL;
  businessName: string;
  userEmail: string;
  title: string;
  body?: string;
  adminUrl: string;
}): Promise<void> {
  const label = SUPPORT_KIND_LABEL[p.kind];
  const oneLine = (v: string) => v.replace(/[\r\n\t]+/g, " ").trim();
  const dateLabel = formatDate();
  const snippet = (p.body ?? "").replace(/\s+/g, " ").slice(0, 300);
  const waMessage = `🛟 ${label} — ${p.businessName}\n${p.title}${snippet ? `\n\n"${snippet}"` : ""}\n\n${p.adminUrl}`;
  const emailHtml = `
    <div style="font-family: Arial, sans-serif; direction: rtl; text-align: right; max-width: 560px; margin: 0 auto;">
      <h2 style="color: #ea580c;">🛟 ${escapeHtml(label)}</h2>
      <p><b>עסק:</b> ${escapeHtml(p.businessName)}<br/><b>משתמש:</b> ${escapeHtml(p.userEmail)}<br/><b>נושא:</b> ${escapeHtml(p.title)}<br/><b>זמן:</b> ${dateLabel}</p>
      ${snippet ? `<p style="background:#fff7ed;border:1px solid #fed7aa;padding:12px;border-radius:8px;white-space:pre-wrap;">${escapeHtml(p.body ?? "")}</p>` : ""}
      <p><a href="${p.adminUrl}" style="color:#f97316;font-weight:bold;">← לטיפול בפנייה</a></p>
    </div>`;
  // petra_support_ticket_alert: [kind, business, user, title, url]; legacy petra_owner_alert
  // (new-user wording) stays last until Meta approves the dedicated one.
  const templates: OwnerTemplateStep[] = [
    {
      name: "petra_support_ticket_alert",
      params: [label, oneLine(p.businessName) || "-", oneLine(p.userEmail) || "-", oneLine(p.title).slice(0, 200) || "-", p.adminUrl],
    },
    {
      name: LEGACY_OWNER_TEMPLATE,
      params: [oneLine(p.businessName) || "-", oneLine(p.userEmail) || "-", `${label}: ${oneLine(p.title).slice(0, 80)}`, dateLabel],
    },
  ];
  await Promise.allSettled([
    sendOwnerWhatsApp(waMessage, templates),
    // A new ticket already emails info@petra-app.com (sendSupportTicketEmail) — don't double it.
    p.kind === "new" ? Promise.resolve() : sendOwnerEmail(`🛟 Petra: ${label} — ${p.businessName}`, emailHtml),
  ]);
}

/**
 * A WhatsApp message to a business's customer was NOT delivered (Meta status webhook) →
 * WhatsApp + email to the platform owner right away, with the business, the flow, the
 * customer and the reason in Hebrew. Throttled by the caller (once per business + flow
 * per hour). Never throws.
 */
export async function notifyOwnerWhatsAppFailure(p: {
  businessName: string;
  flowLabel: string;
  customer: string;
  reason: string;
  fix: string;
  templateName: string | null;
  adminUrl: string;
}): Promise<void> {
  const oneLine = (v: string) => v.replace(/[\r\n\t]+/g, " ").trim();
  const dateLabel = formatDate();
  const waMessage =
    `🔴 וואטסאפ לא נמסר — ${oneLine(p.businessName)}\n` +
    `${p.flowLabel} · ${p.customer}\n` +
    `סיבה: ${p.reason}\n` +
    `מה לעשות: ${p.fix}\n\n${p.adminUrl}`;
  const emailHtml = `
    <div style="font-family: Arial, sans-serif; direction: rtl; text-align: right; max-width: 560px; margin: 0 auto;">
      <h2 style="color: #dc2626;">🔴 הודעת וואטסאפ ללקוח לא נמסרה</h2>
      <p><b>עסק:</b> ${escapeHtml(p.businessName)}<br/>
      <b>סוג הודעה:</b> ${escapeHtml(p.flowLabel)}<br/>
      <b>לקוח:</b> ${escapeHtml(p.customer)}<br/>
      <b>נשלח כ:</b> ${escapeHtml(p.templateName ?? "טקסט חופשי")}<br/>
      <b>זמן:</b> ${dateLabel}</p>
      <p style="background:#fef2f2;border:1px solid #fecaca;padding:12px;border-radius:8px;"><b>סיבה:</b> ${escapeHtml(p.reason)}<br/><b>מה לעשות:</b> ${escapeHtml(p.fix)}</p>
      <p><a href="${p.adminUrl}" style="color:#f97316;font-weight:bold;">← לעסק בפאנל הניהול</a></p>
      <p style="color:#64748b;font-size:13px;">כשלים נוספים מאותו עסק ואותו סוג הודעה בשעה הקרובה לא יישלחו שוב.</p>
    </div>`;
  // petra_owner_alert body params: [who, contact, what, when]
  const templateParams = [
    oneLine(p.businessName) || "-",
    oneLine(p.customer) || "-",
    `וואטסאפ לא נמסר: ${oneLine(p.flowLabel)} — ${oneLine(p.reason)}`.slice(0, 120),
    dateLabel,
  ];
  await Promise.allSettled([
    sendOwnerWhatsApp(waMessage, templateParams),
    sendOwnerEmail(`🔴 Petra: וואטסאפ לא נמסר — ${p.businessName} (${p.flowLabel})`, emailHtml),
  ]);
}

/** Daily SLA digest: tickets that waited too long for an answer. Never throws. */
export async function notifyOwnerSupportOverdue(p: {
  tickets: { title: string; businessName: string; waitingSince: Date }[];
  adminUrl: string;
}): Promise<void> {
  const hours = (d: Date) => Math.max(1, Math.round((Date.now() - d.getTime()) / 3_600_000));
  const oneLine = (v: string) => v.replace(/[\r\n\t]+/g, " ").trim();
  const MAX_LINES = 20; // WhatsApp free text caps at 4096 chars
  const lines = p.tickets.slice(0, MAX_LINES).map((t) => `• ${oneLine(t.businessName)} — ${oneLine(t.title).slice(0, 60)} (${hours(t.waitingSince)} ש׳)`);
  if (p.tickets.length > MAX_LINES) lines.push(`ועוד ${p.tickets.length - MAX_LINES}…`);
  const waMessage = `⏰ ${p.tickets.length} פניות ממתינות לתשובה:\n${lines.join("\n")}\n\n${p.adminUrl}`;
  const emailHtml = `
    <div style="font-family: Arial, sans-serif; direction: rtl; text-align: right; max-width: 560px; margin: 0 auto;">
      <h2 style="color: #dc2626;">⏰ ${p.tickets.length} פניות ממתינות לתשובה</h2>
      <ul>${p.tickets.map((t) => `<li><b>${escapeHtml(t.businessName)}</b> — ${escapeHtml(t.title)} (ממתין ${hours(t.waitingSince)} שעות)</li>`).join("")}</ul>
      <p><a href="${p.adminUrl}" style="color:#f97316;font-weight:bold;">← לפניות התמיכה</a></p>
    </div>`;
  const templateParams = ["פניות תמיכה", `${p.tickets.length} ממתינות`, `הוותיקה: ${oneLine(p.tickets[0]?.title ?? "").slice(0, 60)}`, formatDate()];
  await Promise.allSettled([
    sendOwnerWhatsApp(waMessage, templateParams),
    sendOwnerEmail(`⏰ Petra: ${p.tickets.length} פניות ממתינות לתשובה`, emailHtml),
  ]);
}

// ── Payment received ─────────────────────────────────────────────────────────

export interface PaymentReceivedParams {
  businessName: string;
  businessEmail?: string | null;
  /** Tier the customer paid for. */
  paidTier: string;
  /** Tier the business ended up on (may differ when the owner set one by hand). */
  effectiveTier: string;
  amount: number | null;
  dealId?: string | null;
  recurringId?: string | null;
  recurringError?: string | null;
  /** The business already had a recurring order — it was kept, not recreated. */
  recurringKept?: boolean;
  /** True when the card token could not be stored (CARDCOM_ENCRYPTION_KEY missing). */
  tokenStoreFailed?: boolean;
  /** Which path activated it: indicator / success-redirect / activate-pending / reconcile */
  source: string;
}

/**
 * Notify the owner that a subscription payment was verified and activated.
 * Sent on every activation regardless of which path caught it, so a charge
 * never goes unseen. Fire-and-forget — errors are logged but never thrown.
 */
export async function notifyOwnerPaymentReceived(p: PaymentReceivedParams): Promise<void> {
  const dateLabel = formatDate();
  const amountLabel = p.amount != null ? `₪${p.amount}` : "סכום לא ידוע";
  const tierLabel = formatPlan(p.paidTier);
  const keptTier = p.effectiveTier !== p.paidTier ? ` (נשאר על ${formatPlan(p.effectiveTier)} לפי הגדרה ידנית)` : "";
  const recurringLabel = p.recurringKept
    ? `⚠️ הוראת קבע קיימת ${p.recurringId} נשמרה — לקוח שילם ידנית למרות הוראה פעילה. לבדוק בקארדקום את תאריך החיוב הבא (למנוע חיוב כפול)`
    : p.recurringId
    ? `הוראת קבע ${p.recurringId} נוצרה`
    : `⚠️ הוראת קבע לא נוצרה${p.recurringError ? `: ${p.recurringError}` : ""}`;
  const sourceLabel: Record<string, string> = {
    indicator: "אוטומטי (קארדקום)",
    "success-redirect": "אוטומטי (דף הצלחה)",
    "activate-pending": "אוטומטי (דפדפן הלקוח)",
    reconcile: "השלמה יומית — הדפדפן לא סיים",
  };

  const tokenWarning = p.tokenStoreFailed
    ? "⚠️ טוקן הכרטיס לא נשמר — חסר CARDCOM_ENCRYPTION_KEY ב-Vercel"
    : null;

  const waMessage =
    `💳 תשלום התקבל בפטרה\n\n` +
    `🏢 ${p.businessName}\n` +
    `📦 ${tierLabel}${keptTier}\n` +
    `💰 ${amountLabel}\n` +
    `🔁 ${recurringLabel}\n` +
    `🛠 ${sourceLabel[p.source] ?? p.source}\n` +
    (tokenWarning ? `${tokenWarning}\n` : "") +
    `🕐 ${dateLabel}`;

  const safeName = escapeHtml(p.businessName);
  const emailSubject = `💳 תשלום התקבל — ${safeName} — ${amountLabel}`;
  const emailHtml = `
    <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #f8fafc; border-radius: 12px;">
      <div style="background: #1e293b; padding: 20px 24px; border-radius: 8px 8px 0 0; text-align: center;">
        <h2 style="color: #fb923c; margin: 0; font-size: 20px;">🐾 Petra</h2>
        <p style="color: #94a3b8; margin: 4px 0 0; font-size: 13px;">תשלום מנוי התקבל</p>
      </div>
      <div style="background: #ffffff; padding: 24px; border-radius: 0 0 8px 8px; border: 1px solid #e2e8f0;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 4px; color: #64748b; font-size: 13px; width: 110px;">עסק</td><td style="padding: 8px 4px; color: #1e293b; font-weight: 600;">${safeName}</td></tr>
          ${p.businessEmail ? `<tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 4px; color: #64748b; font-size: 13px;">אימייל</td><td style="padding: 8px 4px; color: #1e293b;">${escapeHtml(p.businessEmail)}</td></tr>` : ""}
          <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 4px; color: #64748b; font-size: 13px;">מסלול</td><td style="padding: 8px 4px; color: #f97316; font-weight: 600;">${escapeHtml(tierLabel)}${escapeHtml(keptTier)}</td></tr>
          <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 4px; color: #64748b; font-size: 13px;">סכום</td><td style="padding: 8px 4px; color: #1e293b; font-weight: 600;">${amountLabel}</td></tr>
          ${p.dealId ? `<tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 4px; color: #64748b; font-size: 13px;">עסקה</td><td style="padding: 8px 4px; color: #1e293b;">${escapeHtml(p.dealId)}</td></tr>` : ""}
          <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 4px; color: #64748b; font-size: 13px;">הוראת קבע</td><td style="padding: 8px 4px; color: ${p.recurringId ? "#15803d" : "#b91c1c"};">${escapeHtml(recurringLabel)}</td></tr>
          <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 4px; color: #64748b; font-size: 13px;">מסלול הפעלה</td><td style="padding: 8px 4px; color: #1e293b;">${escapeHtml(sourceLabel[p.source] ?? p.source)}</td></tr>
          <tr><td style="padding: 8px 4px; color: #64748b; font-size: 13px;">תאריך</td><td style="padding: 8px 4px; color: #1e293b;">${dateLabel}</td></tr>
        </table>
        ${tokenWarning ? `<div style="margin-top: 16px; padding: 12px 16px; background: #fef2f2; border-radius: 8px; border: 1px solid #fecaca;"><p style="margin: 0; font-size: 13px; color: #b91c1c;">${escapeHtml(tokenWarning)}</p></div>` : ""}
        <div style="margin-top: 20px; padding: 12px 16px; background: #fff7ed; border-radius: 8px; border: 1px solid #fed7aa;">
          <p style="margin: 0; font-size: 13px; color: #9a3412;">💡 <a href="https://petra-app.com/owner/tenants" style="color: #f97316;">ניהול ובקרה → עסקים</a></p>
        </div>
      </div>
    </div>
  `;

  const templateParams = [p.businessName, p.businessEmail ?? "-", `${tierLabel} — ${amountLabel}`, dateLabel];

  await Promise.allSettled([
    sendOwnerWhatsApp(waMessage, templateParams),
    sendOwnerEmail(emailSubject, emailHtml),
  ]);
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface NewUserParams {
  name: string;
  email: string;
  plan?: string;
  phone?: string;
}

function formatPlan(plan?: string): string {
  const map: Record<string, string> = {
    free: "חינמי",
    basic: "Basic ₪99/חודש",
    pro: "Pro ₪199/חודש",
  };
  return map[plan ?? "free"] ?? "חינמי";
}

function formatDate(): string {
  return new Date().toLocaleString("he-IL", {
    timeZone: "Asia/Jerusalem",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Notify the owner about a new user registration.
 * Fire-and-forget — errors are logged but never thrown.
 */
export async function notifyOwnerNewUser(params: NewUserParams): Promise<void> {
  const { name, email, plan, phone } = params;
  const planLabel = formatPlan(plan);
  const dateLabel = formatDate();

  // ── WhatsApp message ──────────────────────────────────────────────────────
  const waMessage =
    `היי ${OWNER_NAME} 👋\n\n` +
    `רציתי לעדכן אותך שנרשם משתמש חדש לפטרה!\n\n` +
    `👤 שם: ${name}\n` +
    `📧 אימייל: ${email}\n` +
    (phone ? `📞 טלפון: ${phone}\n` : "") +
    `📦 מסלול: ${planLabel}\n` +
    `🕐 תאריך: ${dateLabel}\n\n` +
    `בהצלחה! 🐾`;

  // ── Email ─────────────────────────────────────────────────────────────────
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safePhone = phone ? escapeHtml(phone) : "";

  const emailSubject = `משתמש חדש נרשם לפטרה — ${safeName}`;
  const emailHtml = `
    <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #f8fafc; border-radius: 12px;">
      <div style="background: #1e293b; padding: 20px 24px; border-radius: 8px 8px 0 0; text-align: center;">
        <h2 style="color: #fb923c; margin: 0; font-size: 20px;">🐾 Petra</h2>
        <p style="color: #94a3b8; margin: 4px 0 0; font-size: 13px;">מערכת ניהול לעסקי חיות מחמד</p>
      </div>
      <div style="background: #ffffff; padding: 24px; border-radius: 0 0 8px 8px; border: 1px solid #e2e8f0;">
        <p style="font-size: 16px; color: #1e293b; margin-top: 0;">היי ${OWNER_NAME} 👋</p>
        <p style="color: #475569;">נרשם משתמש חדש לפטרה!</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 4px; color: #64748b; font-size: 13px; width: 100px;">שם</td>
            <td style="padding: 8px 4px; color: #1e293b; font-weight: 600;">${safeName}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 4px; color: #64748b; font-size: 13px;">אימייל</td>
            <td style="padding: 8px 4px; color: #1e293b;">${safeEmail}</td>
          </tr>
          ${safePhone ? `<tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 4px; color: #64748b; font-size: 13px;">טלפון</td><td style="padding: 8px 4px; color: #1e293b;">${safePhone}</td></tr>` : ""}
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 4px; color: #64748b; font-size: 13px;">מסלול</td>
            <td style="padding: 8px 4px; color: #f97316; font-weight: 600;">${planLabel}</td>
          </tr>
          <tr>
            <td style="padding: 8px 4px; color: #64748b; font-size: 13px;">תאריך</td>
            <td style="padding: 8px 4px; color: #1e293b;">${dateLabel}</td>
          </tr>
        </table>
        <div style="margin-top: 20px; padding: 12px 16px; background: #fff7ed; border-radius: 8px; border: 1px solid #fed7aa;">
          <p style="margin: 0; font-size: 13px; color: #9a3412;">
            💡 לצפייה במשתמש: <a href="https://petra-app.com/admin/users" style="color: #f97316;">פאנל ניהול</a>
          </p>
        </div>
      </div>
    </div>
  `;

  // Template params for petra_owner_alert (business-initiated — no 24h window restriction)
  const templateParams = [name, email, planLabel, dateLabel];

  // Send both in parallel, fire-and-forget
  await Promise.allSettled([
    sendOwnerWhatsApp(waMessage, templateParams),
    sendOwnerEmail(emailSubject, emailHtml),
  ]);
}

/**
 * AllDog automations (src/lib/alldog*) → WhatsApp + email to Or.
 * Used for bot handoffs and for one-off operational alerts (e.g. PayCall recording access denied).
 * Throttling is the caller's job. Never throws. Pass only masked phones in `lines`.
 */
export async function notifyOwnerAllDog(p: { title: string; lines: string[]; url?: string }): Promise<void> {
  const oneLine = (v: string) => v.replace(/[\r\n\t]+/g, " ").trim();
  const dateLabel = formatDate();
  const waMessage = `🐶 AllDog — ${p.title}\n${p.lines.join("\n")}${p.url ? `\n\n${p.url}` : ""}`;
  const emailHtml = `
    <div style="font-family: Arial, sans-serif; direction: rtl; text-align: right; max-width: 560px; margin: 0 auto;">
      <h2 style="color: #ea580c;">🐶 ${escapeHtml(p.title)}</h2>
      <p style="white-space:pre-wrap;">${p.lines.map(escapeHtml).join("<br/>")}</p>
      <p style="color:#64748b;font-size:13px;">${dateLabel}</p>
      ${p.url ? `<p><a href="${escapeHtml(p.url)}" style="color:#f97316;font-weight:bold;">← לפתיחה בפטרה</a></p>` : ""}
    </div>`;
  // petra_alldog_owner_alert: [title, who, details, url]; legacy petra_owner_alert last.
  const details = p.lines.slice(1).map(oneLine).filter(Boolean).join(" · ");
  const templates: OwnerTemplateStep[] = [
    {
      name: "petra_alldog_owner_alert",
      params: [
        oneLine(p.title).slice(0, 120) || "-",
        oneLine(p.lines[0] ?? "").slice(0, 200) || "-",
        details.slice(0, 600) || "-",
        p.url || `${process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://petra-app.com"}/leads`,
      ],
    },
    { name: LEGACY_OWNER_TEMPLATE, params: ["AllDog", oneLine(p.lines[0] ?? "-").slice(0, 120) || "-", oneLine(p.title).slice(0, 120), dateLabel] },
  ];
  await Promise.allSettled([
    sendOwnerWhatsApp(waMessage, templates),
    sendOwnerEmail(`🐶 AllDog: ${oneLine(p.title)}`, emailHtml),
  ]);
}
